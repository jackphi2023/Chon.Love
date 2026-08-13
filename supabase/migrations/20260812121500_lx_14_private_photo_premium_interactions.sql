-- LX-14: Private Photo request/access workflow + Premium interaction policy.
--
-- Product policy override (2026-08-12):
-- - Free members may browse profiles but cannot ADD Favorite/Interest, request Private Photos,
--   or start messaging from a member profile. Those actions require active Premium/Diamond.
-- - Removing an existing Favorite always remains available, including after downgrade.
-- - Private Photo access is explicit owner approval only and is re-checked at view time.
-- - Gifts, Fan memberships and friendship state NEVER grant Private Photo access.
-- - LX-15 still owns removal of the legacy friendship prerequisite / final messaging architecture.
-- - LX-17/LX-18 remain the authoritative membership engine and billing sessions.

create table private.private_photo_access_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint private_photo_access_not_self check(owner_id<>requester_id),
  constraint private_photo_access_status_check check(status in ('pending','approved','declined','revoked')),
  unique(owner_id,requester_id)
);

create index private_photo_access_owner_status_idx
  on private.private_photo_access_requests(owner_id,status,requested_at desc);
create index private_photo_access_requester_status_idx
  on private.private_photo_access_requests(requester_id,status,requested_at desc);

comment on table private.private_photo_access_requests is
  'LX-14 explicit owner-controlled Private Photo access. No gift, Fan or friendship unlock is accepted.';

revoke all on table private.private_photo_access_requests from public,anon,authenticated;
grant all on table private.private_photo_access_requests to service_role;

create or replace function private.has_active_luxy_paid_membership(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select private.get_active_luxy_membership_tier(p_user_id) in ('premium','diamond')
$$;

create or replace function private.has_approved_private_photo_access(p_owner_id uuid,p_viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select p_owner_id=p_viewer_id or (
    private.has_active_luxy_paid_membership(p_viewer_id)
    and exists(
      select 1
      from private.private_photo_access_requests r
      where r.owner_id=p_owner_id
        and r.requester_id=p_viewer_id
        and r.status='approved'
    )
  )
$$;

revoke all on function private.has_active_luxy_paid_membership(uuid) from public,anon,authenticated;
revoke all on function private.has_approved_private_photo_access(uuid,uuid) from public,anon,authenticated;
grant execute on function private.has_active_luxy_paid_membership(uuid) to service_role;
grant execute on function private.has_approved_private_photo_access(uuid,uuid) to service_role;

-- Extend the central media authorization helper. Private media is visible only after owner approval
-- AND while the viewer still has an active paid Luxy membership. Gift/Fan state is intentionally absent.
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
    return private.has_approved_private_photo_access(v_media.owner_id,p_viewer_id);
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

revoke all on function private.can_view_media_internal(uuid,uuid) from public,anon,authenticated;

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
    and m.visibility='private'
    and m.moderation_status='approved'
    and m.deleted_at is null;

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
      and m.visibility='private'
      and m.moderation_status='approved'
      and m.deleted_at is null
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

create or replace function public.respond_private_photo_access(p_request_id uuid,p_decision text)
returns table(request_id uuid,status text,responded_at timestamptz)
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_decision text := lower(btrim(coalesce(p_decision,'')));
  v_request private.private_photo_access_requests%rowtype;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='adult_onboarding_required'; end if;
  if v_decision not in ('approved','declined') then raise exception using errcode='22023',message='invalid_private_photo_decision'; end if;

  select * into v_request
  from private.private_photo_access_requests r
  where r.id=p_request_id and r.owner_id=v_user_id
  for update;
  if not found then raise exception using errcode='42501',message='private_photo_request_not_available'; end if;
  if private.users_are_blocked(v_request.owner_id,v_request.requester_id) then
    raise exception using errcode='42501',message='private_photo_request_not_available';
  end if;

  update private.private_photo_access_requests
  set status=v_decision,responded_at=now(),updated_at=now()
  where id=v_request.id
  returning * into v_request;

  return query select v_request.id,v_request.status,v_request.responded_at;
end;
$$;

create or replace function public.revoke_private_photo_access(p_request_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path=''
as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='adult_onboarding_required'; end if;
  update private.private_photo_access_requests
  set status='revoked',responded_at=now(),updated_at=now()
  where id=p_request_id and owner_id=v_user_id and status='approved';
  return found;
end;
$$;

create or replace function public.list_received_private_photo_requests(p_status text default null)
returns table(
  request_id uuid,
  requester_id uuid,
  username text,
  display_name text,
  avatar_media_id uuid,
  avatar_storage_bucket text,
  avatar_storage_path text,
  status text,
  requested_at timestamptz,
  responded_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text := case when p_status is null then null else lower(btrim(p_status)) end;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='adult_onboarding_required'; end if;
  if v_status is not null and v_status not in ('pending','approved','declined','revoked') then
    raise exception using errcode='22023',message='invalid_private_photo_status';
  end if;

  return query
  select r.id,p.id,p.username::text,p.display_name,p.avatar_media_id,
         case when a.id is null then null else a.storage_bucket end,
         case when a.id is null then null else a.storage_path end,
         r.status,r.requested_at,r.responded_at
  from private.private_photo_access_requests r
  join public.profiles p on p.id=r.requester_id
  left join public.media_assets a
    on a.id=p.avatar_media_id and private.can_view_media_internal(a.id,v_user_id)
  where r.owner_id=v_user_id
    and (v_status is null or r.status=v_status)
    and p.deleted_at is null
    and not private.users_are_blocked(v_user_id,p.id)
  order by case when r.status='pending' then 0 else 1 end,r.requested_at desc,r.id;
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
    and m.visibility='private'
    and m.moderation_status='approved'
    and m.deleted_at is null
    and private.can_view_media_internal(m.id,v_user_id)
  order by m.created_at desc,m.id;
end;
$$;

-- Product-policy override: adding Favorite/Interest requires paid membership.
-- Removal remains available after downgrade to preserve user control.
create or replace function public.set_profile_favorite(p_profile_id uuid,p_favorited boolean)
returns table(is_favorited boolean,is_favorited_by boolean,is_match boolean)
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reverse boolean := false;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='adult_onboarding_required'; end if;
  if p_profile_id is null or p_profile_id=v_user_id then raise exception using errcode='22023',message='invalid_favorite_target'; end if;
  if p_favorited is null then raise exception using errcode='22023',message='invalid_favorite_state'; end if;

  if p_favorited then
    if not private.has_active_luxy_paid_membership(v_user_id) then
      raise exception using errcode='42501',message='premium_membership_required';
    end if;
    if not private.is_active_adult(p_profile_id)
      or private.users_are_blocked(v_user_id,p_profile_id)
      or not exists(select 1 from public.profiles p where p.id=p_profile_id and p.profile_status='active' and p.deleted_at is null) then
      raise exception using errcode='42501',message='favorite_target_not_available';
    end if;
    insert into public.profile_favorites(owner_id,favorite_id)
    values(v_user_id,p_profile_id)
    on conflict(owner_id,favorite_id) do nothing;
  else
    delete from public.profile_favorites where owner_id=v_user_id and favorite_id=p_profile_id;
  end if;

  if not private.users_are_blocked(v_user_id,p_profile_id) then
    select exists(select 1 from public.profile_favorites f where f.owner_id=p_profile_id and f.favorite_id=v_user_id)
      into v_reverse;
  end if;

  return query select
    exists(select 1 from public.profile_favorites f where f.owner_id=v_user_id and f.favorite_id=p_profile_id),
    v_reverse,
    exists(
      select 1 from public.profile_favorites mine
      join public.profile_favorites theirs
        on theirs.owner_id=p_profile_id and theirs.favorite_id=v_user_id
      where mine.owner_id=v_user_id and mine.favorite_id=p_profile_id
    );
end;
$$;

-- Profile-originated conversation lookup receives a paid membership gate now.
-- Legacy friendship lookup remains intact until LX-15 removes that prerequisite.
create or replace function public.get_luxy_profile_conversation(p_profile_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='adult_onboarding_required'; end if;
  if not private.can_message_with_luxy_membership(v_user_id) then
    raise exception using errcode='42501',message='premium_membership_required';
  end if;
  return public.get_direct_conversation(p_profile_id);
end;
$$;

-- Extend the membership presentation contract with the two LX-14 interaction entitlements.
drop function public.get_my_luxy_membership_snapshot();
create function public.get_my_luxy_membership_snapshot()
returns table(
  tier public.luxy_membership_tier,
  can_message boolean,
  can_favorite boolean,
  can_request_private_photo boolean,
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
  v_paid boolean;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='adult_onboarding_required'; end if;
  v_tier:=private.get_active_luxy_membership_tier(v_user_id);
  v_paid:=v_tier in ('premium','diamond');
  return query
  select v_tier,
         private.can_message_with_luxy_membership(v_user_id),
         v_paid,
         v_paid,
         case when v_tier='free' then 'free' else 'active' end,
         case when v_tier='free' then null else m.expires_at end
  from (select 1) seed
  left join private.luxy_memberships m
    on m.user_id=v_user_id and m.status='active' and m.tier=v_tier;
end;
$$;

revoke all on function public.get_private_photo_access_state(uuid) from public,anon;
revoke all on function public.request_private_photo_access(uuid) from public,anon;
revoke all on function public.respond_private_photo_access(uuid,text) from public,anon;
revoke all on function public.revoke_private_photo_access(uuid) from public,anon;
revoke all on function public.list_received_private_photo_requests(text) from public,anon;
revoke all on function public.list_profile_private_media(uuid) from public,anon;
revoke all on function public.get_luxy_profile_conversation(uuid) from public,anon;
revoke all on function public.get_my_luxy_membership_snapshot() from public,anon;

grant execute on function public.get_private_photo_access_state(uuid) to authenticated,service_role;
grant execute on function public.request_private_photo_access(uuid) to authenticated,service_role;
grant execute on function public.respond_private_photo_access(uuid,text) to authenticated,service_role;
grant execute on function public.revoke_private_photo_access(uuid) to authenticated,service_role;
grant execute on function public.list_received_private_photo_requests(text) to authenticated,service_role;
grant execute on function public.list_profile_private_media(uuid) to authenticated,service_role;
grant execute on function public.get_luxy_profile_conversation(uuid) to authenticated,service_role;
grant execute on function public.get_my_luxy_membership_snapshot() to authenticated,service_role;

comment on function public.request_private_photo_access(uuid) is
  'LX-14 Premium/Diamond-only Private Photo request. Access requires explicit owner approval and is never gift-unlocked.';
comment on function public.set_profile_favorite(uuid,boolean) is
  'LX-14 policy: Premium/Diamond required to add Favorite/Interest; removal remains available after downgrade.';
comment on function public.get_luxy_profile_conversation(uuid) is
  'LX-14 profile CTA paid gate; delegates to legacy friendship conversation lookup until LX-15.';
