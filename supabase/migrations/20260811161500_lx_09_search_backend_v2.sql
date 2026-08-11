-- LX-09: Seeking-derived Luxy Search Backend V2.
--
-- Privacy boundary:
-- - date_of_birth is joined only inside this SECURITY DEFINER RPC and is returned only as integer age;
-- - exact geography is joined only inside the RPC and is returned only as one-decimal distance_km;
-- - no private/KYC/bank fields or exact coordinates are returned;
-- - verification/favorite/view-history filters are intentionally deferred until LX-20/LX-12.
--
-- Compatibility boundary:
-- - legacy list_discovery_profiles(...) remains unchanged for the current UI;
-- - LX-10/LX-11 can adopt search_luxy_profiles_v2(...) without breaking the Beta discovery surface.

insert into private.app_config(key,value_json,value_type,description,is_public)
values
  ('luxy_search_online_minutes','15'::jsonb,'integer','Member is considered online in Luxy Search when last_active_at is within this many minutes.','true')
on conflict(key) do update set
  value_json=excluded.value_json,
  value_type=excluded.value_type,
  description=excluded.description,
  is_public=excluded.is_public,
  updated_at=now();

create index if not exists profiles_luxy_search_recent_idx
on public.profiles(last_active_at desc,id)
where discovery_enabled and profile_status='active' and deleted_at is null;

create index if not exists profiles_luxy_search_newest_idx
on public.profiles(created_at desc,id)
where discovery_enabled and profile_status='active' and deleted_at is null;

create index if not exists profiles_luxy_languages_gin_idx
on public.profiles using gin(languages)
where discovery_enabled and profile_status='active' and deleted_at is null;

create or replace function public.search_luxy_profiles_v2(
  p_sort text default 'distance',
  p_province_id bigint default null,
  p_max_distance_km numeric default null,
  p_min_age smallint default 18,
  p_max_age smallint default 99,
  p_genders public.gender_identity[] default null,
  p_min_height_cm smallint default null,
  p_max_height_cm smallint default null,
  p_min_weight_kg smallint default null,
  p_max_weight_kg smallint default null,
  p_relationship_statuses public.relationship_status[] default null,
  p_children_statuses public.children_status[] default null,
  p_smoking_statuses public.smoking_status[] default null,
  p_drinking_statuses public.drinking_status[] default null,
  p_education_levels public.education_level[] default null,
  p_lifestyle_tags public.profile_lifestyle_tag[] default null,
  p_languages text[] default null,
  p_interests text[] default null,
  p_has_photo boolean default null,
  p_online_now boolean default null,
  p_occupation_text text default null,
  p_profile_text text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table(
  id uuid,
  username text,
  display_name text,
  headline text,
  bio text,
  gender public.gender_identity,
  age smallint,
  province_id bigint,
  province_name text,
  avatar_media_id uuid,
  avatar_storage_bucket text,
  avatar_storage_path text,
  photo_count integer,
  interests text[],
  height_cm smallint,
  weight_kg smallint,
  relationship_status public.relationship_status,
  children_status public.children_status,
  smoking_status public.smoking_status,
  drinking_status public.drinking_status,
  education_level public.education_level,
  occupation text,
  looking_for text,
  lifestyle_tags public.profile_lifestyle_tag[],
  languages text[],
  last_active_at timestamptz,
  is_online boolean,
  distance_km numeric,
  member_since timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_sort text := lower(btrim(coalesce(p_sort,'')));
  v_online_minutes integer;
  v_limit integer := least(greatest(coalesce(p_limit,24),1),40);
  v_offset integer := least(greatest(coalesce(p_offset,0),0),199);
  v_profile_text text := nullif(lower(btrim(coalesce(p_profile_text,''))), '');
  v_occupation_text text := nullif(lower(btrim(coalesce(p_occupation_text,''))), '');
begin
  if v_user_id is null then
    raise exception using errcode='28000', message='authentication_required';
  end if;

  if not private.is_active_adult(v_user_id) then
    raise exception using errcode='42501', message='adult_onboarding_required';
  end if;

  if v_sort not in ('distance','recent','newest') then
    raise exception using errcode='22023', message='invalid_search_sort';
  end if;
  if p_min_age is null or p_max_age is null or p_min_age < 18 or p_max_age > 99 or p_min_age > p_max_age then
    raise exception using errcode='22023', message='invalid_search_age_range';
  end if;
  if p_min_height_cm is not null and (p_min_height_cm < 120 or p_min_height_cm > 230) then
    raise exception using errcode='22023', message='invalid_search_height_range';
  end if;
  if p_max_height_cm is not null and (p_max_height_cm < 120 or p_max_height_cm > 230) then
    raise exception using errcode='22023', message='invalid_search_height_range';
  end if;
  if p_min_height_cm is not null and p_max_height_cm is not null and p_min_height_cm > p_max_height_cm then
    raise exception using errcode='22023', message='invalid_search_height_range';
  end if;
  if p_min_weight_kg is not null and (p_min_weight_kg < 35 or p_min_weight_kg > 250) then
    raise exception using errcode='22023', message='invalid_search_weight_range';
  end if;
  if p_max_weight_kg is not null and (p_max_weight_kg < 35 or p_max_weight_kg > 250) then
    raise exception using errcode='22023', message='invalid_search_weight_range';
  end if;
  if p_min_weight_kg is not null and p_max_weight_kg is not null and p_min_weight_kg > p_max_weight_kg then
    raise exception using errcode='22023', message='invalid_search_weight_range';
  end if;
  if p_max_distance_km is not null and (p_max_distance_km <= 0 or p_max_distance_km > 3000) then
    raise exception using errcode='22023', message='invalid_search_distance';
  end if;
  if cardinality(coalesce(p_lifestyle_tags,'{}'::public.profile_lifestyle_tag[])) > 12 then
    raise exception using errcode='22023', message='too_many_search_lifestyle_tags';
  end if;
  if cardinality(coalesce(p_languages,'{}'::text[])) > 8 then
    raise exception using errcode='22023', message='too_many_search_languages';
  end if;
  if cardinality(coalesce(p_interests,'{}'::text[])) > 12 then
    raise exception using errcode='22023', message='too_many_search_interests';
  end if;
  if v_profile_text is not null and char_length(v_profile_text) > 120 then
    raise exception using errcode='22023', message='invalid_search_profile_text';
  end if;
  if v_occupation_text is not null and char_length(v_occupation_text) > 120 then
    raise exception using errcode='22023', message='invalid_search_occupation_text';
  end if;
  if p_province_id is not null and not exists(
    select 1 from public.administrative_areas a
    where a.id=p_province_id and a.country_code='VN' and a.is_active
  ) then
    raise exception using errcode='22023', message='invalid_search_province';
  end if;

  select coalesce((value_json#>>'{}')::integer,15)
  into v_online_minutes
  from private.app_config
  where key='luxy_search_online_minutes';
  v_online_minutes := least(greatest(coalesce(v_online_minutes,15),1),120);

  return query
  with caller as (
    select
      p.id,
      p.gender,
      p.interested_in,
      case
        when p.nearby_enabled
          and ul.is_enabled
          and ul.expires_at>now()
          and ul.captured_at>now()-make_interval(mins=>coalesce((select (value_json#>>'{}')::integer from private.app_config where key='nearby_location_fresh_minutes'),30))
          and ul.accuracy_meters<=coalesce((select (value_json#>>'{}')::integer from private.app_config where key='location_max_accuracy_meters'),5000)
        then ul.location
        else null
      end location
    from public.profiles p
    left join private.user_locations ul on ul.user_id=p.id
    where p.id=v_user_id
  ),
  base as (
    select
      p.id,
      p.username::text username,
      p.display_name,
      p.headline,
      p.bio,
      p.gender,
      extract(year from age(current_date,ui.date_of_birth))::smallint age,
      p.province_id,
      area.name_vi province_name,
      p.avatar_media_id,
      avatar.storage_bucket avatar_storage_bucket,
      avatar.storage_path avatar_storage_path,
      coalesce(photos.photo_count,0)::integer photo_count,
      p.interests,
      p.height_cm,
      p.weight_kg,
      p.relationship_status,
      p.children_status,
      p.smoking_status,
      p.drinking_status,
      p.education_level,
      p.occupation,
      p.looking_for,
      p.lifestyle_tags,
      p.languages,
      p.last_active_at,
      (p.last_active_at is not null and p.last_active_at >= now()-make_interval(mins=>v_online_minutes)) is_online,
      case
        when caller.location is not null and p.nearby_enabled and candidate_location.location is not null
        then extensions.st_distance(candidate_location.location,caller.location)
        else null
      end distance_meters,
      p.created_at member_since
    from caller
    join public.profiles p on p.id<>caller.id
    join private.user_identity ui on ui.user_id=p.id
    left join public.administrative_areas area on area.id=p.province_id and area.country_code='VN' and area.is_active
    left join private.user_locations candidate_location
      on candidate_location.user_id=p.id
      and candidate_location.is_enabled
      and candidate_location.expires_at>now()
      and candidate_location.captured_at>now()-make_interval(mins=>coalesce((select (value_json#>>'{}')::integer from private.app_config where key='nearby_location_fresh_minutes'),30))
      and candidate_location.accuracy_meters<=coalesce((select (value_json#>>'{}')::integer from private.app_config where key='location_max_accuracy_meters'),5000)
    left join public.media_assets avatar
      on avatar.id=p.avatar_media_id
      and avatar.owner_id=p.id
      and avatar.visibility='avatar'
      and avatar.moderation_status in ('pending_review','approved')
      and avatar.deleted_at is null
      and avatar.uploaded_at is not null
      and private.can_view_media_internal(avatar.id,caller.id)
    left join lateral (
      select count(*)::integer photo_count
      from public.media_assets m
      where m.owner_id=p.id
        and m.deleted_at is null
        and m.uploaded_at is not null
        and m.moderation_status in ('pending_review','approved')
        and m.visibility in ('avatar','public')
        and private.can_view_media_internal(m.id,caller.id)
    ) photos on true
    where p.profile_status='active'
      and p.deleted_at is null
      and p.discovery_enabled
      and private.is_active_adult(p.id)
      and not private.users_are_blocked(caller.id,p.id)
      and ui.date_of_birth is not null
      and (p_province_id is null or p.province_id=p_province_id)
      and extract(year from age(current_date,ui.date_of_birth)) between p_min_age and p_max_age
      and (
        (p_genders is not null and cardinality(p_genders)>0 and p.gender=any(p_genders))
        or (
          (p_genders is null or cardinality(p_genders)=0)
          and (
            caller.interested_in='everyone'
            or (caller.interested_in='female' and p.gender='female')
            or (caller.interested_in='male' and p.gender='male')
          )
        )
      )
      and (
        caller.gender not in ('male','female')
        or p.interested_in='everyone'
        or (caller.gender='female' and p.interested_in='female')
        or (caller.gender='male' and p.interested_in='male')
      )
      and (p_min_height_cm is null or p.height_cm>=p_min_height_cm)
      and (p_max_height_cm is null or p.height_cm<=p_max_height_cm)
      and (p_min_weight_kg is null or p.weight_kg>=p_min_weight_kg)
      and (p_max_weight_kg is null or p.weight_kg<=p_max_weight_kg)
      and (p_relationship_statuses is null or cardinality(p_relationship_statuses)=0 or p.relationship_status=any(p_relationship_statuses))
      and (p_children_statuses is null or cardinality(p_children_statuses)=0 or p.children_status=any(p_children_statuses))
      and (p_smoking_statuses is null or cardinality(p_smoking_statuses)=0 or p.smoking_status=any(p_smoking_statuses))
      and (p_drinking_statuses is null or cardinality(p_drinking_statuses)=0 or p.drinking_status=any(p_drinking_statuses))
      and (p_education_levels is null or cardinality(p_education_levels)=0 or p.education_level=any(p_education_levels))
      and (p_lifestyle_tags is null or cardinality(p_lifestyle_tags)=0 or p.lifestyle_tags @> p_lifestyle_tags)
      and (
        p_languages is null or cardinality(p_languages)=0
        or not exists(
          select 1 from unnest(p_languages) wanted
          where not exists(
            select 1 from unnest(p.languages) actual
            where lower(btrim(actual))=lower(btrim(wanted))
          )
        )
      )
      and (
        p_interests is null or cardinality(p_interests)=0
        or not exists(
          select 1 from unnest(p_interests) wanted
          where not exists(
            select 1 from unnest(p.interests) actual
            where lower(btrim(actual))=lower(btrim(wanted))
          )
        )
      )
      and (v_occupation_text is null or lower(coalesce(p.occupation,'')) like '%'||v_occupation_text||'%')
      and (
        v_profile_text is null
        or lower(coalesce(p.username::text,'')) like '%'||v_profile_text||'%'
        or lower(coalesce(p.display_name,'')) like '%'||v_profile_text||'%'
        or lower(coalesce(p.headline,'')) like '%'||v_profile_text||'%'
        or lower(coalesce(p.bio,'')) like '%'||v_profile_text||'%'
        or lower(coalesce(p.looking_for,'')) like '%'||v_profile_text||'%'
        or lower(coalesce(p.occupation,'')) like '%'||v_profile_text||'%'
      )
  ),
  filtered as (
    select * from base b
    where (p_max_distance_km is null or (b.distance_meters is not null and b.distance_meters <= p_max_distance_km*1000.0))
      and (p_has_photo is null or (p_has_photo and b.photo_count>0) or (not p_has_photo and b.photo_count=0))
      and (p_online_now is null or b.is_online=p_online_now)
  )
  select
    f.id,
    f.username,
    f.display_name,
    f.headline,
    f.bio,
    f.gender,
    f.age,
    f.province_id,
    f.province_name,
    f.avatar_media_id,
    f.avatar_storage_bucket,
    f.avatar_storage_path,
    f.photo_count,
    f.interests,
    f.height_cm,
    f.weight_kg,
    f.relationship_status,
    f.children_status,
    f.smoking_status,
    f.drinking_status,
    f.education_level,
    f.occupation,
    f.looking_for,
    f.lifestyle_tags,
    f.languages,
    f.last_active_at,
    f.is_online,
    case when f.distance_meters is null then null else round((f.distance_meters/1000.0)::numeric,1) end distance_km,
    f.member_since
  from filtered f
  order by
    case when v_sort='distance' then (f.distance_meters is null)::integer end asc,
    case when v_sort='distance' then f.distance_meters end asc nulls last,
    case when v_sort='recent' then f.last_active_at end desc nulls last,
    case when v_sort='newest' then f.member_since end desc nulls last,
    f.last_active_at desc nulls last,
    f.id
  offset v_offset
  limit least(v_limit,greatest(200-v_offset,0));
end;
$$;

revoke all on function public.search_luxy_profiles_v2(
  text,bigint,numeric,smallint,smallint,public.gender_identity[],smallint,smallint,smallint,smallint,
  public.relationship_status[],public.children_status[],public.smoking_status[],public.drinking_status[],
  public.education_level[],public.profile_lifestyle_tag[],text[],text[],boolean,boolean,text,text,integer,integer
) from public,anon;

grant execute on function public.search_luxy_profiles_v2(
  text,bigint,numeric,smallint,smallint,public.gender_identity[],smallint,smallint,smallint,smallint,
  public.relationship_status[],public.children_status[],public.smoking_status[],public.drinking_status[],
  public.education_level[],public.profile_lifestyle_tag[],text[],text[],boolean,boolean,text,text,integer,integer
) to authenticated,service_role;

comment on function public.search_luxy_profiles_v2(
  text,bigint,numeric,smallint,smallint,public.gender_identity[],smallint,smallint,smallint,smallint,
  public.relationship_status[],public.children_status[],public.smoking_status[],public.drinking_status[],
  public.education_level[],public.profile_lifestyle_tag[],text[],text[],boolean,boolean,text,text,integer,integer
) is
  'LX-09 privacy-safe Luxy search. Uses private DOB/geography only to derive age and rounded distance; returns no DOB, exact coordinates, KYC or financial data. Missing candidate location ranks after located candidates for distance sort. Verification/favorite/view-history filters are deferred to their dedicated sessions.';
