create or replace function public.get_profile_viewer(p_username text)
returns table(
  id uuid,
  username text,
  display_name text,
  bio text,
  gender public.gender_identity,
  province_id bigint,
  province_name text,
  avatar_media_id uuid,
  avatar_storage_bucket text,
  avatar_storage_path text,
  is_creator boolean,
  creator_bio text,
  interests text[],
  friendship_id uuid,
  friendship_status text,
  friendship_direction text,
  blocked_by_viewer boolean,
  public_album_count bigint,
  fan_album_available boolean,
  fan_access_granted boolean,
  fan_threshold_units bigint,
  fan_eligible_units bigint,
  fan_remaining_units bigint,
  age_years integer,
  last_active_at timestamptz,
  presence_status text,
  distance_km numeric,
  activity_visibility text,
  activity_can_view boolean,
  activity_gate_reason text,
  activity_post_count bigint,
  activity_image_count bigint
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_viewer_id uuid:=auth.uid();
  v_target_id uuid;
  v_identifier text:=lower(btrim(coalesce(p_username,'')));
  v_public_code text:=regexp_replace(lower(btrim(coalesce(p_username,''))), '^id-', '');
  v_blocked_by_viewer boolean:=false;
  v_blocked_by_target boolean:=false;
  v_activity_allowed boolean:=false;
begin
  if v_viewer_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.is_active_adult(v_viewer_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if v_identifier='' then raise exception using errcode='22023',message='profile_username_required'; end if;

  select p.id into v_target_id
  from public.profiles p
  where (
      lower(p.username::text)=v_identifier
      or (v_identifier ~ '^id-[0-9a-f]{6}$' and p.public_profile_code=v_public_code)
    )
    and p.profile_status='active'
    and p.deleted_at is null
    and private.is_active_adult(p.id)
  order by case when p.public_profile_code=v_public_code then 0 else 1 end
  limit 1;

  if v_target_id is null then return; end if;
  select exists(select 1 from public.user_blocks b where b.blocker_id=v_viewer_id and b.blocked_id=v_target_id) into v_blocked_by_viewer;
  select exists(select 1 from public.user_blocks b where b.blocker_id=v_target_id and b.blocked_id=v_viewer_id) into v_blocked_by_target;
  if v_blocked_by_target then return; end if;
  v_activity_allowed:=not v_blocked_by_viewer and private.can_view_creator_activity(v_target_id,v_viewer_id);

  return query
  with relationship as (
    select f.* from public.friendships f
    where f.pair_low_id=least(v_viewer_id,v_target_id)
      and f.pair_high_id=greatest(v_viewer_id,v_target_id)
      and f.status in ('pending','accepted')
    order by f.created_at desc limit 1
  ), creator as (
    select cp.creator_bio,cp.creator_status,cp.fan_threshold_units,cp.activity_visibility
    from public.creator_profiles cp where cp.user_id=v_target_id limit 1
  ), progress as (
    select coalesce(fp.eligible_units,0)::bigint eligible_units
    from public.fan_progress fp where fp.creator_id=v_target_id and fp.fan_user_id=v_viewer_id
    union all select 0::bigint
    where not exists(select 1 from public.fan_progress fp where fp.creator_id=v_target_id and fp.fan_user_id=v_viewer_id)
    limit 1
  ), activity_counts as (
    select count(*) filter(where p.moderation_status='approved' and p.published_at is not null)::bigint post_count,
      count(pm.media_id) filter(where p.content_type='image' and p.moderation_status='approved' and p.published_at is not null and m.moderation_status='approved' and m.deleted_at is null)::bigint image_count
    from public.creator_posts p
    left join public.creator_post_media pm on pm.post_id=p.id
    left join public.media_assets m on m.id=pm.media_id
    where p.creator_id=v_target_id and p.deleted_at is null
  )
  select p.id,p.username::text,p.display_name,p.bio,p.gender,p.province_id,area.name_vi,
    case when v_blocked_by_viewer then null else p.avatar_media_id end,
    case when v_blocked_by_viewer then null else avatar.storage_bucket end,
    case when v_blocked_by_viewer then null else avatar.storage_path end,
    (p.is_creator and coalesce(c.creator_status='approved',false)),
    case when c.creator_status='approved' then c.creator_bio else null end,
    coalesce(p.interests,'{}'::text[]),
    r.id,
    case when v_blocked_by_viewer then 'blocked' when r.id is null then 'none' else r.status::text end,
    case when v_blocked_by_viewer then 'outgoing_block' when r.id is null then 'none' when r.status='accepted' then 'mutual' when r.requester_id=v_viewer_id then 'outgoing' else 'incoming' end,
    v_blocked_by_viewer,
    case when v_activity_allowed then ac.image_count else 0 end,
    (not v_blocked_by_viewer and coalesce(c.creator_status='approved',false) and c.activity_visibility='fans' and ac.image_count>0),
    (not v_blocked_by_viewer and private.has_active_fan_membership(v_target_id,v_viewer_id)),
    greatest(coalesce(c.fan_threshold_units,1),1),
    pr.eligible_units,
    greatest(greatest(coalesce(c.fan_threshold_units,1),1)-pr.eligible_units,0)::bigint,
    extract(year from age(current_date,identity.date_of_birth))::integer,
    p.last_active_at,
    case when p.last_active_at>=now()-make_interval(mins=>coalesce(private.config_integer('creator_activity_online_window_minutes'),5)::integer) then 'online' else 'offline' end,
    case when viewer_location.user_id is not null and target_location.user_id is not null and p.province_id is not null and viewer_profile.province_id = p.province_id
      and viewer_location.is_enabled and target_location.is_enabled and viewer_location.expires_at>now() and target_location.expires_at>now()
      and viewer_location.captured_at>=now()-make_interval(mins=>coalesce(private.config_integer('nearby_location_fresh_minutes'),30)::integer)
      and target_location.captured_at>=now()-make_interval(mins=>coalesce(private.config_integer('nearby_location_fresh_minutes'),30)::integer)
      then case when extensions.st_distance(viewer_location.location,target_location.location)<1000 then 0::numeric else round((extensions.st_distance(viewer_location.location,target_location.location)/1000.0)::numeric,1) end else null::numeric end,
    case when c.creator_status='approved' then c.activity_visibility::text else null end,
    v_activity_allowed,
    case when not coalesce(c.creator_status='approved',false) then 'unavailable' when v_blocked_by_viewer then 'unavailable' when v_activity_allowed then 'none'
      when c.activity_visibility='friends' then 'friend_required' when c.activity_visibility='fans' then 'fan_required' else 'unavailable' end,
    case when v_activity_allowed then ac.post_count else 0 end,
    case when v_activity_allowed then ac.image_count else 0 end
  from public.profiles p
  join private.user_identity identity on identity.user_id=p.id
  left join public.administrative_areas area on area.id=p.province_id
  left join public.media_assets avatar on avatar.id=p.avatar_media_id and private.can_view_media_internal(avatar.id,v_viewer_id)
  left join relationship r on true
  left join creator c on true
  cross join progress pr
  cross join activity_counts ac
  join public.profiles viewer_profile on viewer_profile.id=v_viewer_id
  left join private.user_locations viewer_location on viewer_location.user_id=v_viewer_id
  left join private.user_locations target_location on target_location.user_id=v_target_id
  where p.id=v_target_id;
end;
$$;

comment on function public.get_profile_viewer(text) is
  'Authenticated rich profile view. Accepts legacy username or canonical id-xxxxxx public member identifier without exposing auth UUIDs in URLs.';