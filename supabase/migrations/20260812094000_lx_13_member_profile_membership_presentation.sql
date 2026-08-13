-- LX-13: Seeking-derived Member Profile presentation contracts.
--
-- Scope boundary:
-- - Favorite remains LX-12 profile-level interest, including hearts shown over photos.
-- - This migration exposes a read-only/current membership presentation snapshot and upgrade intent only.
-- - LX-17 remains the authoritative membership-engine session; LX-18 remains payment/checkout.
-- - Creating an upgrade intent NEVER activates Premium/Diamond and NEVER charges a user.
-- - Private-photo request/approval remains LX-14; this session returns only a safe private-photo count.
-- - Messaging still uses the existing conversation safety contract; LX-15 owns the final entitlement redesign.

create type public.luxy_membership_tier as enum ('free','premium','diamond');

create table private.luxy_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier public.luxy_membership_tier not null default 'free',
  status text not null default 'inactive',
  messaging_enabled boolean not null default false,
  starts_at timestamptz,
  expires_at timestamptz,
  source text not null default 'manual',
  updated_at timestamptz not null default now(),
  constraint luxy_memberships_status_check check(status in ('inactive','active','cancelled','expired')),
  constraint luxy_memberships_source_check check(source ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint luxy_memberships_time_check check(expires_at is null or starts_at is null or expires_at>starts_at),
  constraint luxy_memberships_free_message_check check(tier<>'free' or messaging_enabled=false)
);

comment on table private.luxy_memberships is
  'LX-13 server-controlled membership presentation snapshot. Clients cannot mutate it. LX-17 will become the authoritative membership engine.';

revoke all on table private.luxy_memberships from public,anon,authenticated;
grant all on table private.luxy_memberships to service_role;

create table private.luxy_upgrade_intents (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_tier public.luxy_membership_tier not null,
  source text not null default 'member_profile',
  status text not null default 'created',
  created_at timestamptz not null default now(),
  constraint luxy_upgrade_intents_paid_tier check(requested_tier in ('premium','diamond')),
  constraint luxy_upgrade_intents_source_check check(source ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint luxy_upgrade_intents_status_check check(status in ('created','checkout_started','completed','cancelled','expired'))
);

create index luxy_upgrade_intents_user_created_idx
  on private.luxy_upgrade_intents(user_id,created_at desc);

comment on table private.luxy_upgrade_intents is
  'LX-13 non-financial upgrade handoff. An intent records plan choice only and grants no entitlement.';

revoke all on table private.luxy_upgrade_intents from public,anon,authenticated;
grant all on table private.luxy_upgrade_intents to service_role;

create or replace function private.get_active_luxy_membership_tier(p_user_id uuid)
returns public.luxy_membership_tier
language sql
stable
security definer
set search_path=''
as $$
  select coalesce((
    select m.tier
    from private.luxy_memberships m
    where m.user_id=p_user_id
      and m.status='active'
      and m.tier in ('premium','diamond')
      and (m.starts_at is null or m.starts_at<=now())
      and (m.expires_at is null or m.expires_at>now())
    limit 1
  ),'free'::public.luxy_membership_tier)
$$;

create or replace function private.can_message_with_luxy_membership(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select coalesce((
    select m.messaging_enabled
    from private.luxy_memberships m
    where m.user_id=p_user_id
      and m.status='active'
      and m.tier in ('premium','diamond')
      and (m.starts_at is null or m.starts_at<=now())
      and (m.expires_at is null or m.expires_at>now())
    limit 1
  ),false)
$$;

revoke all on function private.get_active_luxy_membership_tier(uuid) from public,anon,authenticated;
revoke all on function private.can_message_with_luxy_membership(uuid) from public,anon,authenticated;
grant execute on function private.get_active_luxy_membership_tier(uuid) to service_role;
grant execute on function private.can_message_with_luxy_membership(uuid) to service_role;

create or replace function public.get_my_luxy_membership_snapshot()
returns table(
  tier public.luxy_membership_tier,
  can_message boolean,
  status text,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tier public.luxy_membership_tier;
begin
  if v_user_id is null then
    raise exception using errcode='28000',message='authentication_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode='42501',message='adult_onboarding_required';
  end if;

  v_tier := private.get_active_luxy_membership_tier(v_user_id);
  return query
  select
    v_tier,
    private.can_message_with_luxy_membership(v_user_id),
    case when v_tier='free' then 'free' else 'active' end,
    case when v_tier='free' then null else m.expires_at end
  from (select 1) seed
  left join private.luxy_memberships m
    on m.user_id=v_user_id
   and m.status='active'
   and m.tier=v_tier;
end;
$$;

revoke all on function public.get_my_luxy_membership_snapshot() from public,anon;
grant execute on function public.get_my_luxy_membership_snapshot() to authenticated,service_role;

create or replace function public.create_luxy_upgrade_intent(
  p_tier public.luxy_membership_tier,
  p_source text default 'member_profile'
)
returns uuid
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source text := lower(btrim(coalesce(p_source,'')));
  v_existing uuid;
  v_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode='28000',message='authentication_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode='42501',message='adult_onboarding_required';
  end if;
  if p_tier not in ('premium','diamond') then
    raise exception using errcode='22023',message='paid_membership_tier_required';
  end if;
  if v_source='' or v_source !~ '^[a-z][a-z0-9_]{1,63}$' then
    raise exception using errcode='22023',message='invalid_upgrade_source';
  end if;

  select i.id into v_existing
  from private.luxy_upgrade_intents i
  where i.user_id=v_user_id
    and i.requested_tier=p_tier
    and i.source=v_source
    and i.status='created'
    and i.created_at>now()-interval '60 seconds'
  order by i.created_at desc
  limit 1;

  if v_existing is not null then return v_existing; end if;

  insert into private.luxy_upgrade_intents(user_id,requested_tier,source)
  values(v_user_id,p_tier,v_source)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_luxy_upgrade_intent(public.luxy_membership_tier,text) from public,anon;
grant execute on function public.create_luxy_upgrade_intent(public.luxy_membership_tier,text) to authenticated,service_role;

comment on function public.create_luxy_upgrade_intent(public.luxy_membership_tier,text) is
  'LX-13 UX handoff only. Creates a server-side plan-choice intent and does not activate membership or perform payment.';

create or replace function public.get_luxy_member_profile(p_username text)
returns table(
  id uuid,
  username text,
  display_name text,
  headline text,
  bio text,
  gender public.gender_identity,
  interested_in public.dating_interest,
  age smallint,
  province_id bigint,
  province_name text,
  avatar_media_id uuid,
  avatar_storage_bucket text,
  avatar_storage_path text,
  interests text[],
  height_cm smallint,
  weight_kg smallint,
  relationship_status public.relationship_status,
  children_status public.children_status,
  smoking_status public.smoking_status,
  drinking_status public.drinking_status,
  education_level public.education_level,
  occupation text,
  looking_for text,
  lifestyle_tags public.profile_lifestyle_tag[],
  languages text[],
  last_active_at timestamptz,
  member_since timestamptz,
  public_photo_count integer,
  private_photo_count integer,
  membership_tier public.luxy_membership_tier,
  membership_badge_visible boolean,
  blocked_by_viewer boolean
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_viewer_id uuid := auth.uid();
  v_username text := lower(btrim(coalesce(p_username,'')));
  v_target_id uuid;
  v_blocked_by_viewer boolean := false;
begin
  if v_viewer_id is null then
    raise exception using errcode='28000',message='authentication_required';
  end if;
  if not private.is_active_adult(v_viewer_id) then
    raise exception using errcode='42501',message='adult_onboarding_required';
  end if;
  if v_username='' or char_length(v_username)>48 then
    raise exception using errcode='22023',message='profile_username_required';
  end if;

  select p.id into v_target_id
  from public.profiles p
  where lower(p.username::text)=v_username
    and p.profile_status='active'
    and p.deleted_at is null
    and private.is_active_adult(p.id)
  limit 1;

  if v_target_id is null then return; end if;
  if exists(select 1 from public.user_blocks b where b.blocker_id=v_target_id and b.blocked_id=v_viewer_id) then
    return;
  end if;
  select exists(select 1 from public.user_blocks b where b.blocker_id=v_viewer_id and b.blocked_id=v_target_id)
  into v_blocked_by_viewer;

  return query
  select
    p.id,
    p.username::text,
    p.display_name,
    p.headline,
    p.bio,
    p.gender,
    p.interested_in,
    extract(year from age(current_date,ui.date_of_birth))::smallint,
    p.province_id,
    area.name_vi,
    case when v_blocked_by_viewer then null else p.avatar_media_id end,
    case when v_blocked_by_viewer then null else avatar.storage_bucket end,
    case when v_blocked_by_viewer then null else avatar.storage_path end,
    coalesce(p.interests,'{}'::text[]),
    p.height_cm,
    p.weight_kg,
    p.relationship_status,
    p.children_status,
    p.smoking_status,
    p.drinking_status,
    p.education_level,
    p.occupation,
    p.looking_for,
    coalesce(p.lifestyle_tags,'{}'::public.profile_lifestyle_tag[]),
    coalesce(p.languages,'{}'::text[]),
    p.last_active_at,
    p.created_at,
    case when v_blocked_by_viewer then 0 else coalesce(pub.photo_count,0) end::integer,
    case when v_blocked_by_viewer then 0 else coalesce(priv.photo_count,0) end::integer,
    private.get_active_luxy_membership_tier(p.id),
    (private.get_active_luxy_membership_tier(p.id) in ('premium','diamond')),
    v_blocked_by_viewer
  from public.profiles p
  join private.user_identity ui on ui.user_id=p.id
  left join public.administrative_areas area
    on area.id=p.province_id and area.country_code='VN' and area.is_active
  left join public.media_assets avatar
    on avatar.id=p.avatar_media_id
   and avatar.owner_id=p.id
   and avatar.visibility='avatar'
   and avatar.moderation_status in ('pending_review','approved')
   and avatar.deleted_at is null
   and avatar.uploaded_at is not null
   and private.can_view_media_internal(avatar.id,v_viewer_id)
  left join lateral (
    select count(*)::integer photo_count
    from public.media_assets m
    where m.owner_id=p.id
      and m.visibility='public'
      and m.moderation_status in ('pending_review','approved')
      and m.deleted_at is null
      and m.uploaded_at is not null
      and private.can_view_media_internal(m.id,v_viewer_id)
  ) pub on true
  left join lateral (
    select count(*)::integer photo_count
    from public.media_assets m
    where m.owner_id=p.id
      and m.visibility='private'
      and m.moderation_status in ('pending_review','approved')
      and m.deleted_at is null
      and m.uploaded_at is not null
  ) priv on true
  where p.id=v_target_id;
end;
$$;

revoke all on function public.get_luxy_member_profile(text) from public,anon;
grant execute on function public.get_luxy_member_profile(text) to authenticated,service_role;

comment on function public.get_luxy_member_profile(text) is
  'LX-13 privacy-safe Seeking-derived Member Profile read model. Returns public dating fields, safe age, photo counts and paid-tier presentation only; never DOB, exact coordinates, KYC or financial data.';
