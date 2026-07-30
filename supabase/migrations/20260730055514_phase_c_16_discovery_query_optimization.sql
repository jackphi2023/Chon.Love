-- Phase C / Session 16 query optimization
-- Bound each discovery tier before the final merge and use the PostGIS GiST KNN
-- operator for same-province profiles that can expose a rounded distance.

create index if not exists profiles_discovery_recent_idx
on public.profiles(last_active_at desc,id)
where discovery_enabled and profile_status='active' and deleted_at is null;

create or replace function public.list_discovery_profiles(
  p_mode text default 'nearby',
  p_province_id bigint default null,
  p_limit integer default 24,
  p_offset integer default 0
)
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
  interests text[],
  last_active_at timestamptz,
  distance_km numeric,
  sort_tier smallint
)
language sql
stable
security definer
set search_path=''
as $$
  with settings as (
    select
      case when p_mode in ('nearby','province') then p_mode else 'invalid' end mode,
      least(greatest(coalesce(p_limit,24),1),40) requested_limit,
      least(greatest(coalesce(p_offset,0),0),199) requested_offset,
      least(greatest(coalesce((select (value_json#>>'{}')::integer from private.app_config where key='discovery_max_results'),200),1),200) max_results,
      coalesce((select (value_json#>>'{}')::integer from private.app_config where key='nearby_location_fresh_minutes'),30) fresh_minutes,
      coalesce((select (value_json#>>'{}')::integer from private.app_config where key='location_max_accuracy_meters'),5000) max_accuracy
  ),
  caller as (
    select
      p.id,
      p.province_id,
      case
        when p.nearby_enabled
          and ul.is_enabled
          and ul.expires_at>now()
          and ul.captured_at>now()-make_interval(mins=>s.fresh_minutes)
          and ul.accuracy_meters<=s.max_accuracy
        then ul.location
        else null
      end location
    from public.profiles p
    cross join settings s
    left join private.user_locations ul on ul.user_id=p.id
    where p.id=auth.uid() and private.is_active_adult(p.id)
  ),
  province_results as (
    select
      p.id,
      p.username::text username,
      p.display_name,
      p.bio,
      p.gender,
      p.province_id,
      area.name_vi province_name,
      p.avatar_media_id,
      media.storage_bucket avatar_storage_bucket,
      media.storage_path avatar_storage_path,
      p.is_creator,
      p.interests,
      p.last_active_at,
      null::double precision distance_meters,
      0::smallint sort_tier
    from caller
    cross join settings s
    join public.profiles p on p.id<>caller.id and p.province_id=p_province_id
    left join public.administrative_areas area on area.id=p.province_id and area.is_active
    left join public.media_assets media
      on media.id=p.avatar_media_id
      and media.deleted_at is null
      and media.moderation_status in ('pending_review','approved')
      and private.can_view_media_internal(media.id,caller.id)
    where s.mode='province'
      and p.profile_status='active'
      and p.deleted_at is null
      and p.discovery_enabled
      and private.is_active_adult(p.id)
      and not private.users_are_blocked(caller.id,p.id)
    order by p.last_active_at desc nulls last,p.id
    limit (select max_results from settings)
  ),
  located_same_province as (
    select
      p.id,
      p.username::text username,
      p.display_name,
      p.bio,
      p.gender,
      p.province_id,
      area.name_vi province_name,
      p.avatar_media_id,
      media.storage_bucket avatar_storage_bucket,
      media.storage_path avatar_storage_path,
      p.is_creator,
      p.interests,
      p.last_active_at,
      extensions.st_distance(candidate_location.location,caller.location) distance_meters,
      0::smallint sort_tier
    from caller
    cross join settings s
    join private.user_locations candidate_location
      on caller.location is not null
      and candidate_location.user_id<>caller.id
      and candidate_location.is_enabled
      and candidate_location.expires_at>now()
      and candidate_location.captured_at>now()-make_interval(mins=>s.fresh_minutes)
      and candidate_location.accuracy_meters<=s.max_accuracy
    join public.profiles p
      on p.id=candidate_location.user_id
      and p.province_id=caller.province_id
      and p.nearby_enabled
    left join public.administrative_areas area on area.id=p.province_id and area.is_active
    left join public.media_assets media
      on media.id=p.avatar_media_id
      and media.deleted_at is null
      and media.moderation_status in ('pending_review','approved')
      and private.can_view_media_internal(media.id,caller.id)
    where s.mode='nearby'
      and p.profile_status='active'
      and p.deleted_at is null
      and p.discovery_enabled
      and private.is_active_adult(p.id)
      and not private.users_are_blocked(caller.id,p.id)
    order by candidate_location.location OPERATOR(extensions.<->) caller.location,p.id
    limit (select max_results from settings)
  ),
  same_province_without_distance as (
    select
      p.id,
      p.username::text username,
      p.display_name,
      p.bio,
      p.gender,
      p.province_id,
      area.name_vi province_name,
      p.avatar_media_id,
      media.storage_bucket avatar_storage_bucket,
      media.storage_path avatar_storage_path,
      p.is_creator,
      p.interests,
      p.last_active_at,
      null::double precision distance_meters,
      1::smallint sort_tier
    from caller
    cross join settings s
    join public.profiles p
      on p.id<>caller.id
      and caller.province_id is not null
      and p.province_id=caller.province_id
    left join private.user_locations candidate_location
      on candidate_location.user_id=p.id
      and candidate_location.is_enabled
      and candidate_location.expires_at>now()
      and candidate_location.captured_at>now()-make_interval(mins=>s.fresh_minutes)
      and candidate_location.accuracy_meters<=s.max_accuracy
    left join public.administrative_areas area on area.id=p.province_id and area.is_active
    left join public.media_assets media
      on media.id=p.avatar_media_id
      and media.deleted_at is null
      and media.moderation_status in ('pending_review','approved')
      and private.can_view_media_internal(media.id,caller.id)
    where s.mode='nearby'
      and p.profile_status='active'
      and p.deleted_at is null
      and p.discovery_enabled
      and private.is_active_adult(p.id)
      and not private.users_are_blocked(caller.id,p.id)
      and (caller.location is null or not p.nearby_enabled or candidate_location.user_id is null)
    order by p.last_active_at desc nulls last,p.id
    limit (select max_results from settings)
  ),
  outside_province as (
    select
      p.id,
      p.username::text username,
      p.display_name,
      p.bio,
      p.gender,
      p.province_id,
      area.name_vi province_name,
      p.avatar_media_id,
      media.storage_bucket avatar_storage_bucket,
      media.storage_path avatar_storage_path,
      p.is_creator,
      p.interests,
      p.last_active_at,
      null::double precision distance_meters,
      2::smallint sort_tier
    from caller
    cross join settings s
    join public.profiles p
      on p.id<>caller.id
      and (caller.province_id is null or p.province_id is distinct from caller.province_id)
    left join public.administrative_areas area on area.id=p.province_id and area.is_active
    left join public.media_assets media
      on media.id=p.avatar_media_id
      and media.deleted_at is null
      and media.moderation_status in ('pending_review','approved')
      and private.can_view_media_internal(media.id,caller.id)
    where s.mode='nearby'
      and p.profile_status='active'
      and p.deleted_at is null
      and p.discovery_enabled
      and private.is_active_adult(p.id)
      and not private.users_are_blocked(caller.id,p.id)
    order by p.last_active_at desc nulls last,p.id
    limit (select max_results from settings)
  ),
  combined as (
    select * from province_results
    union all select * from located_same_province
    union all select * from same_province_without_distance
    union all select * from outside_province
  )
  select
    c.id,
    c.username,
    c.display_name,
    c.bio,
    c.gender,
    c.province_id,
    c.province_name,
    c.avatar_media_id,
    c.avatar_storage_bucket,
    c.avatar_storage_path,
    c.is_creator,
    c.interests,
    c.last_active_at,
    case
      when c.distance_meters is null then null
      when c.distance_meters<1000 then 0::numeric
      else round((c.distance_meters/1000.0)::numeric,1)
    end distance_km,
    c.sort_tier
  from combined c
  order by c.sort_tier,c.distance_meters asc nulls last,c.last_active_at desc nulls last,c.id
  offset (select requested_offset from settings)
  limit (
    select least(requested_limit,greatest(max_results-requested_offset,0))
    from settings
  )
$$;

revoke all on function public.list_discovery_profiles(text,bigint,integer,integer) from public,anon;
grant execute on function public.list_discovery_profiles(text,bigint,integer,integer) to authenticated,service_role;
