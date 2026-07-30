-- Phase C / Session 15 hardening
-- Rejected, quarantined and deleted media must not be retrievable by any client,
-- including the media owner. Internal media rows remain available to the owner
-- through list_my_media so the UI can show a generic moderation notice.

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
      and v_media.moderation_status in ('pending_upload','pending_review','approved');
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

drop policy if exists pending_media_select_own on storage.objects;
drop policy if exists pending_media_select_own_visible on storage.objects;
create policy pending_media_select_own_visible
on storage.objects
for select
to authenticated
using (
  bucket_id = 'pending-media'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.media_assets m
    where m.storage_bucket = bucket_id
      and m.storage_path = name
      and m.owner_id = (select auth.uid())
      and m.deleted_at is null
      and m.moderation_status in ('pending_upload','pending_review','approved')
  )
);
