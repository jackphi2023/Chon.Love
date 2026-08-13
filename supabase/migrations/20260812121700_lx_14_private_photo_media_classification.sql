-- LX-14 hardening: `media_assets.visibility = private` is shared by more than one product surface.
-- Creator Activity originals are private Storage objects too, so the Private Photo workflow must
-- explicitly exclude media attached to Creator posts. This prevents a Private Photo approval from
-- becoming an accidental access path to Creator Activity content.

create or replace function private.is_luxy_private_photo_media(
  p_media_id uuid,
  p_owner_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.media_assets m
    where m.id=p_media_id
      and (p_owner_id is null or m.owner_id=p_owner_id)
      and m.visibility='private'
      and m.deleted_at is null
      and not exists(
        select 1
        from public.creator_post_media cpm
        where cpm.media_id=m.id
      )
  )
$$;

revoke all on function private.is_luxy_private_photo_media(uuid,uuid) from public,anon,authenticated;
grant execute on function private.is_luxy_private_photo_media(uuid,uuid) to service_role;

create or replace function private.can_view_media_internal(p_media_id uuid,p_viewer_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_media public.media_assets%rowtype;
begin
  if p_viewer_id is null then return false; end if;
  select * into v_media from public.media_assets where id=p_media_id;
  if not found or v_media.deleted_at is not null or v_media.moderation_status='deleted' then return false; end if;
  if v_media.owner_id=p_viewer_id then return true; end if;
  if v_media.moderation_status<>'approved' then return false; end if;
  if private.users_are_blocked(v_media.owner_id,p_viewer_id) then return false; end if;
  if not private.is_active_adult(v_media.owner_id) or not private.is_active_adult(p_viewer_id) then return false; end if;

  if v_media.visibility='private' then
    return private.is_luxy_private_photo_media(v_media.id,v_media.owner_id)
      and private.has_approved_private_photo_access(v_media.owner_id,p_viewer_id);
  end if;
  if v_media.visibility='kyc' then return false; end if;
  if v_media.visibility='avatar' then
    return exists(
      select 1 from public.profiles p
      where p.id=v_media.owner_id
        and p.avatar_media_id=v_media.id
        and p.profile_status='active'
        and p.deleted_at is null
    );
  end if;
  if v_media.visibility='public' then
    return exists(
      select 1 from public.album_media am
      join public.albums a on a.id=am.album_id
      where am.media_id=v_media.id
        and a.owner_id=v_media.owner_id
        and a.album_type='public'
        and a.is_active
        and a.deleted_at is null
    );
  end if;
  if v_media.visibility='fan' then
    return exists(
      select 1 from public.album_media am
      join public.albums a on a.id=am.album_id
      where am.media_id=v_media.id
        and a.owner_id=v_media.owner_id
        and a.album_type='fan'
        and a.is_active
        and a.deleted_at is null
    ) and private.has_active_fan_membership(v_media.owner_id,p_viewer_id);
  end if;
  return false;
end;
$$;

-- Preserve the BR-06 Storage/RLS execution contract. Client roles still have no USAGE on `private`.
revoke all on function private.can_view_media_internal(uuid,uuid) from public,anon,authenticated;
grant execute on function private.can_view_media_internal(uuid,uuid) to anon,authenticated,service_role;

create or replace function public.get_private_photo_access_state(p_owner_id uuid)
returns table(
  request_id uuid,
  status text,
  has_access boolean,
  can_request boolean,
  private_photo_count integer
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request private.private_photo_access_requests%rowtype;
  v_count integer := 0;
  v_target_available boolean := false;
begin
  if v_user_id is null then
    raise exception using errcode='28000',message='authentication_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode='42501',message='adult_onboarding_required';
  end if;
  if p_owner_id is null or p_owner_id=v_user_id then
    raise exception using errcode='22023',message='invalid_private_photo_target';
  end if;

  v_target_available := private.is_active_adult(p_owner_id)
    and not private.users_are_blocked(v_user_id,p_owner_id)
    and exists(
      select 1 from public.profiles p
      where p.id=p_owner_id and p.profile_status='active' and p.deleted_at is null
    );

  if not v_target_available then
    return query select null::uuid,'unavailable'::text,false,false,0;
    return;
  end if;

  select count(*)::integer into v_count
  from public.media_assets m
  where m.owner_id=p_owner_id
    and m.moderation_status='approved'
    and m.deleted_at is null
    and private.is_luxy_private_photo_media(m.id,p_owner_id);

  select * into v_request
  from private.private_photo_access_requests r
  where r.owner_id=p_owner_id and r.requester_id=v_user_id;

  return query select
    v_request.id,
    coalesce(v_request.status,'not_requested'),
    coalesce(v_request.status='approved' and private.has_active_luxy_paid_membership(v_user_id),false),
    (v_count>0 and private.has_active_luxy_paid_membership(v_user_id) and coalesce(v_request.status,'')<>'approved'),
    v_count;
end;
$$;

create or replace function public.request_private_photo_access(p_owner_id uuid)
returns table(request_id uuid,status text,requested_at timestamptz)
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request private.private_photo_access_requests%rowtype;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='adult_onboarding_required'; end if;
  if not private.has_active_luxy_paid_membership(v_user_id) then
    raise exception using errcode='42501',message='premium_membership_required';
  end if;
  if p_owner_id is null or p_owner_id=v_user_id then raise exception using errcode='22023',message='invalid_private_photo_target'; end if;
  if private.users_are_blocked(v_user_id,p_owner_id)
    or not private.is_active_adult(p_owner_id)
    or not exists(select 1 from public.profiles p where p.id=p_owner_id and p.profile_status='active' and p.deleted_at is null) then
    raise exception using errcode='42501',message='private_photo_target_not_available';
  end if;
  if not exists(
    select 1 from public.media_assets m
    where m.owner_id=p_owner_id
      and m.moderation_status='approved'
      and m.deleted_at is null
      and private.is_luxy_private_photo_media(m.id,p_owner_id)
  ) then
    raise exception using errcode='42501',message='private_photo_not_available';
  end if;

  select * into v_request
  from private.private_photo_access_requests r
  where r.owner_id=p_owner_id and r.requester_id=v_user_id
  for update;

  if found and v_request.status='approved' then
    return query select v_request.id,v_request.status,v_request.requested_at;
    return;
  end if;

  insert into private.private_photo_access_requests(owner_id,requester_id,status,requested_at,responded_at,updated_at)
  values(p_owner_id,v_user_id,'pending',now(),null,now())
  on conflict(owner_id,requester_id) do update set
    status='pending',requested_at=now(),responded_at=null,updated_at=now()
  returning * into v_request;

  return query select v_request.id,v_request.status,v_request.requested_at;
end;
$$;

create or replace function public.list_profile_private_media(p_owner_id uuid)
returns table(
  media_id uuid,
  storage_bucket text,
  storage_path text,
  width integer,
  height integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='adult_onboarding_required'; end if;
  if p_owner_id is null or p_owner_id=v_user_id then raise exception using errcode='22023',message='invalid_private_photo_target'; end if;
  if private.users_are_blocked(v_user_id,p_owner_id) or not private.is_active_adult(p_owner_id) then
    return;
  end if;
  if not private.has_approved_private_photo_access(p_owner_id,v_user_id) then
    raise exception using errcode='42501',message=case
      when private.has_active_luxy_paid_membership(v_user_id) then 'private_photo_approval_required'
      else 'premium_membership_required'
    end;
  end if;

  return query
  select m.id,m.storage_bucket,m.storage_path,m.width,m.height,m.created_at
  from public.media_assets m
  where m.owner_id=p_owner_id
    and m.moderation_status='approved'
    and m.deleted_at is null
    and private.is_luxy_private_photo_media(m.id,p_owner_id)
    and private.can_view_media_internal(m.id,v_user_id)
  order by m.created_at desc,m.id;
end;
$$;

-- LX-13 exposed a safe count before LX-14 existed. Now that Private Photo is a real workflow,
-- count only approved media classified as Private Photo and never Creator Activity originals.
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
      and m.moderation_status='approved'
      and m.deleted_at is null
      and m.uploaded_at is not null
      and private.is_luxy_private_photo_media(m.id,p.id)
  ) priv on true
  where p.id=v_target_id;
end;
$$;

revoke all on function public.get_luxy_member_profile(text) from public,anon;
grant execute on function public.get_luxy_member_profile(text) to authenticated,service_role;

comment on function private.is_luxy_private_photo_media(uuid,uuid) is
  'LX-14 media classifier: private profile-photo library only; explicitly excludes Creator Activity media.';
comment on function public.get_luxy_member_profile(text) is
  'LX-14-hardened LX-13 Member Profile read model. Private-photo count excludes Creator Activity originals.';
