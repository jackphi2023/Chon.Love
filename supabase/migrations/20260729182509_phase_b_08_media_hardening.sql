-- Session 8 hardening: KYC/quarantine access denial and auditable owner deletion.

create or replace function private.can_view_media_internal(p_media_id uuid,p_viewer_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_media public.media_assets%rowtype;
begin
  if p_viewer_id is null then return false; end if;
  select * into v_media from public.media_assets where id=p_media_id;
  if not found or v_media.deleted_at is not null or v_media.moderation_status='deleted' then return false; end if;

  if v_media.owner_id=p_viewer_id then
    return v_media.visibility<>'kyc'
      and v_media.moderation_status in ('pending_upload','pending_review','approved','rejected');
  end if;

  if v_media.moderation_status<>'approved' or v_media.visibility in ('private','kyc') then return false; end if;
  if private.users_are_blocked(v_media.owner_id,p_viewer_id) then return false; end if;
  if not private.is_active_adult(v_media.owner_id) or not private.is_active_adult(p_viewer_id) then return false; end if;

  if v_media.visibility='avatar' then
    return exists(select 1 from public.profiles p where p.id=v_media.owner_id and p.avatar_media_id=v_media.id and p.profile_status='active' and p.deleted_at is null);
  end if;
  if v_media.visibility='public' then
    return exists(select 1 from public.album_media am join public.albums a on a.id=am.album_id where am.media_id=v_media.id and a.owner_id=v_media.owner_id and a.album_type='public' and a.is_active and a.deleted_at is null);
  end if;
  if v_media.visibility='fan' then
    return exists(select 1 from public.album_media am join public.albums a on a.id=am.album_id where am.media_id=v_media.id and a.owner_id=v_media.owner_id and a.album_type='fan' and a.is_active and a.deleted_at is null)
      and private.has_active_fan_membership(v_media.owner_id,p_viewer_id);
  end if;
  return false;
end $$;
revoke all on function private.can_view_media_internal(uuid,uuid) from public,anon,authenticated;

create or replace function public.delete_my_media(p_media_id uuid,p_request_id uuid default null)
returns public.media_assets language plpgsql security definer set search_path='' as $$
declare
  v_user_id uuid:=auth.uid();
  v_before public.media_assets;
  v_after public.media_assets;
  v_request_id uuid:=coalesce(p_request_id,extensions.gen_random_uuid());
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;

  select m.* into v_after
  from private.media_moderation_events e join public.media_assets m on m.id=e.media_id
  where e.request_id=v_request_id and e.media_id=p_media_id and e.actor_user_id=v_user_id;
  if found then return v_after; end if;

  select * into v_before from public.media_assets where id=p_media_id and owner_id=v_user_id for update;
  if not found then raise exception using errcode='42501',message='media_not_available'; end if;
  if v_before.moderation_status='deleted' then return v_before; end if;

  update public.media_assets
  set moderation_status='deleted',moderation_reason_code='user_deleted',deleted_at=now()
  where id=p_media_id returning * into v_after;

  update public.profiles set avatar_media_id=null where id=v_user_id and avatar_media_id=p_media_id;

  insert into private.media_moderation_events(media_id,actor_user_id,action,previous_status,new_status,reason_code,request_id)
  values(p_media_id,v_user_id,'delete',v_before.moderation_status,'deleted','user_deleted',v_request_id);

  return v_after;
end $$;
revoke all on function public.delete_my_media(uuid,uuid) from public,anon;
grant execute on function public.delete_my_media(uuid,uuid) to authenticated;
comment on function public.delete_my_media(uuid,uuid) is 'Soft-deletes only auth.uid() media and appends an immutable audit event. Object cleanup is server-side.';
