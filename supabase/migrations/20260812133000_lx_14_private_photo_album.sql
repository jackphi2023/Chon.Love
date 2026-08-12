-- LX-14 Private Photo Album
-- Owner-approved private-photo request/grant flow. Private media stays in the existing
-- private Storage pipeline; payment/membership never grants access.

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_type t
    join pg_catalog.pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'private_photo_access_status'
  ) then
    create type public.private_photo_access_status as enum ('pending','approved','rejected','revoked');
  end if;
end
$$;

create table if not exists public.private_photo_access_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  status public.private_photo_access_status not null default 'pending',
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint private_photo_access_not_self check (owner_id <> requester_id),
  constraint private_photo_access_response_shape check (
    (status = 'pending' and responded_at is null and revoked_at is null)
    or (status in ('approved','rejected') and responded_at is not null and revoked_at is null)
    or (status = 'revoked' and responded_at is not null and revoked_at is not null)
  ),
  unique(owner_id, requester_id)
);

comment on table public.private_photo_access_requests is
  'LX-14 owner-controlled grants for private profile photos. No membership or payment entitlement is consulted.';

create index if not exists private_photo_access_owner_status_requested_idx
  on public.private_photo_access_requests(owner_id, status, requested_at desc);
create index if not exists private_photo_access_requester_status_requested_idx
  on public.private_photo_access_requests(requester_id, status, requested_at desc);

alter table public.private_photo_access_requests enable row level security;
alter table public.private_photo_access_requests force row level security;
revoke all on table public.private_photo_access_requests from public, anon, authenticated;

create or replace function private.set_private_photo_access_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_private_photo_access_updated_at() from public, anon, authenticated;

drop trigger if exists private_photo_access_set_updated_at on public.private_photo_access_requests;
create trigger private_photo_access_set_updated_at
before update on public.private_photo_access_requests
for each row execute function private.set_private_photo_access_updated_at();

create or replace function private.has_private_photo_access(p_owner_id uuid, p_viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_owner_id is null or p_viewer_id is null or p_owner_id = p_viewer_id then false
    when not private.is_active_adult(p_owner_id) or not private.is_active_adult(p_viewer_id) then false
    when private.users_are_blocked(p_owner_id, p_viewer_id) then false
    else exists (
      select 1
      from public.private_photo_access_requests r
      where r.owner_id = p_owner_id
        and r.requester_id = p_viewer_id
        and r.status = 'approved'::public.private_photo_access_status
        and r.revoked_at is null
    )
  end
$$;

revoke all on function private.has_private_photo_access(uuid,uuid) from public, anon, authenticated;

-- Private media becomes album-eligible in LX-14. Avatar and KYC remain forbidden.
create or replace function private.validate_album_media_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_album public.albums%rowtype;
  v_media public.media_assets%rowtype;
begin
  select * into v_album from public.albums where id = new.album_id;
  select * into v_media from public.media_assets where id = new.media_id;
  if v_album.id is null or v_media.id is null then
    raise exception using errcode='23503', message='album_or_media_not_found';
  end if;
  if v_album.owner_id <> v_media.owner_id then
    raise exception using errcode='42501', message='album_media_owner_mismatch';
  end if;
  if v_media.visibility in ('kyc','avatar') then
    raise exception using errcode='22023', message='media_visibility_not_album_eligible';
  end if;
  if (v_album.album_type = 'public' and v_media.visibility <> 'public')
     or (v_album.album_type = 'fan' and v_media.visibility <> 'fan')
     or (v_album.album_type = 'private' and v_media.visibility <> 'private')
  then
    raise exception using errcode='22023', message='album_media_visibility_mismatch';
  end if;
  if v_album.deleted_at is not null or v_media.deleted_at is not null then
    raise exception using errcode='22023', message='deleted_album_or_media';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_album_media_owner() from public, anon, authenticated;

-- Backfill one active private album for any owner who already has private media.
insert into public.albums(owner_id, name, album_type, fan_threshold_units)
select distinct m.owner_id, 'Ảnh riêng tư', 'private'::public.album_type, 0
from public.media_assets m
where m.visibility = 'private'
  and m.deleted_at is null
  and not exists (
    select 1 from public.albums a
    where a.owner_id = m.owner_id
      and a.album_type = 'private'
      and a.is_active
      and a.deleted_at is null
  );

insert into public.album_media(album_id, media_id, sort_order)
select a.id, m.id, 0
from public.media_assets m
join lateral (
  select a0.id
  from public.albums a0
  where a0.owner_id = m.owner_id
    and a0.album_type = 'private'
    and a0.is_active
    and a0.deleted_at is null
  order by a0.created_at, a0.id
  limit 1
) a on true
where m.visibility = 'private'
  and m.deleted_at is null
on conflict (album_id, media_id) do nothing;

-- Preserve post-moderated public/fan behavior while allowing an approved owner grant
-- for private album media. KYC remains owner/server-only.
create or replace function private.can_view_media_internal(p_media_id uuid, p_viewer_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_media public.media_assets%rowtype;
begin
  if p_viewer_id is null then return false; end if;
  select * into v_media from public.media_assets where id = p_media_id;
  if not found or v_media.deleted_at is not null or v_media.moderation_status = 'deleted' then return false; end if;

  if v_media.owner_id = p_viewer_id then
    return v_media.visibility <> 'kyc'
      and v_media.moderation_status in ('pending_upload','pending_review','approved','rejected','quarantined');
  end if;

  if v_media.moderation_status not in ('pending_review','approved')
     or v_media.visibility = 'kyc'
     or v_media.uploaded_at is null
  then
    return false;
  end if;
  if private.users_are_blocked(v_media.owner_id, p_viewer_id) then return false; end if;
  if not private.is_active_adult(v_media.owner_id) or not private.is_active_adult(p_viewer_id) then return false; end if;

  if v_media.visibility = 'private' then
    return exists (
      select 1
      from public.album_media am
      join public.albums a on a.id = am.album_id
      where am.media_id = v_media.id
        and a.owner_id = v_media.owner_id
        and a.album_type = 'private'
        and a.is_active
        and a.deleted_at is null
    ) and private.has_private_photo_access(v_media.owner_id, p_viewer_id);
  end if;
  if v_media.visibility = 'avatar' then
    return exists (
      select 1 from public.profiles p
      where p.id = v_media.owner_id
        and p.avatar_media_id = v_media.id
        and p.profile_status = 'active'
        and p.deleted_at is null
    );
  end if;
  if v_media.visibility = 'public' then
    return exists (
      select 1
      from public.album_media am
      join public.albums a on a.id = am.album_id
      where am.media_id = v_media.id
        and a.owner_id = v_media.owner_id
        and a.album_type = 'public'
        and a.is_active
        and a.deleted_at is null
    );
  end if;
  if v_media.visibility = 'fan' then
    return exists (
      select 1
      from public.album_media am
      join public.albums a on a.id = am.album_id
      where am.media_id = v_media.id
        and a.owner_id = v_media.owner_id
        and a.album_type = 'fan'
        and a.is_active
        and a.deleted_at is null
    ) and private.has_active_fan_membership(v_media.owner_id, p_viewer_id);
  end if;
  return false;
end;
$$;

revoke all on function private.can_view_media_internal(uuid,uuid) from public, anon, authenticated;

-- Extend the existing uploader: private uploads are now attached to an active private album.
create or replace function public.finalize_media_upload(p_media_id uuid)
returns public.media_assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_media public.media_assets;
  v_case_id uuid;
  v_album_id uuid;
  v_threshold bigint;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  select * into v_media
  from public.media_assets
  where id = p_media_id and owner_id = v_user_id
  for update;
  if not found or v_media.moderation_status <> 'pending_upload' then
    raise exception using errcode = '42501', message = 'pending_upload_not_available';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = v_media.storage_bucket
      and o.name = v_media.storage_path
      and o.owner_id = v_user_id::text
  ) then
    raise exception using errcode = '23503', message = 'storage_object_not_found';
  end if;

  update public.media_assets
  set moderation_status = 'pending_review', uploaded_at = now()
  where id = p_media_id
  returning * into v_media;

  insert into public.moderation_cases(media_id, source, status, priority, rule_codes)
  values (p_media_id, 'upload', 'queued', 'normal', '{}')
  returning id into v_case_id;

  if v_media.visibility = 'avatar' then
    update public.profiles set avatar_media_id = v_media.id where id = v_user_id;
  elsif v_media.visibility in ('public','fan','private') then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_user_id::text || ':' || v_media.visibility::text, 0)
    );
    select a.id into v_album_id
    from public.albums a
    where a.owner_id = v_user_id
      and a.album_type::text = v_media.visibility::text
      and a.is_active
      and a.deleted_at is null
    order by a.created_at, a.id
    limit 1;

    if v_album_id is null then
      if v_media.visibility = 'fan' then
        select coalesce((c.value_json #>> '{}')::bigint, 1000)
        into v_threshold
        from private.app_config c
        where c.key = 'fan_minimum_units';
        v_threshold := coalesce(v_threshold, 1000);
      else
        v_threshold := 0;
      end if;
      insert into public.albums(owner_id, name, album_type, fan_threshold_units)
      values (
        v_user_id,
        case
          when v_media.visibility = 'fan' then 'Album Fan'
          when v_media.visibility = 'private' then 'Ảnh riêng tư'
          else 'Ảnh công khai'
        end,
        v_media.visibility::text::public.album_type,
        v_threshold
      )
      returning id into v_album_id;
    end if;

    insert into public.album_media(album_id, media_id, sort_order)
    values (v_album_id, v_media.id, 0)
    on conflict (album_id, media_id) do nothing;
  end if;

  return v_media;
end;
$$;

revoke all on function public.finalize_media_upload(uuid) from public, anon;
grant execute on function public.finalize_media_upload(uuid) to authenticated;

create or replace function public.get_private_photo_access_state(p_owner_id uuid)
returns table(
  owner_id uuid,
  private_photo_count bigint,
  request_id uuid,
  request_status public.private_photo_access_status,
  can_view boolean,
  requested_at timestamptz,
  responded_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode='42501', message='authentication_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode='42501', message='active_adult_account_required';
  end if;
  if not private.is_active_adult(p_owner_id) then
    raise exception using errcode='42501', message='profile_not_available';
  end if;
  if p_owner_id <> v_user_id and private.users_are_blocked(p_owner_id, v_user_id) then
    raise exception using errcode='42501', message='profile_not_available';
  end if;

  return query
  with private_count as (
    select count(distinct m.id)::bigint as value
    from public.media_assets m
    join public.album_media am on am.media_id = m.id
    join public.albums a on a.id = am.album_id
    where a.owner_id = p_owner_id
      and a.album_type = 'private'
      and a.is_active
      and a.deleted_at is null
      and m.owner_id = p_owner_id
      and m.visibility = 'private'
      and m.moderation_status in ('pending_review','approved')
      and m.uploaded_at is not null
      and m.deleted_at is null
  ), request_row as (
    select r.id, r.status, r.requested_at, r.responded_at
    from public.private_photo_access_requests r
    where r.owner_id = p_owner_id and r.requester_id = v_user_id
    limit 1
  )
  select p_owner_id,
         coalesce(pc.value,0),
         rr.id,
         rr.status,
         (p_owner_id = v_user_id or private.has_private_photo_access(p_owner_id, v_user_id)),
         rr.requested_at,
         rr.responded_at
  from private_count pc
  left join request_row rr on true;
end;
$$;

revoke all on function public.get_private_photo_access_state(uuid) from public, anon;
grant execute on function public.get_private_photo_access_state(uuid) to authenticated;

create or replace function public.request_private_photo_access(p_owner_id uuid)
returns public.private_photo_access_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_result public.private_photo_access_requests%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode='42501', message='authentication_required';
  end if;
  if p_owner_id is null or p_owner_id = v_user_id then
    raise exception using errcode='22023', message='private_photo_self_request_not_allowed';
  end if;
  if not private.is_active_adult(v_user_id) or not private.is_active_adult(p_owner_id) then
    raise exception using errcode='42501', message='active_adult_account_required';
  end if;
  if private.users_are_blocked(p_owner_id, v_user_id) then
    raise exception using errcode='42501', message='private_photo_request_blocked';
  end if;
  if not exists (
    select 1
    from public.media_assets m
    join public.album_media am on am.media_id = m.id
    join public.albums a on a.id = am.album_id
    where a.owner_id = p_owner_id
      and a.album_type = 'private'
      and a.is_active
      and a.deleted_at is null
      and m.owner_id = p_owner_id
      and m.visibility = 'private'
      and m.moderation_status in ('pending_review','approved')
      and m.uploaded_at is not null
      and m.deleted_at is null
  ) then
    raise exception using errcode='P0002', message='private_photos_not_available';
  end if;

  insert into public.private_photo_access_requests(owner_id, requester_id)
  values (p_owner_id, v_user_id)
  on conflict (owner_id, requester_id) do update
  set status = case
        when public.private_photo_access_requests.status in ('rejected','revoked') then 'pending'::public.private_photo_access_status
        else public.private_photo_access_requests.status
      end,
      requested_at = case
        when public.private_photo_access_requests.status in ('rejected','revoked') then now()
        else public.private_photo_access_requests.requested_at
      end,
      responded_at = case
        when public.private_photo_access_requests.status in ('rejected','revoked') then null
        else public.private_photo_access_requests.responded_at
      end,
      revoked_at = case
        when public.private_photo_access_requests.status in ('rejected','revoked') then null
        else public.private_photo_access_requests.revoked_at
      end
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.request_private_photo_access(uuid) from public, anon;
grant execute on function public.request_private_photo_access(uuid) to authenticated;

create or replace function public.list_my_private_photo_access_requests(
  p_status public.private_photo_access_status default null
)
returns table(
  request_id uuid,
  requester_id uuid,
  username text,
  display_name text,
  status public.private_photo_access_status,
  requested_at timestamptz,
  responded_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode='42501', message='authentication_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode='42501', message='active_adult_account_required';
  end if;

  return query
  select r.id,
         r.requester_id,
         p.username::text,
         p.display_name,
         r.status,
         r.requested_at,
         r.responded_at,
         r.revoked_at
  from public.private_photo_access_requests r
  join public.profiles p on p.id = r.requester_id
  where r.owner_id = v_user_id
    and (p_status is null or r.status = p_status)
    and p.deleted_at is null
  order by case when r.status = 'pending' then 0 else 1 end,
           r.requested_at desc,
           r.id;
end;
$$;

revoke all on function public.list_my_private_photo_access_requests(public.private_photo_access_status) from public, anon;
grant execute on function public.list_my_private_photo_access_requests(public.private_photo_access_status) to authenticated;

create or replace function public.respond_to_private_photo_access_request(
  p_request_id uuid,
  p_approve boolean
)
returns public.private_photo_access_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.private_photo_access_requests%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode='42501', message='authentication_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode='42501', message='active_adult_account_required';
  end if;

  select * into v_request
  from public.private_photo_access_requests
  where id = p_request_id and owner_id = v_user_id
  for update;
  if not found then
    raise exception using errcode='42501', message='private_photo_request_not_available';
  end if;
  if v_request.status <> 'pending' then
    raise exception using errcode='22023', message='private_photo_request_not_pending';
  end if;
  if p_approve and (
    not private.is_active_adult(v_request.requester_id)
    or private.users_are_blocked(v_user_id, v_request.requester_id)
  ) then
    raise exception using errcode='42501', message='private_photo_approval_not_allowed';
  end if;

  update public.private_photo_access_requests
  set status = case when p_approve then 'approved'::public.private_photo_access_status else 'rejected'::public.private_photo_access_status end,
      responded_at = now(),
      revoked_at = null
  where id = v_request.id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.respond_to_private_photo_access_request(uuid,boolean) from public, anon;
grant execute on function public.respond_to_private_photo_access_request(uuid,boolean) to authenticated;

create or replace function public.revoke_private_photo_access(p_requester_id uuid)
returns public.private_photo_access_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.private_photo_access_requests%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode='42501', message='authentication_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode='42501', message='active_adult_account_required';
  end if;

  update public.private_photo_access_requests
  set status = 'revoked'::public.private_photo_access_status,
      revoked_at = now()
  where owner_id = v_user_id
    and requester_id = p_requester_id
    and status = 'approved'
  returning * into v_request;

  if not found then
    raise exception using errcode='P0002', message='private_photo_access_grant_not_found';
  end if;
  return v_request;
end;
$$;

revoke all on function public.revoke_private_photo_access(uuid) from public, anon;
grant execute on function public.revoke_private_photo_access(uuid) to authenticated;
