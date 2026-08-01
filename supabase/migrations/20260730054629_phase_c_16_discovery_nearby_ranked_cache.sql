-- Phase C / Session 16
-- Province and privacy-safe Nearby discovery with 30-minute client cache semantics.
-- Exact coordinates and exact meter distances remain private. Client receives only
-- "< 1 km" or one-decimal kilometre values for same-province users with fresh location.

insert into private.app_config(key,value_json,value_type,description,is_public)
values
  ('discovery_cache_minutes','30'::jsonb,'integer','Client discovery data remains fresh for 30 minutes.','true'),
  ('discovery_page_size','24'::jsonb,'integer','Default number of discovery profiles requested while scrolling.','true'),
  ('discovery_max_results','200'::jsonb,'integer','Maximum profiles loaded in one discovery session.','true'),
  ('nearby_location_fresh_minutes','30'::jsonb,'integer','Location must be refreshed within this interval to show distance.','false')
on conflict(key) do update set
  value_json=excluded.value_json,
  value_type=excluded.value_type,
  description=excluded.description,
  is_public=excluded.is_public,
  updated_at=now();

-- Official province-level codes effective from 2025-07-01 under Decision 19/2025/QD-TTg.
insert into public.administrative_areas(code,name_vi,name_en,area_type,parent_id,country_code,sort_order,is_active)
values
 ('01','Hà Nội','Hanoi','municipality',null,'VN',1,true),
 ('04','Cao Bằng','Cao Bang','province',null,'VN',2,true),
 ('08','Tuyên Quang','Tuyen Quang','province',null,'VN',3,true),
 ('11','Điện Biên','Dien Bien','province',null,'VN',4,true),
 ('12','Lai Châu','Lai Chau','province',null,'VN',5,true),
 ('14','Sơn La','Son La','province',null,'VN',6,true),
 ('15','Lào Cai','Lao Cai','province',null,'VN',7,true),
 ('19','Thái Nguyên','Thai Nguyen','province',null,'VN',8,true),
 ('20','Lạng Sơn','Lang Son','province',null,'VN',9,true),
 ('22','Quảng Ninh','Quang Ninh','province',null,'VN',10,true),
 ('24','Bắc Ninh','Bac Ninh','province',null,'VN',11,true),
 ('25','Phú Thọ','Phu Tho','province',null,'VN',12,true),
 ('31','Hải Phòng','Hai Phong','municipality',null,'VN',13,true),
 ('33','Hưng Yên','Hung Yen','province',null,'VN',14,true),
 ('37','Ninh Bình','Ninh Binh','province',null,'VN',15,true),
 ('38','Thanh Hóa','Thanh Hoa','province',null,'VN',16,true),
 ('40','Nghệ An','Nghe An','province',null,'VN',17,true),
 ('42','Hà Tĩnh','Ha Tinh','province',null,'VN',18,true),
 ('44','Quảng Trị','Quang Tri','province',null,'VN',19,true),
 ('46','Huế','Hue','municipality',null,'VN',20,true),
 ('48','Đà Nẵng','Da Nang','municipality',null,'VN',21,true),
 ('51','Quảng Ngãi','Quang Ngai','province',null,'VN',22,true),
 ('52','Gia Lai','Gia Lai','province',null,'VN',23,true),
 ('56','Khánh Hòa','Khanh Hoa','province',null,'VN',24,true),
 ('66','Đắk Lắk','Dak Lak','province',null,'VN',25,true),
 ('68','Lâm Đồng','Lam Dong','province',null,'VN',26,true),
 ('75','Đồng Nai','Dong Nai','province',null,'VN',27,true),
 ('79','Thành phố Hồ Chí Minh','Ho Chi Minh City','municipality',null,'VN',28,true),
 ('80','Tây Ninh','Tay Ninh','province',null,'VN',29,true),
 ('82','Đồng Tháp','Dong Thap','province',null,'VN',30,true),
 ('86','Vĩnh Long','Vinh Long','province',null,'VN',31,true),
 ('91','An Giang','An Giang','province',null,'VN',32,true),
 ('92','Cần Thơ','Can Tho','municipality',null,'VN',33,true),
 ('96','Cà Mau','Ca Mau','province',null,'VN',34,true)
on conflict(country_code,code) do update set
  name_vi=excluded.name_vi,
  name_en=excluded.name_en,
  area_type=excluded.area_type,
  parent_id=null,
  sort_order=excluded.sort_order,
  is_active=true,
  updated_at=now();

create index if not exists profiles_discovery_scroll_idx
on public.profiles(province_id,last_active_at desc,id)
where discovery_enabled and profile_status='active' and deleted_at is null;

create or replace function public.get_my_discovery_context()
returns table(
  user_id uuid,
  province_id bigint,
  discovery_enabled boolean,
  nearby_enabled boolean,
  has_fresh_location boolean,
  location_captured_at timestamptz,
  cache_minutes integer,
  page_size integer,
  max_results integer
)
language sql
stable
security definer
set search_path=''
as $$
  with settings as (
    select
      coalesce((select (value_json#>>'{}')::integer from private.app_config where key='discovery_cache_minutes'),30) cache_minutes,
      coalesce((select (value_json#>>'{}')::integer from private.app_config where key='discovery_page_size'),24) page_size,
      coalesce((select (value_json#>>'{}')::integer from private.app_config where key='discovery_max_results'),200) max_results,
      coalesce((select (value_json#>>'{}')::integer from private.app_config where key='nearby_location_fresh_minutes'),30) fresh_minutes,
      coalesce((select (value_json#>>'{}')::integer from private.app_config where key='location_max_accuracy_meters'),5000) max_accuracy
  )
  select
    p.id,
    p.province_id,
    p.discovery_enabled,
    p.nearby_enabled,
    (
      p.nearby_enabled
      and ul.user_id is not null
      and ul.is_enabled
      and ul.expires_at>now()
      and ul.captured_at>now()-make_interval(mins=>s.fresh_minutes)
      and ul.accuracy_meters<=s.max_accuracy
    ) has_fresh_location,
    case when ul.is_enabled then ul.captured_at else null end,
    greatest(s.cache_minutes,1),
    least(greatest(s.page_size,1),40),
    least(greatest(s.max_results,1),200)
  from public.profiles p
  cross join settings s
  left join private.user_locations ul on ul.user_id=p.id
  where p.id=auth.uid() and private.is_active_adult(p.id)
$$;

revoke all on function public.get_my_discovery_context() from public,anon;
grant execute on function public.get_my_discovery_context() to authenticated,service_role;

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
  candidates as (
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
      case
        when s.mode='nearby'
          and caller.location is not null
          and caller.province_id is not null
          and p.province_id=caller.province_id
          and p.nearby_enabled
          and candidate_location.location is not null
        then extensions.st_distance(candidate_location.location,caller.location)
        else null
      end distance_meters,
      case
        when s.mode='province' then 0::smallint
        when caller.location is not null
          and caller.province_id is not null
          and p.province_id=caller.province_id
          and p.nearby_enabled
          and candidate_location.location is not null
        then 0::smallint
        when caller.province_id is not null and p.province_id=caller.province_id
        then 1::smallint
        else 2::smallint
      end sort_tier,
      s.mode,
      s.requested_limit,
      s.requested_offset,
      s.max_results
    from caller
    cross join settings s
    join public.profiles p on p.id<>caller.id
    left join public.administrative_areas area on area.id=p.province_id and area.is_active
    left join private.user_locations candidate_location
      on candidate_location.user_id=p.id
      and candidate_location.is_enabled
      and candidate_location.expires_at>now()
      and candidate_location.captured_at>now()-make_interval(mins=>s.fresh_minutes)
      and candidate_location.accuracy_meters<=s.max_accuracy
    left join public.media_assets media
      on media.id=p.avatar_media_id
      and media.deleted_at is null
      and media.moderation_status in ('pending_review','approved')
      and private.can_view_media_internal(media.id,caller.id)
    where s.mode<>'invalid'
      and p.profile_status='active'
      and p.deleted_at is null
      and p.discovery_enabled
      and private.is_active_adult(p.id)
      and not private.users_are_blocked(caller.id,p.id)
      and (s.mode='nearby' or (s.mode='province' and p.province_id=p_province_id))
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
  from candidates c
  order by
    c.sort_tier,
    c.distance_meters asc nulls last,
    c.last_active_at desc nulls last,
    c.id
  offset (select requested_offset from settings)
  limit (
    select least(requested_limit,greatest(max_results-requested_offset,0))
    from settings
  )
$$;

revoke all on function public.list_discovery_profiles(text,bigint,integer,integer) from public,anon;
grant execute on function public.list_discovery_profiles(text,bigint,integer,integer) to authenticated,service_role;
