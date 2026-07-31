do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname='creator_activity_visibility'
  ) then
    create type public.creator_activity_visibility as enum ('public','friends','fans');
  end if;
end
$$;

alter table public.creator_profiles
  add column if not exists activity_visibility public.creator_activity_visibility not null default 'public',
  add column if not exists activity_visibility_updated_at timestamptz not null default now();

update public.creator_posts
set image_access_mode='public', required_gift_id=null, required_gift_units_snapshot=null
where image_access_mode<>'public' or required_gift_id is not null or required_gift_units_snapshot is not null;

insert into private.app_config(key,value_json,value_type,description,is_public) values
('creator_activity_default_visibility','"public"'::jsonb,'string','Default whole-feed Creator Activity privacy mode.',true),
('creator_activity_online_window_minutes','5'::jsonb,'integer','Minutes since last activity considered online on profile presentation.',true),
('creator_activity_album_page_size','24'::jsonb,'integer','Default number of Activity-derived album images returned per page.',true)
on conflict(key) do update set value_json=excluded.value_json,value_type=excluded.value_type,description=excluded.description,is_public=excluded.is_public,updated_at=now();

create or replace function private.has_accepted_friendship(p_left uuid,p_right uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select p_left is not null and p_right is not null and p_left<>p_right and exists(
    select 1 from public.friendships f
    where f.pair_low_id=least(p_left,p_right)
      and f.pair_high_id=greatest(p_left,p_right)
      and f.status='accepted'::public.friendship_status
  )
$$;

create or replace function private.can_view_creator_activity(p_creator uuid,p_viewer uuid)
returns boolean language plpgsql stable security definer set search_path=''
as $$
declare v_visibility public.creator_activity_visibility;
begin
  if p_creator is null then return false; end if;
  select cp.activity_visibility into v_visibility
  from public.creator_profiles cp join public.profiles p on p.id=cp.user_id
  where cp.user_id=p_creator
    and cp.creator_status='approved'::public.creator_status
    and cp.approved_at is not null
    and p.profile_status='active'::public.profile_status
    and p.deleted_at is null
    and private.is_active_adult(p_creator);
  if v_visibility is null then return false; end if;
  if p_viewer=p_creator then return private.is_active_adult(p_viewer); end if;
  if p_viewer is not null then
    if not private.is_active_adult(p_viewer) then return false; end if;
    if private.users_are_blocked(p_viewer,p_creator) then return false; end if;
  end if;
  if v_visibility='public'::public.creator_activity_visibility then return true; end if;
  if p_viewer is null then return false; end if;
  if v_visibility='friends'::public.creator_activity_visibility then
    return private.has_accepted_friendship(p_viewer,p_creator) or private.has_active_fan_membership(p_creator,p_viewer);
  end if;
  return private.has_active_fan_membership(p_creator,p_viewer);
end;
$$;

create or replace function public.get_creator_activity_access(p_creator_username text)
returns table(
  creator_id uuid,username text,activity_visibility text,can_view boolean,is_owner boolean,is_friend boolean,is_fan boolean,gate_reason text,
  fan_threshold_units bigint,fan_eligible_units bigint,fan_remaining_units bigint,approved_post_count bigint,approved_image_count bigint
)
language plpgsql stable security definer set search_path=''
as $$
declare
  v_viewer uuid:=auth.uid(); v_creator uuid; v_username text; v_visibility public.creator_activity_visibility;
  v_friend boolean:=false; v_fan boolean:=false; v_owner boolean:=false; v_allowed boolean:=false;
  v_threshold bigint:=0; v_eligible bigint:=0; v_blocked boolean:=false;
begin
  if nullif(btrim(p_creator_username),'') is null then raise exception using errcode='22023',message='profile_username_required'; end if;
  select p.id,p.username::text,cp.activity_visibility,greatest(cp.fan_threshold_units,1)
    into v_creator,v_username,v_visibility,v_threshold
  from public.profiles p join public.creator_profiles cp on cp.user_id=p.id
  where lower(p.username::text)=lower(btrim(p_creator_username))
    and p.profile_status='active'::public.profile_status and p.deleted_at is null
    and cp.creator_status='approved'::public.creator_status and cp.approved_at is not null
    and private.is_active_adult(p.id)
  limit 1;
  if v_creator is null then return; end if;
  v_owner:=v_viewer=v_creator;
  if v_viewer is not null and not v_owner then
    v_blocked:=private.users_are_blocked(v_viewer,v_creator);
    if not v_blocked and private.is_active_adult(v_viewer) then
      v_friend:=private.has_accepted_friendship(v_viewer,v_creator);
      v_fan:=private.has_active_fan_membership(v_creator,v_viewer);
      select coalesce(fp.eligible_units,0) into v_eligible
      from public.fan_progress fp where fp.creator_id=v_creator and fp.fan_user_id=v_viewer;
      v_eligible:=coalesce(v_eligible,0);
    end if;
  end if;
  v_allowed:=private.can_view_creator_activity(v_creator,v_viewer);
  return query select
    v_creator,v_username,v_visibility::text,v_allowed,v_owner,v_friend,v_fan,
    case when v_allowed then 'none' when v_blocked then 'unavailable' when v_viewer is null then 'login_required'
      when v_visibility='friends'::public.creator_activity_visibility then 'friend_required'
      when v_visibility='fans'::public.creator_activity_visibility then 'fan_required' else 'unavailable' end,
    v_threshold,v_eligible,greatest(v_threshold-v_eligible,0),
    case when v_allowed then (select count(*)::bigint from public.creator_posts p where p.creator_id=v_creator and p.moderation_status='approved' and p.published_at is not null and p.deleted_at is null) else 0::bigint end,
    case when v_allowed then (select count(*)::bigint from public.creator_posts p join public.creator_post_media pm on pm.post_id=p.id join public.media_assets m on m.id=pm.media_id where p.creator_id=v_creator and p.content_type='image' and p.moderation_status='approved' and p.published_at is not null and p.deleted_at is null and m.moderation_status='approved' and m.deleted_at is null) else 0::bigint end;
end;
$$;

create or replace function public.set_my_creator_activity_visibility(p_visibility text)
returns table(activity_visibility text,updated_at timestamptz)
language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_visibility public.creator_activity_visibility; v_updated timestamptz;
begin
  if v_user is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.is_active_adult(v_user) then raise exception using errcode='42501',message='active_adult_creator_required'; end if;
  if p_visibility not in ('public','friends','fans') then raise exception using errcode='22023',message='invalid_creator_activity_visibility'; end if;
  v_visibility:=p_visibility::public.creator_activity_visibility;
  update public.creator_profiles cp set activity_visibility=v_visibility,activity_visibility_updated_at=now()
  where cp.user_id=v_user and cp.creator_status='approved'::public.creator_status and cp.approved_at is not null
  returning cp.activity_visibility_updated_at into v_updated;
  if v_updated is null then raise exception using errcode='42501',message='approved_creator_required'; end if;
  return query select v_visibility::text,v_updated;
end;
$$;

create or replace function public.create_creator_activity_post(p_body text,p_external_url text default null,p_media_id uuid default null,p_image_access_mode text default 'public',p_required_gift_id uuid default null)
returns public.creator_posts language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_provider text; v_url text; v_video_id text; v_content public.creator_activity_content_type; v_media public.media_assets; v_post public.creator_posts;
begin
  if v_user is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.is_active_adult(v_user) then raise exception using errcode='42501',message='active_adult_creator_required'; end if;
  if not exists(select 1 from public.creator_profiles cp where cp.user_id=v_user and cp.creator_status='approved' and cp.approved_at is not null) then raise exception using errcode='42501',message='approved_creator_required'; end if;
  if char_length(btrim(coalesce(p_body,''))) not between 1 and private.config_integer('creator_activity_text_max') then raise exception using errcode='22023',message='invalid_activity_body'; end if;
  if p_external_url is not null and p_media_id is not null then raise exception using errcode='22023',message='activity_image_and_video_cannot_be_combined'; end if;
  if coalesce(p_image_access_mode,'public')<>'public' or p_required_gift_id is not null then raise exception using errcode='22023',message='creator_activity_per_post_gift_lock_retired'; end if;
  if p_media_id is not null then
    v_content:='image';
    select m.* into v_media from public.media_assets m
    where m.id=p_media_id and m.owner_id=v_user and m.media_type='image' and m.visibility='private'
      and m.moderation_status in ('pending_review','approved') and m.deleted_at is null for update;
    if not found then raise exception using errcode='42501',message='activity_media_not_available'; end if;
    if v_media.file_size_bytes>5242880 then raise exception using errcode='22023',message='activity_media_too_large_for_safe_preview'; end if;
    if exists(select 1 from public.creator_post_media pm where pm.media_id=p_media_id) then raise exception using errcode='23505',message='activity_media_already_used'; end if;
  elsif p_external_url is not null and btrim(p_external_url)<>'' then
    v_content:='video';
    select n.external_provider,n.canonical_url,n.external_video_id into v_provider,v_url,v_video_id from private.normalize_creator_activity_video(p_external_url) n;
  else v_content:='text'; end if;
  insert into public.creator_posts(creator_id,body,content_type,external_url,external_provider,external_video_id,image_access_mode,required_gift_id,required_gift_units_snapshot,moderation_status)
  values(v_user,btrim(p_body),v_content,v_url,v_provider,v_video_id,'public',null,null,'pending_review') returning * into v_post;
  if v_content='image' then insert into public.creator_post_media(post_id,media_id) values(v_post.id,v_media.id); end if;
  return v_post;
end;
$$;

drop function if exists public.list_creator_activity(text,integer,timestamptz,uuid);
create function public.list_creator_activity(p_creator_username text,p_limit integer default 20,p_before_at timestamptz default null,p_before_id uuid default null)
returns table(post_id uuid,creator_id uuid,username text,display_name text,is_verified boolean,avatar_media_id uuid,avatar_bucket text,avatar_path text,body text,content_type text,external_url text,external_provider text,external_video_id text,image_access_mode text,required_gift_id uuid,required_gift_name_vi text,required_gift_icon_emoji text,required_gift_hearts integer,required_gift_active boolean,moderation_status text,published_at timestamptz,created_at timestamptz,media_id uuid,preview_bucket text,preview_path text,preview_width integer,preview_height integer,original_bucket text,original_path text,original_width integer,original_height integer,is_owner boolean,is_unlocked boolean,unlock_status text,unlock_count bigint)
language plpgsql stable security definer set search_path=''
as $$
declare v_viewer uuid:=auth.uid(); v_creator uuid; v_owner boolean; v_allowed boolean; v_limit integer:=least(greatest(coalesce(p_limit,20),1),40);
begin
  select p.id into v_creator from public.profiles p where lower(p.username::text)=lower(btrim(p_creator_username)) and p.deleted_at is null limit 1;
  if v_creator is null then return; end if;
  v_owner:=v_viewer=v_creator; v_allowed:=private.can_view_creator_activity(v_creator,v_viewer);
  if not v_owner and not v_allowed then return; end if;
  return query select
    p.id,p.creator_id,pr.username::text,coalesce(pr.display_name,pr.username::text),true,pr.avatar_media_id,av.storage_bucket,av.storage_path,
    p.body,p.content_type::text,p.external_url,p.external_provider,p.external_video_id,'public'::text,null::uuid,null::text,null::text,null::integer,null::boolean,
    p.moderation_status::text,p.published_at,p.created_at,pm.media_id,
    case when v_owner and pm.preview_status='ready' then pm.preview_bucket end,
    case when v_owner and pm.preview_status='ready' then pm.preview_path end,
    case when v_owner and pm.preview_status='ready' then pm.preview_width end,
    case when v_owner and pm.preview_status='ready' then pm.preview_height end,
    case when v_owner or (p.moderation_status='approved' and m.moderation_status='approved') then m.storage_bucket end,
    case when v_owner or (p.moderation_status='approved' and m.moderation_status='approved') then m.storage_path end,
    case when v_owner or (p.moderation_status='approved' and m.moderation_status='approved') then m.width end,
    case when v_owner or (p.moderation_status='approved' and m.moderation_status='approved') then m.height end,
    v_owner,(v_owner or v_allowed),case when v_owner or v_allowed then 'active'::text else 'none'::text end,0::bigint
  from public.creator_posts p join public.profiles pr on pr.id=p.creator_id
  left join public.media_assets av on av.id=pr.avatar_media_id and av.moderation_status='approved' and av.deleted_at is null
  left join public.creator_post_media pm on pm.post_id=p.id left join public.media_assets m on m.id=pm.media_id
  where p.creator_id=v_creator and p.deleted_at is null
    and ((v_owner and p.moderation_status<>'deleted') or (not v_owner and p.moderation_status='approved' and p.published_at is not null and (p.content_type<>'image' or (m.moderation_status='approved' and m.deleted_at is null))))
    and (p_before_at is null or (coalesce(p.published_at,p.created_at),p.id)<(p_before_at,coalesce(p_before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by coalesce(p.published_at,p.created_at) desc,p.id desc limit v_limit;
end;
$$;

create or replace function private.can_view_creator_activity_preview_object(p_name text,p_viewer uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(select 1 from public.creator_post_media pm join public.creator_posts p on p.id=pm.post_id join public.media_assets m on m.id=pm.media_id
  where pm.preview_bucket='activity-previews' and pm.preview_path=p_name and pm.preview_status='ready' and p.deleted_at is null and (
    (p_viewer=p.creator_id and private.is_active_adult(p_viewer)) or
    (p.moderation_status='approved' and p.published_at is not null and m.moderation_status='approved' and m.deleted_at is null and private.can_view_creator_activity(p.creator_id,p_viewer))
  ))
$$;

create or replace function private.can_view_creator_activity_original_object(p_bucket text,p_name text,p_viewer uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(select 1 from public.creator_post_media pm join public.creator_posts p on p.id=pm.post_id join public.media_assets m on m.id=pm.media_id
  where m.storage_bucket=p_bucket and m.storage_path=p_name and p.deleted_at is null and (
    (p_viewer=p.creator_id and private.is_active_adult(p_viewer)) or
    (p.moderation_status='approved' and p.published_at is not null and m.moderation_status='approved' and m.deleted_at is null and private.can_view_creator_activity(p.creator_id,p_viewer))
  ))
$$;

create or replace function public.get_creator_post_media_access(p_post_id uuid)
returns table(media_id uuid,storage_bucket text,storage_path text,width integer,height integer,expires_in_seconds integer)
language plpgsql stable security definer set search_path=''
as $$
declare v_viewer uuid:=auth.uid();
begin
  return query select m.id,m.storage_bucket,m.storage_path,m.width,m.height,private.config_integer('creator_activity_signed_url_seconds')::integer
  from public.creator_posts p join public.creator_post_media pm on pm.post_id=p.id join public.media_assets m on m.id=pm.media_id
  where p.id=p_post_id and p.deleted_at is null and ((v_viewer=p.creator_id and private.is_active_adult(v_viewer)) or
    (p.moderation_status='approved' and p.published_at is not null and m.moderation_status='approved' and m.deleted_at is null and private.can_view_creator_activity(p.creator_id,v_viewer)));
  if not found then raise exception using errcode='42501',message='creator_activity_media_access_denied'; end if;
end;
$$;

create or replace function public.list_creator_activity_album(p_creator_username text,p_limit integer default 24,p_offset integer default 0)
returns table(post_id uuid,media_id uuid,storage_bucket text,storage_path text,width integer,height integer,body text,published_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
declare v_viewer uuid:=auth.uid(); v_creator uuid; v_limit integer:=least(greatest(coalesce(p_limit,24),1),60); v_offset integer:=least(greatest(coalesce(p_offset,0),0),500);
begin
  select p.id into v_creator from public.profiles p where lower(p.username::text)=lower(btrim(p_creator_username)) and p.deleted_at is null limit 1;
  if v_creator is null or not private.can_view_creator_activity(v_creator,v_viewer) then return; end if;
  return query select p.id,m.id,m.storage_bucket,m.storage_path,m.width,m.height,p.body,p.published_at
  from public.creator_posts p join public.creator_post_media pm on pm.post_id=p.id join public.media_assets m on m.id=pm.media_id
  where p.creator_id=v_creator and p.content_type='image' and p.moderation_status='approved' and p.published_at is not null and p.deleted_at is null and m.moderation_status='approved' and m.deleted_at is null
  order by p.published_at desc,p.id desc limit v_limit offset v_offset;
end;
$$;

drop function if exists public.get_profile_viewer(text);
create function public.get_profile_viewer(p_username text)
returns table(id uuid,username text,display_name text,bio text,gender public.gender_identity,province_id bigint,province_name text,avatar_media_id uuid,avatar_storage_bucket text,avatar_storage_path text,is_creator boolean,creator_bio text,interests text[],friendship_id uuid,friendship_status text,friendship_direction text,blocked_by_viewer boolean,public_album_count bigint,fan_album_available boolean,fan_access_granted boolean,fan_threshold_units bigint,fan_eligible_units bigint,fan_remaining_units bigint,age_years integer,last_active_at timestamptz,presence_status text,distance_km numeric,activity_visibility text,activity_can_view boolean,activity_gate_reason text,activity_post_count bigint,activity_image_count bigint)
language plpgsql stable security definer set search_path=''
as $$
declare v_viewer_id uuid:=auth.uid(); v_target_id uuid; v_blocked_by_viewer boolean:=false; v_blocked_by_target boolean:=false; v_activity_allowed boolean:=false;
begin
  if v_viewer_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.is_active_adult(v_viewer_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if nullif(btrim(p_username),'') is null then raise exception using errcode='22023',message='profile_username_required'; end if;
  select p.id into v_target_id from public.profiles p where lower(p.username::text)=lower(btrim(p_username)) and p.profile_status='active' and p.deleted_at is null and private.is_active_adult(p.id) limit 1;
  if v_target_id is null then return; end if;
  select exists(select 1 from public.user_blocks b where b.blocker_id=v_viewer_id and b.blocked_id=v_target_id) into v_blocked_by_viewer;
  select exists(select 1 from public.user_blocks b where b.blocker_id=v_target_id and b.blocked_id=v_viewer_id) into v_blocked_by_target;
  if v_blocked_by_target then return; end if;
  v_activity_allowed:=not v_blocked_by_viewer and private.can_view_creator_activity(v_target_id,v_viewer_id);
  return query
  with relationship as (
    select f.* from public.friendships f where f.pair_low_id=least(v_viewer_id,v_target_id) and f.pair_high_id=greatest(v_viewer_id,v_target_id) and f.status in ('pending','accepted') order by f.created_at desc limit 1
  ), creator as (
    select cp.creator_bio,cp.creator_status,cp.fan_threshold_units,cp.activity_visibility from public.creator_profiles cp where cp.user_id=v_target_id limit 1
  ), progress as (
    select coalesce(fp.eligible_units,0)::bigint eligible_units from public.fan_progress fp where fp.creator_id=v_target_id and fp.fan_user_id=v_viewer_id
    union all select 0::bigint where not exists(select 1 from public.fan_progress fp where fp.creator_id=v_target_id and fp.fan_user_id=v_viewer_id) limit 1
  ), activity_counts as (
    select count(*) filter(where p.moderation_status='approved' and p.published_at is not null)::bigint post_count,
      count(pm.media_id) filter(where p.content_type='image' and p.moderation_status='approved' and p.published_at is not null and m.moderation_status='approved' and m.deleted_at is null)::bigint image_count
    from public.creator_posts p left join public.creator_post_media pm on pm.post_id=p.id left join public.media_assets m on m.id=pm.media_id
    where p.creator_id=v_target_id and p.deleted_at is null
  )
  select p.id,p.username::text,p.display_name,p.bio,p.gender,p.province_id,area.name_vi,
    case when v_blocked_by_viewer then null else p.avatar_media_id end,
    case when v_blocked_by_viewer then null else avatar.storage_bucket end,
    case when v_blocked_by_viewer then null else avatar.storage_path end,
    (p.is_creator and coalesce(c.creator_status='approved',false)),case when c.creator_status='approved' then c.creator_bio else null end,coalesce(p.interests,'{}'::text[]),
    r.id,case when v_blocked_by_viewer then 'blocked' when r.id is null then 'none' else r.status::text end,
    case when v_blocked_by_viewer then 'outgoing_block' when r.id is null then 'none' when r.status='accepted' then 'mutual' when r.requester_id=v_viewer_id then 'outgoing' else 'incoming' end,
    v_blocked_by_viewer,case when v_activity_allowed then ac.image_count else 0 end,
    (not v_blocked_by_viewer and coalesce(c.creator_status='approved',false) and c.activity_visibility='fans' and ac.image_count>0),
    (not v_blocked_by_viewer and private.has_active_fan_membership(v_target_id,v_viewer_id)),greatest(coalesce(c.fan_threshold_units,1),1),pr.eligible_units,
    greatest(greatest(coalesce(c.fan_threshold_units,1),1)-pr.eligible_units,0)::bigint,
    extract(year from age(current_date,identity.date_of_birth))::integer,p.last_active_at,
    case when p.last_active_at>=now()-make_interval(mins=>coalesce(private.config_integer('creator_activity_online_window_minutes'),5)::integer) then 'online' else 'offline' end,
    case when viewer_location.user_id is not null and target_location.user_id is not null and viewer_profile.province_id is not distinct from p.province_id
      and viewer_location.is_enabled and target_location.is_enabled and viewer_location.expires_at>now() and target_location.expires_at>now()
      and viewer_location.captured_at>=now()-make_interval(mins=>coalesce(private.config_integer('nearby_location_fresh_minutes'),30)::integer)
      and target_location.captured_at>=now()-make_interval(mins=>coalesce(private.config_integer('nearby_location_fresh_minutes'),30)::integer)
      then case when extensions.st_distance(viewer_location.location,target_location.location)<1000 then 0::numeric else round((extensions.st_distance(viewer_location.location,target_location.location)/1000.0)::numeric,1) end else null::numeric end,
    case when c.creator_status='approved' then c.activity_visibility::text else null end,v_activity_allowed,
    case when not coalesce(c.creator_status='approved',false) then 'unavailable' when v_blocked_by_viewer then 'unavailable' when v_activity_allowed then 'none'
      when c.activity_visibility='friends' then 'friend_required' when c.activity_visibility='fans' then 'fan_required' else 'unavailable' end,
    case when v_activity_allowed then ac.post_count else 0 end,case when v_activity_allowed then ac.image_count else 0 end
  from public.profiles p join private.user_identity identity on identity.user_id=p.id
  left join public.administrative_areas area on area.id=p.province_id
  left join public.media_assets avatar on avatar.id=p.avatar_media_id and private.can_view_media_internal(avatar.id,v_viewer_id)
  left join relationship r on true left join creator c on true cross join progress pr cross join activity_counts ac
  join public.profiles viewer_profile on viewer_profile.id=v_viewer_id
  left join private.user_locations viewer_location on viewer_location.user_id=v_viewer_id
  left join private.user_locations target_location on target_location.user_id=v_target_id
  where p.id=v_target_id;
end;
$$;

revoke all on function private.has_accepted_friendship(uuid,uuid) from public,anon,authenticated;
revoke all on function private.can_view_creator_activity(uuid,uuid) from public,anon,authenticated;
grant execute on function private.has_accepted_friendship(uuid,uuid) to service_role;
grant execute on function private.can_view_creator_activity(uuid,uuid) to service_role;
revoke all on function public.get_creator_activity_access(text) from public;
grant execute on function public.get_creator_activity_access(text) to anon,authenticated,service_role;
revoke all on function public.set_my_creator_activity_visibility(text) from public,anon;
grant execute on function public.set_my_creator_activity_visibility(text) to authenticated,service_role;
revoke all on function public.create_creator_activity_post(text,text,uuid,text,uuid) from public,anon;
grant execute on function public.create_creator_activity_post(text,text,uuid,text,uuid) to authenticated,service_role;
revoke all on function public.list_creator_activity(text,integer,timestamptz,uuid) from public;
grant execute on function public.list_creator_activity(text,integer,timestamptz,uuid) to anon,authenticated,service_role;
revoke all on function public.get_creator_post_media_access(uuid) from public;
grant execute on function public.get_creator_post_media_access(uuid) to anon,authenticated,service_role;
revoke all on function public.list_creator_activity_album(text,integer,integer) from public;
grant execute on function public.list_creator_activity_album(text,integer,integer) to anon,authenticated,service_role;
revoke all on function public.get_profile_viewer(text) from public,anon;
grant execute on function public.get_profile_viewer(text) to authenticated,service_role;
revoke execute on function public.send_gift_and_unlock_creator_post(uuid,uuid) from anon,authenticated;

comment on column public.creator_profiles.activity_visibility is 'Whole Creator Activity and Activity-derived album privacy: public, accepted friends (active Fans also qualify), or active Fans only.';
comment on function private.can_view_creator_activity(uuid,uuid) is 'Single privacy predicate for whole Creator Activity, links, images and Activity-derived album.';
comment on table private.creator_post_unlocks is 'Deprecated per-post Activity entitlement table retained for migration history; whole-feed access now uses friendship or active fan membership.';
