create or replace function private.can_view_media_internal(p_media_id uuid, p_viewer_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_media public.media_assets%rowtype;
begin
  if p_viewer_id is null then return false; end if;
  select m.* into v_media from public.media_assets m where m.id=p_media_id;
  if not found or v_media.deleted_at is not null or v_media.moderation_status='deleted' then return false; end if;

  if v_media.owner_id=p_viewer_id then
    return v_media.visibility<>'kyc'
      and v_media.moderation_status in ('pending_upload','pending_review','approved','rejected','quarantined');
  end if;

  if private.users_are_blocked(v_media.owner_id,p_viewer_id) then return false; end if;
  if not private.is_active_adult(v_media.owner_id) or not private.is_active_adult(p_viewer_id) then return false; end if;
  if v_media.visibility='kyc' then return false; end if;

  -- Public-facing profile media must be approved before another member can receive
  -- its storage path/signed URL. This is the surface affected by stale/pending avatars.
  if v_media.visibility in ('avatar','public') then
    if v_media.moderation_status <> 'approved'::public.media_moderation_status
       or v_media.uploaded_at is null then
      return false;
    end if;

    if v_media.visibility='avatar' then
      return exists(
        select 1 from public.profiles p
        where p.id=v_media.owner_id
          and p.avatar_media_id=v_media.id
          and p.profile_status='active'
          and p.deleted_at is null
      );
    end if;

    return exists(
      select 1
      from public.album_media am
      join public.albums a on a.id=am.album_id
      where am.media_id=v_media.id
        and a.owner_id=v_media.owner_id
        and a.album_type='public'
        and a.is_active
        and a.deleted_at is null
    );
  end if;

  -- Preserve LX-20 paid/private behavior: uploaded pending-review private photos are
  -- eligible for Premium/Diamond while moderation completes. Do not broaden access.
  if v_media.visibility='private' then
    return v_media.uploaded_at is not null
      and v_media.moderation_status in ('pending_review','approved')
      and private.has_active_luxy_paid_membership(p_viewer_id);
  end if;

  -- Fan media keeps the pre-existing moderation semantics and membership gate.
  if v_media.visibility='fan' then
    return v_media.uploaded_at is not null
      and v_media.moderation_status in ('pending_review','approved')
      and exists(
        select 1
        from public.album_media am
        join public.albums a on a.id=am.album_id
        where am.media_id=v_media.id
          and a.owner_id=v_media.owner_id
          and a.album_type='fan'
          and a.is_active
          and a.deleted_at is null
      )
      and private.has_active_fan_membership(v_media.owner_id,p_viewer_id);
  end if;

  return false;
end;
$function$;
