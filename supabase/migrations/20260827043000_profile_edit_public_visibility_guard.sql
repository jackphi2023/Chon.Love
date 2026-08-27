-- Profile Edit: separate direct public-profile sharing from Connect discovery without
-- weakening admin moderation. `discovery_enabled` remains the member-controlled
-- Connect/Search preference; this private guard is the moderation source of truth
-- for both Search listing and direct public profile availability.

create table if not exists private.chon_public_profile_moderation (
  user_id uuid primary key references auth.users(id) on delete cascade,
  admin_hidden boolean not null default false,
  updated_at timestamptz not null default now()
);

revoke all on table private.chon_public_profile_moderation from public, anon, authenticated;
grant all on table private.chon_public_profile_moderation to service_role;

-- Preserve any existing admin-hide decisions by replaying the latest canonical
-- hide/unhide audit action per user. Ordinary member discovery choices do not
-- create an admin restriction.
with latest_admin_visibility as (
  select distinct on (a.target_id)
    a.target_id as user_id,
    a.action
  from private.admin_audit_logs a
  where a.target_type = 'user'
    and a.action in ('luxy_user_hidden', 'luxy_user_unhidden')
  order by a.target_id, a.created_at desc, a.id desc
)
insert into private.chon_public_profile_moderation(user_id, admin_hidden, updated_at)
select user_id, action = 'luxy_user_hidden', now()
from latest_admin_visibility
on conflict (user_id) do update
set admin_hidden = excluded.admin_hidden,
    updated_at = excluded.updated_at;

create or replace function private.is_chon_public_profile_allowed(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_adult(p_user_id)
    and not coalesce((
      select m.admin_hidden
      from private.chon_public_profile_moderation m
      where m.user_id = p_user_id
    ), false)
$$;

revoke all on function private.is_chon_public_profile_allowed(uuid) from public, anon, authenticated;
grant execute on function private.is_chon_public_profile_allowed(uuid) to service_role;

comment on function private.is_chon_public_profile_allowed(uuid) is
  'Direct public-profile guard: active adult account and not hidden by admin. Connect discovery preference is intentionally independent.';

-- Search V2 already evaluates profile/account/discovery eligibility. Add the
-- moderation guard here so an admin-hidden member cannot self-enable discovery
-- and re-enter Connect. Preserve Diamond hide-from-listing privacy.
create or replace function private.luxy_listing_hidden(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((
      select m.admin_hidden
      from private.chon_public_profile_moderation m
      where m.user_id = p_user_id
    ), false)
    or case
      when private.get_active_luxy_membership_tier(p_user_id) = 'diamond'
      then coalesce((
        select s.hide_from_listing
        from private.luxy_membership_privacy s
        where s.user_id = p_user_id
      ), false)
      else false
    end
$$;

revoke all on function private.luxy_listing_hidden(uuid) from public, anon, authenticated;
grant execute on function private.luxy_listing_hidden(uuid) to service_role;

create or replace function public.admin_set_luxy_user_discovery(
  p_actor_user_id uuid,
  p_user_id uuid,
  p_hidden boolean,
  p_reason text,
  p_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role private.user_role;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_before jsonb;
  v_after jsonb;
  v_public_hidden boolean;
begin
  v_actor_role := private.actor_role_for(p_actor_user_id, array['super_admin']::private.user_role[]);
  if char_length(v_reason) < 3 or p_request_id is null then
    raise exception using errcode='22023', message='reason_and_request_id_required';
  end if;

  select jsonb_build_object(
    'profile_status', p.profile_status,
    'discovery_enabled', p.discovery_enabled,
    'nearby_enabled', p.nearby_enabled,
    'public_profile_admin_hidden', coalesce(m.admin_hidden, false)
  )
  into v_before
  from public.profiles p
  left join private.chon_public_profile_moderation m on m.user_id = p.id
  where p.id = p_user_id
  for update of p;

  if v_before is null then
    raise exception using errcode='P0002', message='user_not_found';
  end if;
  if p_hidden = false and (v_before->>'profile_status') <> 'active' then
    raise exception using errcode='22023', message='inactive_user_cannot_be_unhidden';
  end if;

  insert into private.chon_public_profile_moderation(user_id, admin_hidden, updated_at)
  values(p_user_id, p_hidden, now())
  on conflict (user_id) do update
  set admin_hidden = excluded.admin_hidden,
      updated_at = excluded.updated_at;

  update public.profiles
  set discovery_enabled = not p_hidden,
      nearby_enabled = case when p_hidden then false else nearby_enabled end,
      updated_at = now()
  where id = p_user_id;

  select m.admin_hidden
  into v_public_hidden
  from private.chon_public_profile_moderation m
  where m.user_id = p_user_id;

  select jsonb_build_object(
    'profile_status', p.profile_status,
    'discovery_enabled', p.discovery_enabled,
    'nearby_enabled', p.nearby_enabled,
    'public_profile_admin_hidden', coalesce(v_public_hidden, false)
  )
  into v_after
  from public.profiles p
  where p.id = p_user_id;

  perform private.append_admin_audit(
    p_actor_user_id,
    v_actor_role,
    case when p_hidden then 'luxy_user_hidden' else 'luxy_user_unhidden' end,
    'user',
    p_user_id,
    v_before,
    v_after,
    v_reason,
    p_request_id,
    null,
    null
  );

  return not p_hidden;
end;
$$;

revoke all on function public.admin_set_luxy_user_discovery(uuid, uuid, boolean, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_set_luxy_user_discovery(uuid, uuid, boolean, text, uuid) to service_role;

create or replace function public.resolve_chon_member_route(p_identifier text)
returns table(public_profile_code text, username extensions.citext)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='authentication_required';
  end if;

  return query
  select p.public_profile_code, p.username
  from public.profiles p
  where private.is_chon_public_profile_allowed(p.id)
    and (
      p.public_profile_code = lower(btrim(coalesce(p_identifier, '')))
      or lower(p.username::text) = lower(btrim(coalesce(p_identifier, '')))
    )
  order by case when p.public_profile_code = lower(btrim(coalesce(p_identifier, ''))) then 0 else 1 end
  limit 1;
end;
$$;

create or replace function public.get_public_chon_profile(p_code text)
returns table(
  public_profile_code text,
  display_name text,
  headline text,
  bio text,
  gender public.gender_identity,
  age smallint,
  province_name text,
  interests text[],
  height_cm smallint,
  relationship_status public.relationship_status,
  education_level public.education_level,
  occupation text,
  looking_for text,
  membership_tier public.luxy_membership_tier,
  membership_badge_visible boolean,
  member_since timestamptz,
  avatar_available boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.public_profile_code,
    p.display_name,
    p.headline,
    p.bio,
    p.gender,
    extract(year from age(current_date, ui.date_of_birth))::smallint,
    area.name_vi,
    coalesce(p.interests, '{}'::text[]),
    p.height_cm,
    p.relationship_status,
    p.education_level,
    p.occupation,
    p.looking_for,
    private.get_active_luxy_membership_tier(p.id),
    private.get_active_luxy_membership_tier(p.id) in ('premium','diamond'),
    p.created_at,
    exists (
      select 1
      from public.media_assets m
      where m.id = p.avatar_media_id
        and m.owner_id = p.id
        and m.visibility = 'avatar'
        and m.moderation_status = 'approved'
        and m.deleted_at is null
        and m.uploaded_at is not null
    )
  from public.profiles p
  join private.user_identity ui on ui.user_id = p.id
  left join public.administrative_areas area
    on area.id = p.province_id and area.country_code = 'VN' and area.is_active
  where p.public_profile_code = lower(btrim(coalesce(p_code, '')))
    and private.is_chon_public_profile_allowed(p.id)
  limit 1
$$;

create or replace function public.get_public_chon_profile_v2(p_code text)
returns table(
  public_profile_code text,
  display_name text,
  headline text,
  bio text,
  gender public.gender_identity,
  age smallint,
  province_name text,
  interests text[],
  height_cm smallint,
  occupation text,
  education_level public.education_level,
  relationship_status public.relationship_status,
  looking_for text,
  membership_tier public.luxy_membership_tier,
  membership_badge_visible boolean,
  member_since timestamptz,
  avatar_available boolean,
  interested_in public.dating_interest,
  weight_kg smallint,
  children_status public.children_status,
  smoking_status public.smoking_status,
  drinking_status public.drinking_status,
  lifestyle_tags public.profile_lifestyle_tag[],
  public_media_ids uuid[],
  private_photo_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.public_profile_code,p.display_name,p.headline,p.bio,p.gender,
    extract(year from age(current_date,ui.date_of_birth))::smallint,
    area.name_vi,coalesce(p.interests,'{}'::text[]),p.height_cm,
    p.occupation,p.education_level,p.relationship_status,p.looking_for,
    private.get_active_luxy_membership_tier(p.id),
    private.get_active_luxy_membership_tier(p.id) in ('premium','diamond'),
    p.created_at,
    exists(
      select 1 from public.media_assets m
      where m.id=p.avatar_media_id and m.owner_id=p.id and m.visibility='avatar'
        and m.moderation_status='approved' and m.deleted_at is null and m.uploaded_at is not null
    ),
    p.interested_in,p.weight_kg,p.children_status,p.smoking_status,p.drinking_status,
    coalesce(p.lifestyle_tags,'{}'::public.profile_lifestyle_tag[]),
    coalesce(pub.media_ids,'{}'::uuid[]),coalesce(priv.photo_count,0)::integer
  from public.profiles p
  join private.user_identity ui on ui.user_id=p.id
  left join public.administrative_areas area
    on area.id=p.province_id and area.country_code='VN' and area.is_active
  left join lateral (
    select array_agg(m.id order by m.uploaded_at desc,m.id) media_ids
    from public.media_assets m
    where m.owner_id=p.id and m.visibility='public' and m.moderation_status='approved'
      and m.deleted_at is null and m.uploaded_at is not null
  ) pub on true
  left join lateral (
    select count(*)::integer photo_count
    from public.media_assets m
    where m.owner_id=p.id and m.visibility='private' and m.moderation_status='approved'
      and m.deleted_at is null and m.uploaded_at is not null
  ) priv on true
  where p.public_profile_code=lower(btrim(coalesce(p_code,'')))
    and private.is_chon_public_profile_allowed(p.id)
  limit 1
$$;

comment on table private.chon_public_profile_moderation is
  'Admin-only moderation state separating direct public-profile availability from member-controlled Connect discovery.';
