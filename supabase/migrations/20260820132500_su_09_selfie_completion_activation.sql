-- Chon.Love Signup / Onboarding V2 — SU-09
-- Final Step 8 completion gate for selfie verification.
-- Auto approval and Admin approval share one service-role-only activation contract.
-- Exact location remains private; nearby is enabled only when the member explicitly
-- supplied a still-fresh, still-consented location that is usable by Search V2.

create or replace function public.activate_verified_signup_profile_v2(
  p_user_id uuid
)
returns table(
  profile_status text,
  discovery_enabled boolean,
  nearby_enabled boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile public.profiles%rowtype;
  v_enable_nearby boolean := false;
  v_fresh_minutes integer := 30;
  v_max_accuracy integer := 5000;
  v_headline text;
  v_bio text;
  v_looking_for text;
begin
  if p_user_id is null then
    raise exception using errcode='22023', message='verified signup user id required';
  end if;

  select p.*
  into v_profile
  from public.profiles as p
  where p.id = p_user_id
  for update;

  if not found or v_profile.deleted_at is not null then
    raise exception using errcode='P0002', message='verified signup profile not found';
  end if;

  if v_profile.profile_status not in (
    'incomplete'::public.profile_status,
    'pending_review'::public.profile_status
  ) then
    raise exception using errcode='42501', message='verified signup profile must be incomplete or pending review';
  end if;

  if not private.is_active_adult(p_user_id) then
    raise exception using errcode='42501', message='verified signup adult onboarding required';
  end if;

  if v_profile.province_id is null or not exists (
    select 1
    from public.administrative_areas as area
    where area.id = v_profile.province_id
      and area.country_code = 'VN'
      and area.is_active
      and area.parent_id is null
      and area.area_type in ('province', 'municipality')
  ) then
    raise exception using errcode='42501', message='verified signup location required';
  end if;

  v_looking_for := btrim(coalesce(v_profile.looking_for, ''));
  if char_length(v_looking_for) < 50 or char_length(v_looking_for) > 4000
     or cardinality(coalesce(v_profile.lifestyle_tags, '{}'::public.profile_lifestyle_tag[])) < 1
     or cardinality(coalesce(v_profile.lifestyle_tags, '{}'::public.profile_lifestyle_tag[])) > 7 then
    raise exception using errcode='42501', message='verified signup looking for required';
  end if;

  v_headline := btrim(coalesce(v_profile.headline, ''));
  v_bio := btrim(coalesce(v_profile.bio, ''));
  if (char_length(v_headline) > 0 and (char_length(v_headline) < 10 or char_length(v_headline) > 50))
     or char_length(v_bio) < 50
     or char_length(v_bio) > 4000 then
    raise exception using errcode='42501', message='verified signup headline bio required';
  end if;

  if not exists (
    select 1
    from public.media_assets as media
    where media.owner_id = p_user_id
      and media.visibility in ('avatar'::public.media_visibility, 'public'::public.media_visibility)
      and media.moderation_status in ('pending_review'::public.media_moderation_status, 'approved'::public.media_moderation_status)
      and media.deleted_at is null
      and media.uploaded_at is not null
  ) then
    raise exception using errcode='42501', message='verified signup profile photo required';
  end if;

  select coalesce((config.value_json #>> '{}')::integer, 30)
  into v_fresh_minutes
  from private.app_config as config
  where config.key = 'nearby_location_fresh_minutes';
  v_fresh_minutes := greatest(coalesce(v_fresh_minutes, 30), 1);

  select coalesce((config.value_json #>> '{}')::integer, 5000)
  into v_max_accuracy
  from private.app_config as config
  where config.key = 'location_max_accuracy_meters';
  v_max_accuracy := greatest(coalesce(v_max_accuracy, 5000), 0);

  select exists (
    select 1
    from private.user_locations as location
    where location.user_id = p_user_id
      and location.is_enabled
      and location.consented_at is not null
      and location.location is not null
      and location.captured_at is not null
      and location.expires_at is not null
      and location.expires_at > now()
      and location.captured_at > now() - make_interval(mins => v_fresh_minutes)
      and location.accuracy_meters is not null
      and location.accuracy_meters <= v_max_accuracy
  ) into v_enable_nearby;

  update public.profiles
  set profile_status = 'active'::public.profile_status,
      discovery_enabled = true,
      nearby_enabled = v_enable_nearby,
      updated_at = now()
  where id = p_user_id
  returning * into v_profile;

  return query
  select
    v_profile.profile_status::text,
    v_profile.discovery_enabled,
    v_profile.nearby_enabled;
end;
$function$;

revoke all on function public.activate_verified_signup_profile_v2(uuid)
  from public, anon, authenticated;
grant execute on function public.activate_verified_signup_profile_v2(uuid)
  to service_role;

comment on function public.activate_verified_signup_profile_v2(uuid) is
  'SU-09 service-role-only completion gate shared by automated and Admin selfie approval. Activates a fully staged adult Signup V2 profile, enables discovery, and enables nearby only when private foreground location consent is still fresh/usable under Search V2 rules.';

create or replace function public.admin_review_member_photo_verification(
  p_actor_user_id uuid,
  p_case_id uuid,
  p_action text,
  p_reason text,
  p_request_id uuid
)
returns table(
  case_id uuid,
  user_id uuid,
  profile_status text,
  decision text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role private.user_role;
  v_case public.moderation_cases;
  v_profile public.profiles;
  v_before jsonb;
  v_after jsonb;
begin
  v_role := private.actor_role_for(
    p_actor_user_id,
    array['moderator'::private.user_role, 'super_admin'::private.user_role]
  );

  if p_request_id is null then
    raise exception using errcode='22023', message='request_id_required';
  end if;
  if p_action not in ('approve', 'hide') then
    raise exception using errcode='22023', message='invalid_member_photo_verification_action';
  end if;

  select * into v_case
  from public.moderation_cases mc
  where mc.id = p_case_id
    and 'member_photo_verification' = any(mc.rule_codes)
  for update;

  if not found then
    raise exception using errcode='P0002', message='member_photo_verification_case_not_found';
  end if;
  if v_case.status not in (
    'open'::public.moderation_case_status,
    'queued'::public.moderation_case_status,
    'in_review'::public.moderation_case_status
  ) then
    raise exception using errcode='22023', message='member_photo_verification_case_already_resolved';
  end if;

  select * into v_profile
  from public.profiles p
  where p.id = v_case.reported_user_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='member_profile_not_found';
  end if;

  v_before := jsonb_build_object(
    'case_status', v_case.status,
    'profile_status', v_profile.profile_status,
    'discovery_enabled', v_profile.discovery_enabled,
    'nearby_enabled', v_profile.nearby_enabled
  );

  if p_action = 'approve' then
    update public.moderation_cases
    set status = 'resolved'::public.moderation_case_status,
        decision = 'approve'::public.moderation_decision,
        decision_notes = nullif(btrim(p_reason), ''),
        assigned_to = p_actor_user_id,
        resolved_at = now(),
        updated_at = now()
    where id = p_case_id
    returning * into v_case;

    perform public.activate_verified_signup_profile_v2(v_case.reported_user_id);

    select * into v_profile
    from public.profiles p
    where p.id = v_case.reported_user_id;
  else
    update public.moderation_cases
    set status = 'resolved'::public.moderation_case_status,
        decision = 'delete'::public.moderation_decision,
        decision_notes = nullif(btrim(p_reason), ''),
        assigned_to = p_actor_user_id,
        resolved_at = now(),
        updated_at = now()
    where id = p_case_id
    returning * into v_case;

    update public.profiles
    set profile_status = 'deactivated'::public.profile_status,
        discovery_enabled = false,
        nearby_enabled = false,
        updated_at = now()
    where id = v_case.reported_user_id
    returning * into v_profile;
  end if;

  v_after := jsonb_build_object(
    'case_status', v_case.status,
    'decision', v_case.decision,
    'profile_status', v_profile.profile_status,
    'discovery_enabled', v_profile.discovery_enabled,
    'nearby_enabled', v_profile.nearby_enabled
  );

  perform private.append_admin_audit(
    p_actor_user_id,
    v_role,
    'member_photo_verification_' || p_action,
    'moderation_case',
    p_case_id,
    v_before,
    v_after,
    p_reason,
    p_request_id,
    null,
    null
  );

  return query
  select
    v_case.id,
    v_case.reported_user_id,
    v_profile.profile_status::text,
    v_case.decision::text;
end;
$function$;

revoke all on function public.admin_review_member_photo_verification(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_review_member_photo_verification(uuid, uuid, text, text, uuid)
  to service_role;

comment on function public.admin_review_member_photo_verification(uuid, uuid, text, text, uuid) is
  'SU-09 trusted manual selfie review. Approval reuses the same verified-signup activation gate as automatic approval; hide disables profile discovery and nearby. Existing immutable Admin audit behavior is preserved.';
