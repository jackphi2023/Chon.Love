-- Qualify the album-media upsert constraint because the RPC output column `media_id`
-- otherwise collides with PL/pgSQL name resolution.
create or replace function public.set_my_profile_photo_visibility(p_media_id uuid,p_visibility text)
returns table(media_id uuid,visibility text)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_target text:=lower(btrim(coalesce(p_visibility,'')));
  v_media public.media_assets%rowtype;
  v_album_id uuid;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if v_target not in ('public','private') then raise exception using errcode='22023',message='invalid_profile_photo_visibility'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text||':profile-photo-visibility',0));
  select m.* into v_media from public.media_assets m where m.id=p_media_id and m.owner_id=v_user_id for update;
  if not found or v_media.visibility not in ('public','private') or v_media.deleted_at is not null
     or v_media.moderation_status not in ('pending_review','approved') or v_media.uploaded_at is null then
    raise exception using errcode='42501',message='profile_photo_not_toggleable';
  end if;
  if v_media.visibility::text=v_target then return query select v_media.id,v_target; return; end if;

  delete from public.album_media am where am.media_id=v_media.id;
  update public.media_assets m set visibility=v_target::public.media_visibility where m.id=v_media.id returning m.* into v_media;

  if v_target='public' then
    select a.id into v_album_id from public.albums a
    where a.owner_id=v_user_id and a.album_type='public' and a.is_active and a.deleted_at is null
    order by a.created_at limit 1;
    if v_album_id is null then
      insert into public.albums(owner_id,name,album_type,fan_threshold_units)
      values(v_user_id,'Ảnh công khai','public',0) returning id into v_album_id;
    end if;
    insert into public.album_media(album_id,media_id,sort_order) values(v_album_id,v_media.id,0)
    on conflict on constraint album_media_pkey do nothing;
  end if;
  return query select v_media.id,v_target;
end;
$$;

revoke all on function public.set_my_profile_photo_visibility(uuid,text) from public,anon;
grant execute on function public.set_my_profile_photo_visibility(uuid,text) to authenticated,service_role;
