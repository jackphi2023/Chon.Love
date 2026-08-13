-- Admin operations for Luxy signup selfie verification.
-- These RPCs are service-role only and preserve the existing immutable admin audit trail.

create or replace function public.admin_list_member_photo_verifications(
  p_actor_user_id uuid,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table(
  case_id uuid,
  user_id uuid,
  username text,
  display_name text,
  declared_gender text,
  profile_status text,
  case_status text,
  priority text,
  max_similarity numeric,
  automated_score_json jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role private.user_role;
begin
  v_role := private.actor_role_for(
    p_actor_user_id,
    array['moderator'::private.user_role, 'super_admin'::private.user_role]
  );

  return query
  select
    mc.id,
    mc.reported_user_id,
    p.username::text,
    p.display_name::text,
    p.gender::text,
    p.profile_status::text,
    mc.status::text,
    mc.priority::text,
    nullif(mc.automated_score_json ->> 'maxSimilarity', '')::numeric,
    mc.automated_score_json,
    mc.created_at
  from public.moderation_cases mc
  join public.profiles p on p.id = mc.reported_user_id
  where 'member_photo_verification' = any(mc.rule_codes)
    and mc.status in (
      'open'::public.moderation_case_status,
      'queued'::public.moderation_case_status,
      'in_review'::public.moderation_case_status
    )
  order by mc.created_at asc
  limit least(greatest(coalesce(p_limit, 100), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end
$$;

revoke all on function public.admin_list_member_photo_verifications(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.admin_list_member_photo_verifications(uuid, integer, integer)
  to service_role;

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
as $$
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
    'discovery_enabled', v_profile.discovery_enabled
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

    update public.profiles
    set profile_status = 'active'::public.profile_status,
        discovery_enabled = true,
        updated_at = now()
    where id = v_case.reported_user_id
    returning * into v_profile;
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
        updated_at = now()
    where id = v_case.reported_user_id
    returning * into v_profile;
  end if;

  v_after := jsonb_build_object(
    'case_status', v_case.status,
    'decision', v_case.decision,
    'profile_status', v_profile.profile_status,
    'discovery_enabled', v_profile.discovery_enabled
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
end
$$;

revoke all on function public.admin_review_member_photo_verification(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_review_member_photo_verification(uuid, uuid, text, text, uuid)
  to service_role;
