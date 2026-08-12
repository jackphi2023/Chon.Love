-- LX-13 follow-up: keep the paid certification signal scoped to paid male profiles.
-- Membership state remains server-controlled and this presentation rule never grants entitlement.

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
    (
      p.gender='male'::public.gender_identity
      and private.get_active_luxy_membership_tier(p.id) in ('premium','diamond')
    ),
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
  'LX-13 privacy-safe Seeking-derived Member Profile read model. Paid badge is visible only for active paid male profiles; returns safe age/photo counts and never DOB, exact coordinates, KYC or financial data.';
