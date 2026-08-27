-- Chon.Love OPT-01 — Approval Contract
-- Separate account/profile access from Connect discovery approval.
-- New AWS-verified Free members can use the app and open direct profile URLs,
-- but stay out of Connect until Admin approval or an active Premium/Diamond membership.

alter table private.member_profile_verifications
  add column listing_status text not null default 'not_started',
  add column listing_submitted_at timestamptz,
  add column listing_reviewed_at timestamptz,
  add column listing_reviewed_by uuid references auth.users(id) on delete set null,
  add column listing_reason_code text;

alter table private.member_profile_verifications
  add constraint member_profile_listing_status_check
    check (listing_status in ('not_started','pending','approved','rejected')),
  add constraint member_profile_listing_reason_check
    check (listing_reason_code is null or listing_reason_code ~ '^[a-z][a-z0-9_]{1,63}$');

create index member_profile_verifications_listing_queue_idx
  on private.member_profile_verifications(listing_status, listing_submitted_at desc, user_id)
  where listing_status='pending';

-- Every profile receives one private verification row. Existing active members retain
-- their current listing behavior, except the four explicitly identified Free regression
-- accounts which become pending. Active paid members remain automatically listable.
insert into private.member_profile_verifications(user_id)
select p.id
from public.profiles p
on conflict(user_id) do nothing;

update private.member_profile_verifications v
set listing_status = case
      when p.profile_status='active'::public.profile_status
        and private.has_active_luxy_paid_membership(p.id) then 'approved'
      when p.profile_status='active'::public.profile_status
        and p.public_profile_code in ('00b107','c5d896','9804d2','145084') then 'pending'
      when p.profile_status='active'::public.profile_status then 'approved'
      else 'not_started'
    end,
    listing_submitted_at = case
      when p.profile_status='active'::public.profile_status then coalesce(v.listing_submitted_at,p.created_at,now())
      else v.listing_submitted_at
    end,
    listing_reviewed_at = case
      when p.profile_status='active'::public.profile_status
        and (private.has_active_luxy_paid_membership(p.id)
          or p.public_profile_code not in ('00b107','c5d896','9804d2','145084'))
        then coalesce(v.listing_reviewed_at,now())
      else null
    end,
    listing_reviewed_by = case
      when p.profile_status='active'::public.profile_status
        and p.public_profile_code in ('00b107','c5d896','9804d2','145084')
        and not private.has_active_luxy_paid_membership(p.id)
        then null
      else v.listing_reviewed_by
    end,
    listing_reason_code = case
      when p.profile_status='active'::public.profile_status
        and private.has_active_luxy_paid_membership(p.id) then 'paid_membership_auto_approval'
      when p.profile_status='active'::public.profile_status
        and p.public_profile_code not in ('00b107','c5d896','9804d2','145084') then 'migration_existing'
      else null
    end,
    updated_at=now()
from public.profiles p
where p.id=v.user_id;

-- This existing helper is already consumed by Search V2 + count. It now owns the
-- approval gate as well as the existing Diamond privacy gate, so discovery policy
-- stays centralized without duplicating Search V2 predicates.
create or replace function private.luxy_listing_hidden(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select case
    when private.has_active_luxy_paid_membership(p_user_id) then
      case
        when private.get_active_luxy_membership_tier(p_user_id)='diamond'
          then coalesce((select s.hide_from_listing from private.luxy_membership_privacy s where s.user_id=p_user_id),false)
        else false
      end
    when coalesce((select v.listing_status from private.member_profile_verifications v where v.user_id=p_user_id),'not_started')<>'approved' then true
    else false
  end
$$;

comment on function private.luxy_listing_hidden(uuid) is
  'OPT-01 centralized Connect gate. Free members require listing_status=approved; active Premium/Diamond bypass manual listing approval. Existing Diamond hide-from-listing privacy remains authoritative.';

-- Signup/AWS completion still activates the account/profile and preserves the user's
-- discovery preference. Listing approval is recorded independently.
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
set search_path=''
as $function$
declare
  v_profile public.profiles%rowtype;
  v_enable_nearby boolean:=false;
  v_fresh_minutes integer:=30;
  v_max_accuracy integer:=5000;
  v_headline text;
  v_bio text;
  v_looking_for text;
  v_paid boolean:=false;
begin
  if p_user_id is null then
    raise exception using errcode='22023',message='verified signup user id required';
  end if;

  select p.* into v_profile
  from public.profiles p
  where p.id=p_user_id
  for update;

  if not found or v_profile.deleted_at is not null then
    raise exception using errcode='P0002',message='verified signup profile not found';
  end if;

  if v_profile.profile_status not in ('incomplete'::public.profile_status,'pending_review'::public.profile_status) then
    raise exception using errcode='42501',message='verified signup profile must be incomplete or pending review';
  end if;

  if not private.is_profile_setup_adult(p_user_id) then
    raise exception using errcode='42501',message='verified signup adult onboarding required';
  end if;

  if v_profile.province_id is null or not exists(
    select 1 from public.administrative_areas a
    where a.id=v_profile.province_id and a.country_code='VN' and a.is_active
      and a.parent_id is null and a.area_type in ('province','municipality')
  ) then
    raise exception using errcode='42501',message='verified signup location required';
  end if;

  v_looking_for:=btrim(coalesce(v_profile.looking_for,''));
  if char_length(v_looking_for)<50 or char_length(v_looking_for)>4000
     or cardinality(coalesce(v_profile.lifestyle_tags,'{}'::public.profile_lifestyle_tag[]))<1
     or cardinality(coalesce(v_profile.lifestyle_tags,'{}'::public.profile_lifestyle_tag[]))>7 then
    raise exception using errcode='42501',message='verified signup looking for required';
  end if;

  v_headline:=btrim(coalesce(v_profile.headline,''));
  v_bio:=btrim(coalesce(v_profile.bio,''));
  if (char_length(v_headline)>0 and (char_length(v_headline)<10 or char_length(v_headline)>50))
     or char_length(v_bio)<50 or char_length(v_bio)>4000 then
    raise exception using errcode='42501',message='verified signup headline bio required';
  end if;

  if not exists(
    select 1 from public.media_assets media
    where media.owner_id=p_user_id
      and media.visibility in ('avatar'::public.media_visibility,'public'::public.media_visibility)
      and media.moderation_status in ('pending_review'::public.media_moderation_status,'approved'::public.media_moderation_status)
      and media.deleted_at is null and media.uploaded_at is not null
  ) then
    raise exception using errcode='42501',message='verified signup profile photo required';
  end if;

  select coalesce((config.value_json#>>'{}')::integer,30)
  into v_fresh_minutes
  from private.app_config config where config.key='nearby_location_fresh_minutes';
  v_fresh_minutes:=greatest(coalesce(v_fresh_minutes,30),1);

  select coalesce((config.value_json#>>'{}')::integer,5000)
  into v_max_accuracy
  from private.app_config config where config.key='location_max_accuracy_meters';
  v_max_accuracy:=greatest(coalesce(v_max_accuracy,5000),0);

  select exists(
    select 1 from private.user_locations location
    where location.user_id=p_user_id and location.is_enabled
      and location.consented_at is not null and location.location is not null
      and location.captured_at is not null and location.expires_at is not null
      and location.expires_at>now()
      and location.captured_at>now()-make_interval(mins=>v_fresh_minutes)
      and location.accuracy_meters is not null and location.accuracy_meters<=v_max_accuracy
  ) into v_enable_nearby;

  update public.profiles
  set profile_status='active'::public.profile_status,
      discovery_enabled=true,
      nearby_enabled=v_enable_nearby,
      updated_at=now()
  where id=p_user_id
  returning * into v_profile;

  v_paid:=private.has_active_luxy_paid_membership(p_user_id);

  insert into private.member_profile_verifications(
    user_id,listing_status,listing_submitted_at,listing_reviewed_at,listing_reviewed_by,listing_reason_code
  ) values(
    p_user_id,
    case when v_paid then 'approved' else 'pending' end,
    now(),
    case when v_paid then now() else null end,
    null,
    case when v_paid then 'paid_membership_auto_approval' else null end
  )
  on conflict(user_id) do update
  set listing_status=case
        when private.member_profile_verifications.listing_status='approved' then 'approved'
        when v_paid then 'approved'
        else 'pending'
      end,
      listing_submitted_at=coalesce(private.member_profile_verifications.listing_submitted_at,excluded.listing_submitted_at),
      listing_reviewed_at=case
        when private.member_profile_verifications.listing_status='approved' then private.member_profile_verifications.listing_reviewed_at
        when v_paid then now()
        else null
      end,
      listing_reviewed_by=case
        when private.member_profile_verifications.listing_status='approved' then private.member_profile_verifications.listing_reviewed_by
        else null
      end,
      listing_reason_code=case
        when private.member_profile_verifications.listing_status='approved' then private.member_profile_verifications.listing_reason_code
        when v_paid then 'paid_membership_auto_approval'
        else null
      end,
      updated_at=now();

  return query select v_profile.profile_status::text,v_profile.discovery_enabled,v_profile.nearby_enabled;
end;
$function$;

revoke all on function public.activate_verified_signup_profile_v2(uuid) from public,anon,authenticated;
grant execute on function public.activate_verified_signup_profile_v2(uuid) to service_role;

comment on function public.activate_verified_signup_profile_v2(uuid) is
  'OPT-01 verified signup activation. Account/profile become active after trusted selfie verification; Free listing becomes pending while active Premium/Diamond receives automatic listing approval.';

-- Current-user status is additive so existing verification RPC signatures stay stable.
create or replace function public.get_my_listing_approval_status()
returns table(
  listing_status text,
  listing_submitted_at timestamptz,
  listing_reviewed_at timestamptz,
  is_paid_override boolean,
  discovery_preference_enabled boolean,
  effective_discoverable boolean
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  return query
  select
    coalesce(v.listing_status,'not_started'),
    v.listing_submitted_at,
    v.listing_reviewed_at,
    private.has_active_luxy_paid_membership(p.id),
    p.discovery_enabled,
    (p.profile_status='active'::public.profile_status and p.deleted_at is null and p.discovery_enabled and not private.luxy_listing_hidden(p.id))
  from public.profiles p
  left join private.member_profile_verifications v on v.user_id=p.id
  where p.id=v_user_id;
end;
$$;
revoke all on function public.get_my_listing_approval_status() from public,anon;
grant execute on function public.get_my_listing_approval_status() to authenticated,service_role;

-- Additive trusted Admin queue; OPT-03 will wire this into Admin presentation/alerts.
create or replace function public.admin_list_member_listing_verifications(
  p_actor_user_id uuid,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table(
  user_id uuid,
  public_profile_code text,
  username text,
  display_name text,
  listing_status text,
  listing_submitted_at timestamptz,
  membership_tier public.luxy_membership_tier,
  is_paid_override boolean,
  discovery_preference_enabled boolean,
  effective_discoverable boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_role private.user_role;
  v_limit integer:=least(greatest(coalesce(p_limit,100),1),200);
  v_offset integer:=least(greatest(coalesce(p_offset,0),0),5000);
begin
  v_role:=private.actor_role_for(p_actor_user_id,array['moderator'::private.user_role,'super_admin'::private.user_role]);
  return query
  select
    v.user_id,p.public_profile_code,p.username::text,p.display_name,v.listing_status,v.listing_submitted_at,
    private.get_active_luxy_membership_tier(p.id),private.has_active_luxy_paid_membership(p.id),p.discovery_enabled,
    (p.profile_status='active'::public.profile_status and p.deleted_at is null and p.discovery_enabled and not private.luxy_listing_hidden(p.id)),v.updated_at
  from private.member_profile_verifications v
  join public.profiles p on p.id=v.user_id
  where v.listing_status='pending'
  order by v.listing_submitted_at desc nulls last,v.updated_at desc,v.user_id
  limit v_limit offset v_offset;
end;
$$;
revoke all on function public.admin_list_member_listing_verifications(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.admin_list_member_listing_verifications(uuid,integer,integer) to service_role;

create or replace function public.admin_review_member_listing_verification(
  p_actor_user_id uuid,
  p_user_id uuid,
  p_action text,
  p_reason_code text,
  p_request_id uuid
)
returns table(
  user_id uuid,
  listing_status text,
  effective_discoverable boolean
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_role private.user_role;
  v_before jsonb;
  v_after jsonb;
  v_current text;
begin
  v_role:=private.actor_role_for(p_actor_user_id,array['moderator'::private.user_role,'super_admin'::private.user_role]);
  if p_user_id is null then raise exception using errcode='22023',message='user_id_required'; end if;
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  if p_action not in ('approve','reject') then raise exception using errcode='22023',message='invalid_listing_review_action'; end if;
  if p_reason_code is not null and p_reason_code !~ '^[a-z][a-z0-9_]{1,63}$' then raise exception using errcode='22023',message='invalid_reason_code'; end if;

  select verification.listing_status into v_current
  from private.member_profile_verifications verification
  where verification.user_id=p_user_id
  for update;
  if not found then raise exception using errcode='P0002',message='listing_verification_not_found'; end if;
  if v_current not in ('pending','rejected') then raise exception using errcode='22023',message='listing_verification_not_reviewable'; end if;

  v_before:=jsonb_build_object('listing_status',v_current,'effective_discoverable',not private.luxy_listing_hidden(p_user_id));

  update private.member_profile_verifications verification
  set listing_status=case when p_action='approve' then 'approved' else 'rejected' end,
      listing_reviewed_at=now(),
      listing_reviewed_by=p_actor_user_id,
      listing_reason_code=case when p_action='approve' then coalesce(p_reason_code,'admin_approved') else coalesce(p_reason_code,'admin_rejected') end,
      updated_at=now()
  where verification.user_id=p_user_id;

  v_after:=jsonb_build_object(
    'listing_status',case when p_action='approve' then 'approved' else 'rejected' end,
    'effective_discoverable',(
      select p.profile_status='active'::public.profile_status and p.deleted_at is null and p.discovery_enabled and not private.luxy_listing_hidden(p.id)
      from public.profiles p where p.id=p_user_id
    )
  );

  perform private.append_admin_audit(
    p_actor_user_id,v_role,'member_listing_verification_'||p_action,'profile_listing_verification',p_user_id,
    v_before,v_after,p_reason_code,p_request_id,null,null
  );

  return query
  select p_user_id,verification.listing_status,
    (p.profile_status='active'::public.profile_status and p.deleted_at is null and p.discovery_enabled and not private.luxy_listing_hidden(p.id))
  from private.member_profile_verifications verification
  join public.profiles p on p.id=verification.user_id
  where verification.user_id=p_user_id;
end;
$$;
revoke all on function public.admin_review_member_listing_verification(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_review_member_listing_verification(uuid,uuid,text,text,uuid) to service_role;
