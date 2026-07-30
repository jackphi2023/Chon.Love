-- Phase C / Session 15
-- Profiles and post-moderated media: newly uploaded profile media is visible immediately
-- inside authenticated MyFan surfaces. Moderation remains internal; rejected/quarantined/deleted
-- media is removed from display. Storage buckets remain private and RLS-gated.

alter table public.profiles
  add column if not exists interests text[] not null default '{}'::text[];

alter table public.profiles
  drop constraint if exists profiles_interests_count_check;

alter table public.profiles
  add constraint profiles_interests_count_check
  check (cardinality(interests) <= 12);

revoke all on function public.update_my_profile(text,text,text,public.gender_identity,bigint,boolean,boolean) from public, anon, authenticated;
drop function public.update_my_profile(text,text,text,public.gender_identity,bigint,boolean,boolean);

create function public.update_my_profile(
  p_username text,
  p_display_name text,
  p_bio text default null,
  p_gender public.gender_identity default 'prefer_not_to_say',
  p_province_id bigint default null,
  p_interests text[] default '{}'::text[],
  p_discovery_enabled boolean default true,
  p_nearby_enabled boolean default false
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_existing public.profiles%rowtype;
  v_result public.profiles%rowtype;
  v_new_username extensions.citext;
  v_interests text[] := '{}'::text[];
  v_interest text;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'authentication_required';
  end if;
  if not public.is_current_user_adult() then
    raise exception using errcode = '42501', message = 'adult_onboarding_required';
  end if;

  v_new_username := nullif(pg_catalog.btrim(p_username), '')::extensions.citext;
  if v_new_username is null or v_new_username::text !~ '^[A-Za-z0-9_]{3,30}$' then
    raise exception using errcode = '22023', message = 'invalid_username';
  end if;
  if nullif(pg_catalog.btrim(p_display_name), '') is null or pg_catalog.char_length(pg_catalog.btrim(p_display_name)) > 60 then
    raise exception using errcode = '22023', message = 'invalid_display_name';
  end if;
  if p_bio is not null and pg_catalog.char_length(pg_catalog.btrim(p_bio)) > 500 then
    raise exception using errcode = '22023', message = 'invalid_bio';
  end if;
  if p_province_id is not null and not exists (
    select 1 from public.administrative_areas a where a.id = p_province_id and a.is_active
  ) then
    raise exception using errcode = '23503', message = 'province_not_active';
  end if;

  foreach v_interest in array coalesce(p_interests, '{}'::text[]) loop
    v_interest := pg_catalog.btrim(v_interest);
    if v_interest = '' then continue; end if;
    if pg_catalog.char_length(v_interest) < 2 or pg_catalog.char_length(v_interest) > 32 then
      raise exception using errcode = '22023', message = 'invalid_interests';
    end if;
    if not exists (
      select 1 from pg_catalog.unnest(v_interests) existing
      where pg_catalog.lower(existing) = pg_catalog.lower(v_interest)
    ) then
      v_interests := pg_catalog.array_append(v_interests, v_interest);
    end if;
  end loop;
  if cardinality(v_interests) > 12 then
    raise exception using errcode = '22023', message = 'invalid_interests';
  end if;

  select * into v_existing from public.profiles where id = v_user_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'profile_not_found';
  end if;
  if v_existing.profile_status in ('suspended','deactivated','deleted') then
    raise exception using errcode = '42501', message = 'account_not_available';
  end if;
  if v_existing.username is not null
    and v_existing.username <> v_new_username
    and v_existing.username_changed_at is not null
    and v_existing.username_changed_at > now() - interval '30 days'
  then
    raise exception using errcode = '22023', message = 'username_change_cooldown';
  end if;

  update public.profiles
  set username = v_new_username,
      display_name = pg_catalog.btrim(p_display_name),
      bio = nullif(pg_catalog.btrim(p_bio), ''),
      gender = p_gender,
      province_id = p_province_id,
      interests = v_interests,
      discovery_enabled = p_discovery_enabled,
      nearby_enabled = p_nearby_enabled,
      profile_status = 'active'::public.profile_status,
      username_changed_at = case
        when v_existing.username is distinct from v_new_username then now()
        else v_existing.username_changed_at
      end
  where id = v_user_id
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.update_my_profile(text,text,text,public.gender_identity,bigint,text[],boolean,boolean) from public, anon;
grant execute on function public.update_my_profile(text,text,text,public.gender_identity,bigint,text[],boolean,boolean) to authenticated;

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
     or v_media.visibility in ('private','kyc')
     or v_media.uploaded_at is null
  then
    return false;
  end if;
  if private.users_are_blocked(v_media.owner_id, p_viewer_id) then return false; end if;
  if not private.is_active_adult(v_media.owner_id) or not private.is_active_adult(p_viewer_id) then return false; end if;

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
  elsif v_media.visibility in ('public','fan') then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text || ':' || v_media.visibility::text, 0));
    select a.id into v_album_id
    from public.albums a
    where a.owner_id = v_user_id
      and a.album_type::text = v_media.visibility::text
      and a.is_active
      and a.deleted_at is null
    order by a.created_at
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
        case when v_media.visibility = 'fan' then 'Album Fan' else 'Ảnh công khai' end,
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

create or replace function public.set_my_avatar(p_media_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.media_assets m
    where m.id = p_media_id
      and m.owner_id = auth.uid()
      and m.visibility = 'avatar'
      and m.moderation_status in ('pending_review','approved')
      and m.deleted_at is null
  ) then
    raise exception using errcode = '42501', message = 'visible_avatar_not_available';
  end if;
  update public.profiles set avatar_media_id = p_media_id where id = auth.uid();
  return found;
end;
$$;

revoke all on function public.list_profile_album_media(uuid,public.album_type) from public, anon, authenticated;
drop function public.list_profile_album_media(uuid,public.album_type);

create function public.list_profile_album_media(p_owner_id uuid, p_album_type public.album_type default null)
returns table(
  album_id uuid,
  album_name text,
  album_type public.album_type,
  fan_threshold_units bigint,
  media_id uuid,
  storage_bucket text,
  storage_path text,
  media_type public.media_type,
  mime_type text,
  width integer,
  height integer,
  visibility public.media_visibility,
  sort_order integer,
  uploaded_at timestamptz,
  approved_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.name, a.album_type, a.fan_threshold_units,
         m.id, m.storage_bucket, m.storage_path, m.media_type, m.mime_type,
         m.width, m.height, m.visibility, am.sort_order, m.uploaded_at, m.approved_at
  from public.albums a
  join public.album_media am on am.album_id = a.id
  join public.media_assets m on m.id = am.media_id
  where a.owner_id = p_owner_id
    and a.is_active
    and a.deleted_at is null
    and (p_album_type is null or a.album_type = p_album_type)
    and m.moderation_status in ('pending_review','approved')
    and m.deleted_at is null
    and private.can_view_media_internal(m.id, auth.uid())
  order by a.created_at, am.sort_order, am.created_at;
$$;

revoke all on function public.list_profile_album_media(uuid,public.album_type) from public, anon;
grant execute on function public.list_profile_album_media(uuid,public.album_type) to authenticated;

create or replace function public.moderate_media(
  p_media_id uuid,
  p_action public.moderation_decision,
  p_reason_code text,
  p_notes text default null,
  p_destination_bucket text default null,
  p_destination_path text default null,
  p_request_id uuid default null
)
returns public.media_assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_before public.media_assets;
  v_after public.media_assets;
  v_case_id uuid;
  v_new_status public.media_moderation_status;
begin
  if v_actor is null or not private.current_user_has_any_role(array['moderator','super_admin']::private.user_role[]) then
    raise exception using errcode = '42501', message = 'moderator_role_required';
  end if;
  if p_reason_code is null or p_reason_code !~ '^[a-z][a-z0-9_]{1,63}$' then
    raise exception using errcode = '22023', message = 'invalid_moderation_reason';
  end if;

  select * into v_before from public.media_assets where id = p_media_id for update;
  if not found then raise exception using errcode = '23503', message = 'media_not_found'; end if;

  select id into v_case_id
  from public.moderation_cases
  where media_id = p_media_id and status in ('open','queued','in_review')
  order by created_at limit 1 for update;
  if v_case_id is null then
    insert into public.moderation_cases(media_id, source, status, priority)
    values (p_media_id, 'admin_review', 'in_review', 'normal')
    returning id into v_case_id;
  end if;

  if p_action = 'approve' then
    if v_before.moderation_status not in ('pending_review','quarantined') then
      raise exception using errcode = '22023', message = 'media_not_approvable';
    end if;
    if p_destination_bucket is not null or p_destination_path is not null then
      if p_destination_bucket <> 'profile-media' or p_destination_path is null then
        raise exception using errcode = '22023', message = 'invalid_approved_destination';
      end if;
      if pg_catalog.split_part(p_destination_path, '/', 1) <> v_before.owner_id::text
         or pg_catalog.split_part(p_destination_path, '/', 2) <> v_before.id::text then
        raise exception using errcode = '22023', message = 'invalid_approved_destination';
      end if;
      if not exists (
        select 1 from storage.objects o
        where o.bucket_id = p_destination_bucket and o.name = p_destination_path
      ) then
        raise exception using errcode = '23503', message = 'approved_storage_object_not_found';
      end if;
    end if;
    v_new_status := 'approved';
    update public.media_assets
    set storage_bucket = coalesce(p_destination_bucket, storage_bucket),
        storage_path = coalesce(p_destination_path, storage_path),
        moderation_status = v_new_status,
        moderation_reason_code = p_reason_code,
        approved_at = now(),
        approved_by = v_actor,
        rejected_at = null,
        deleted_at = null
    where id = p_media_id returning * into v_after;
    if v_after.visibility = 'avatar' then
      update public.profiles set avatar_media_id = v_after.id where id = v_after.owner_id;
    end if;
  elsif p_action = 'reject' then
    v_new_status := 'rejected';
    update public.media_assets
    set moderation_status = v_new_status,
        moderation_reason_code = p_reason_code,
        approved_at = null,
        approved_by = null,
        rejected_at = now(),
        deleted_at = null
    where id = p_media_id returning * into v_after;
    update public.profiles set avatar_media_id = null where avatar_media_id = p_media_id;
  elsif p_action = 'quarantine' then
    v_new_status := 'quarantined';
    update public.media_assets
    set moderation_status = v_new_status,
        moderation_reason_code = p_reason_code,
        approved_at = null,
        approved_by = null
    where id = p_media_id returning * into v_after;
    update public.profiles set avatar_media_id = null where avatar_media_id = p_media_id;
  elsif p_action = 'restore' then
    v_new_status := 'pending_review';
    update public.media_assets
    set moderation_status = v_new_status,
        moderation_reason_code = p_reason_code,
        approved_at = null,
        approved_by = null,
        rejected_at = null,
        deleted_at = null
    where id = p_media_id returning * into v_after;
    if v_after.visibility = 'avatar' then
      update public.profiles set avatar_media_id = v_after.id where id = v_after.owner_id;
    end if;
  elsif p_action = 'delete' then
    v_new_status := 'deleted';
    update public.media_assets
    set moderation_status = v_new_status,
        moderation_reason_code = p_reason_code,
        deleted_at = now()
    where id = p_media_id returning * into v_after;
    update public.profiles set avatar_media_id = null where avatar_media_id = p_media_id;
  else
    raise exception using errcode = '22023', message = 'unsupported_moderation_action';
  end if;

  update public.moderation_cases
  set status = 'resolved', decision = p_action, decision_notes = p_notes, resolved_at = now()
  where id = v_case_id;

  insert into private.media_moderation_events(
    media_id, moderation_case_id, actor_user_id, action,
    previous_status, new_status, reason_code, notes, request_id
  ) values (
    p_media_id, v_case_id, v_actor, p_action,
    v_before.moderation_status, v_new_status, p_reason_code, p_notes,
    coalesce(p_request_id, extensions.gen_random_uuid())
  );
  return v_after;
end;
$$;

drop policy if exists profile_media_select_authorized on storage.objects;
create policy profile_media_select_authorized
on storage.objects
for select
to authenticated
using (
  bucket_id in ('pending-media','profile-media')
  and exists (
    select 1 from public.media_assets m
    where m.storage_bucket = bucket_id
      and m.storage_path = name
      and private.can_view_media_internal(m.id, auth.uid())
  )
);
