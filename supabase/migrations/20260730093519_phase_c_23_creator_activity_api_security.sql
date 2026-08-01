create or replace function private.normalize_creator_activity_video(p_url text)
returns table(external_provider text,canonical_url text,external_video_id text)
language plpgsql stable set search_path=''
as $$
declare v_url text:=btrim(coalesce(p_url,'')); v_id text;
begin
  if v_url='' or char_length(v_url)>500 or v_url!~'^https://' or v_url~'[[:space:]]' then raise exception using errcode='22023',message='invalid_activity_video_url'; end if;
  if v_url~*'^https://(www\.)?youtu\.be/' then
    v_id:=substring(v_url from 'youtu\.be/([A-Za-z0-9_-]{11})');
    if v_id is null then raise exception using errcode='22023',message='invalid_youtube_video_id'; end if;
    return query select 'youtube'::text,('https://www.youtube.com/watch?v='||v_id)::text,v_id; return;
  end if;
  if v_url~*'^https://(www\.)?youtube\.com/watch\?' then
    v_id:=substring(v_url from '[?&]v=([A-Za-z0-9_-]{11})');
    if v_id is null then raise exception using errcode='22023',message='invalid_youtube_video_id'; end if;
    return query select 'youtube'::text,('https://www.youtube.com/watch?v='||v_id)::text,v_id; return;
  end if;
  if v_url~*'^https://(www\.)?youtube\.com/(shorts|embed)/' then
    v_id:=substring(v_url from '/[A-Za-z]+/([A-Za-z0-9_-]{11})');
    if v_id is null then raise exception using errcode='22023',message='invalid_youtube_video_id'; end if;
    return query select 'youtube'::text,('https://www.youtube.com/watch?v='||v_id)::text,v_id; return;
  end if;
  if v_url~*'^https://(www\.)?of\.tv/[A-Za-z0-9][A-Za-z0-9/_-]*([?#].*)?$' then
    return query select 'of_tv'::text,split_part(split_part(v_url,'#',1),'?',1)::text,null::text; return;
  end if;
  raise exception using errcode='22023',message='activity_video_provider_not_allowed';
end;
$$;

create or replace function public.create_creator_activity_post(p_body text,p_external_url text default null,p_media_id uuid default null,p_image_access_mode text default 'public',p_required_gift_id uuid default null)
returns public.creator_posts language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid(); v_provider text; v_url text; v_video_id text;
  v_content public.creator_activity_content_type; v_access public.creator_activity_image_access_mode;
  v_media public.media_assets; v_gift public.gift_catalog; v_post public.creator_posts;
begin
  if v_user is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.is_active_adult(v_user) then raise exception using errcode='42501',message='active_adult_creator_required'; end if;
  if not exists(select 1 from public.creator_profiles cp where cp.user_id=v_user and cp.creator_status='approved' and cp.approved_at is not null) then raise exception using errcode='42501',message='approved_creator_required'; end if;
  if char_length(btrim(coalesce(p_body,''))) not between 1 and private.config_integer('creator_activity_text_max') then raise exception using errcode='22023',message='invalid_activity_body'; end if;
  if p_external_url is not null and p_media_id is not null then raise exception using errcode='22023',message='activity_image_and_video_cannot_be_combined'; end if;

  if p_media_id is not null then
    v_content:='image';
    if p_image_access_mode not in ('public','gift_locked') then raise exception using errcode='22023',message='invalid_activity_image_access_mode'; end if;
    v_access:=p_image_access_mode::public.creator_activity_image_access_mode;
    select m.* into v_media from public.media_assets m where m.id=p_media_id and m.owner_id=v_user and m.media_type='image' and m.visibility='private' and m.moderation_status in ('pending_review','approved') and m.deleted_at is null for update;
    if not found then raise exception using errcode='42501',message='activity_media_not_available'; end if;
    if v_media.file_size_bytes>5242880 then raise exception using errcode='22023',message='activity_media_too_large_for_safe_preview'; end if;
    if exists(select 1 from public.creator_post_media pm where pm.media_id=p_media_id) then raise exception using errcode='23505',message='activity_media_already_used'; end if;
    if v_access='gift_locked' then
      if p_required_gift_id is null then raise exception using errcode='22023',message='activity_required_gift_missing'; end if;
      select g.* into v_gift from public.gift_catalog g where g.id=p_required_gift_id and g.is_active and g.deleted_at is null;
      if not found then raise exception using errcode='22023',message='activity_required_gift_inactive'; end if;
    elsif p_required_gift_id is not null then raise exception using errcode='22023',message='activity_public_image_cannot_require_gift'; end if;
  elsif p_external_url is not null and btrim(p_external_url)<>'' then
    v_content:='video'; v_access:='public';
    select n.external_provider,n.canonical_url,n.external_video_id into v_provider,v_url,v_video_id from private.normalize_creator_activity_video(p_external_url) n;
    if p_required_gift_id is not null then raise exception using errcode='22023',message='activity_video_cannot_require_gift'; end if;
  else
    v_content:='text'; v_access:='public';
    if p_required_gift_id is not null then raise exception using errcode='22023',message='activity_text_cannot_require_gift'; end if;
  end if;

  insert into public.creator_posts(creator_id,body,content_type,external_url,external_provider,external_video_id,image_access_mode,required_gift_id,required_gift_units_snapshot,moderation_status)
  values(v_user,btrim(p_body),v_content,v_url,v_provider,v_video_id,v_access,case when v_access='gift_locked' then v_gift.id end,case when v_access='gift_locked' then v_gift.heart_price_units end,'pending_review') returning * into v_post;
  if v_content='image' then insert into public.creator_post_media(post_id,media_id) values(v_post.id,v_media.id); end if;
  return v_post;
end;
$$;

create or replace function public.prepare_creator_activity_preview(p_post_id uuid)
returns table(post_id uuid,media_id uuid,storage_bucket text,storage_path text,mime_type text,file_size_bytes bigint,owner_id uuid)
language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception using errcode='42501',message='authentication_required'; end if;
  return query select p.id,m.id,m.storage_bucket,m.storage_path,m.mime_type,m.file_size_bytes,m.owner_id
  from public.creator_posts p join public.creator_post_media pm on pm.post_id=p.id join public.media_assets m on m.id=pm.media_id
  where p.id=p_post_id and p.creator_id=v_user and p.deleted_at is null and p.content_type='image' and m.owner_id=v_user and m.visibility='private' and m.moderation_status in ('pending_review','approved') and m.deleted_at is null and m.file_size_bytes<=5242880;
  if not found then raise exception using errcode='42501',message='activity_preview_source_not_available'; end if;
end;
$$;

create or replace function private.can_view_creator_activity_preview_object(p_name text,p_viewer uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(select 1 from public.creator_post_media pm join public.creator_posts p on p.id=pm.post_id join public.media_assets m on m.id=pm.media_id join public.creator_profiles cp on cp.user_id=p.creator_id
  where pm.preview_bucket='activity-previews' and pm.preview_path=p_name and pm.preview_status='ready' and p.deleted_at is null and (
    (p_viewer=p.creator_id and private.is_active_adult(p_viewer)) or
    (p.moderation_status='approved' and p.published_at is not null and m.moderation_status='approved' and m.deleted_at is null and cp.creator_status='approved' and cp.approved_at is not null and private.is_active_adult(p.creator_id) and (p_viewer is null or (private.is_active_adult(p_viewer) and not private.users_are_blocked(p_viewer,p.creator_id))))
  ))
$$;

create or replace function private.can_view_creator_activity_original_object(p_bucket text,p_name text,p_viewer uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(select 1 from public.creator_post_media pm join public.creator_posts p on p.id=pm.post_id join public.media_assets m on m.id=pm.media_id join public.creator_profiles cp on cp.user_id=p.creator_id
  left join private.creator_post_unlocks u on u.post_id=p.id and u.viewer_id=p_viewer and u.status='active'
  where m.storage_bucket=p_bucket and m.storage_path=p_name and p.deleted_at is null and (
    (p_viewer=p.creator_id and private.is_active_adult(p_viewer)) or
    (p.moderation_status='approved' and p.published_at is not null and m.moderation_status='approved' and m.deleted_at is null and cp.creator_status='approved' and cp.approved_at is not null and private.is_active_adult(p.creator_id) and (p_viewer is null or (private.is_active_adult(p_viewer) and not private.users_are_blocked(p_viewer,p.creator_id))) and (p.image_access_mode='public' or (p_viewer is not null and u.id is not null)))
  ))
$$;

grant execute on function private.can_view_creator_activity_preview_object(text,uuid) to anon,authenticated,service_role;
grant execute on function private.can_view_creator_activity_original_object(text,text,uuid) to anon,authenticated,service_role;

drop policy if exists activity_preview_read on storage.objects;
create policy activity_preview_read on storage.objects for select to anon,authenticated using(bucket_id='activity-previews' and private.can_view_creator_activity_preview_object(name,auth.uid()));
drop policy if exists creator_activity_original_read on storage.objects;
create policy creator_activity_original_read on storage.objects for select to anon,authenticated using(bucket_id in ('pending-media','profile-media') and private.can_view_creator_activity_original_object(bucket_id,name,auth.uid()));

create or replace function public.list_creator_activity(p_creator_username text,p_limit integer default 20,p_before_at timestamptz default null,p_before_id uuid default null)
returns table(post_id uuid,creator_id uuid,username text,display_name text,is_verified boolean,avatar_media_id uuid,avatar_bucket text,avatar_path text,body text,content_type text,external_url text,external_provider text,external_video_id text,image_access_mode text,required_gift_id uuid,required_gift_name_vi text,required_gift_icon_emoji text,required_gift_hearts integer,required_gift_active boolean,moderation_status text,published_at timestamptz,created_at timestamptz,media_id uuid,preview_bucket text,preview_path text,preview_width integer,preview_height integer,original_bucket text,original_path text,original_width integer,original_height integer,is_owner boolean,is_unlocked boolean,unlock_status text,unlock_count bigint)
language plpgsql stable security definer set search_path=''
as $$
declare v_viewer uuid:=auth.uid(); v_creator uuid; v_owner boolean; v_limit integer:=least(greatest(coalesce(p_limit,20),1),40);
begin
  select pr.id into v_creator from public.profiles pr where lower(pr.username)=lower(btrim(p_creator_username)) and pr.deleted_at is null;
  if v_creator is null then return; end if;
  v_owner:=v_viewer=v_creator;
  if v_viewer is not null and private.users_are_blocked(v_viewer,v_creator) then return; end if;
  if not v_owner and not exists(select 1 from public.creator_profiles cp where cp.user_id=v_creator and cp.creator_status='approved' and cp.approved_at is not null) then return; end if;
  if not v_owner and not private.is_active_adult(v_creator) then return; end if;
  return query
  select p.id,p.creator_id,pr.username,coalesce(pr.display_name,pr.username),true,pr.avatar_media_id,av.storage_bucket,av.storage_path,p.body,p.content_type::text,p.external_url,p.external_provider,p.external_video_id,p.image_access_mode::text,p.required_gift_id,g.name_vi,g.icon_emoji,g.display_hearts,(g.is_active and g.deleted_at is null),p.moderation_status::text,p.published_at,p.created_at,pm.media_id,
    case when pm.preview_status='ready' then pm.preview_bucket end,case when pm.preview_status='ready' then pm.preview_path end,case when pm.preview_status='ready' then pm.preview_width end,case when pm.preview_status='ready' then pm.preview_height end,
    case when v_owner or (p.moderation_status='approved' and m.moderation_status='approved' and (p.image_access_mode='public' or u.status='active')) then m.storage_bucket end,
    case when v_owner or (p.moderation_status='approved' and m.moderation_status='approved' and (p.image_access_mode='public' or u.status='active')) then m.storage_path end,
    case when v_owner or (p.moderation_status='approved' and m.moderation_status='approved' and (p.image_access_mode='public' or u.status='active')) then m.width end,
    case when v_owner or (p.moderation_status='approved' and m.moderation_status='approved' and (p.image_access_mode='public' or u.status='active')) then m.height end,
    v_owner,(v_owner or u.status='active' or p.image_access_mode='public'),coalesce(u.status::text,'none'),case when v_owner then (select count(*) from private.creator_post_unlocks ux where ux.post_id=p.id and ux.status='active') else 0 end
  from public.creator_posts p join public.profiles pr on pr.id=p.creator_id
  left join public.media_assets av on av.id=pr.avatar_media_id and av.moderation_status='approved' and av.deleted_at is null
  left join public.creator_post_media pm on pm.post_id=p.id left join public.media_assets m on m.id=pm.media_id left join public.gift_catalog g on g.id=p.required_gift_id left join private.creator_post_unlocks u on u.post_id=p.id and u.viewer_id=v_viewer
  where p.creator_id=v_creator and p.deleted_at is null and ((v_owner and p.moderation_status<>'deleted') or (not v_owner and p.moderation_status='approved' and p.published_at is not null and (p.content_type<>'image' or (m.moderation_status='approved' and pm.preview_status='ready'))))
    and (p_before_at is null or (coalesce(p.published_at,p.created_at),p.id)<(p_before_at,coalesce(p_before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by coalesce(p.published_at,p.created_at) desc,p.id desc limit v_limit;
end;
$$;

create or replace function public.get_creator_post_media_access(p_post_id uuid)
returns table(media_id uuid,storage_bucket text,storage_path text,width integer,height integer,expires_in_seconds integer)
language plpgsql stable security definer set search_path=''
as $$
declare v_viewer uuid:=auth.uid();
begin
  return query select m.id,m.storage_bucket,m.storage_path,m.width,m.height,private.config_integer('creator_activity_signed_url_seconds')::integer
  from public.creator_posts p join public.creator_post_media pm on pm.post_id=p.id join public.media_assets m on m.id=pm.media_id join public.creator_profiles cp on cp.user_id=p.creator_id
  left join private.creator_post_unlocks u on u.post_id=p.id and u.viewer_id=v_viewer and u.status='active'
  where p.id=p_post_id and p.deleted_at is null and ((v_viewer=p.creator_id and private.is_active_adult(v_viewer)) or (p.moderation_status='approved' and p.published_at is not null and m.moderation_status='approved' and m.deleted_at is null and cp.creator_status='approved' and private.is_active_adult(p.creator_id) and (v_viewer is null or (private.is_active_adult(v_viewer) and not private.users_are_blocked(v_viewer,p.creator_id))) and (p.image_access_mode='public' or (v_viewer is not null and u.id is not null))));
  if not found then raise exception using errcode='42501',message='creator_activity_media_access_denied'; end if;
end;
$$;

create or replace function public.archive_creator_activity_post(p_post_id uuid)
returns public.creator_posts language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_post public.creator_posts;
begin
  update public.creator_posts set moderation_status='archived',archived_at=now() where id=p_post_id and creator_id=v_user and deleted_at is null and moderation_status in ('pending_review','approved','rejected') returning * into v_post;
  if v_post.id is null then raise exception using errcode='42501',message='creator_activity_post_not_archivable'; end if; return v_post;
end;
$$;

create or replace function public.delete_creator_activity_post(p_post_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
  update public.creator_posts set moderation_status='deleted',deleted_at=now(),archived_at=coalesce(archived_at,now()) where id=p_post_id and creator_id=v_user and deleted_at is null;
  if not found then raise exception using errcode='42501',message='creator_activity_post_not_deletable'; end if; return true;
end;
$$;

revoke all on function public.create_creator_activity_post(text,text,uuid,text,uuid),public.prepare_creator_activity_preview(uuid),public.list_creator_activity(text,integer,timestamptz,uuid),public.get_creator_post_media_access(uuid),public.archive_creator_activity_post(uuid),public.delete_creator_activity_post(uuid) from public;
grant execute on function public.create_creator_activity_post(text,text,uuid,text,uuid),public.prepare_creator_activity_preview(uuid),public.archive_creator_activity_post(uuid),public.delete_creator_activity_post(uuid) to authenticated,service_role;
grant execute on function public.list_creator_activity(text,integer,timestamptz,uuid),public.get_creator_post_media_access(uuid) to anon,authenticated,service_role;
