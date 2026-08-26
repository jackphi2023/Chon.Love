-- Chon.Love scoped UI polish backend contracts.
-- 1) Explicit foreground location update opts the viewer into Nearby.
-- 2) Connect count is independent from pagination and uses the same privacy/filter predicates as Search V2.
-- 3) Public share V2 exposes only public profile facts, approved public media IDs and a private-photo count.

create or replace function public.set_my_location(
  p_latitude double precision,p_longitude double precision,p_accuracy_meters integer,p_captured_at timestamptz,p_source text default 'device_foreground'
)
returns table(is_enabled boolean,captured_at timestamptz,expires_at timestamptz)
language plpgsql security definer set search_path=''
as $$
declare v_user_id uuid:=auth.uid(); v_now timestamptz:=now(); v_max_accuracy integer; v_stale_days integer; v_expires_at timestamptz;
begin
 if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
 if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
 if p_latitude is null or p_latitude < -90 or p_latitude > 90 or p_longitude is null or p_longitude < -180 or p_longitude > 180 then raise exception using errcode='22023',message='invalid_coordinates'; end if;
 if p_accuracy_meters is null or p_accuracy_meters<0 then raise exception using errcode='22023',message='invalid_location_accuracy'; end if;
 if p_captured_at is null or p_captured_at>v_now+interval '5 minutes' or p_captured_at<v_now-interval '24 hours' then raise exception using errcode='22023',message='invalid_location_capture_time'; end if;
 if p_source not in ('device_foreground','device_approximate') then raise exception using errcode='22023',message='invalid_location_source'; end if;
 select (value_json#>>'{}')::integer into v_max_accuracy from private.app_config where key='location_max_accuracy_meters';
 select (value_json#>>'{}')::integer into v_stale_days from private.app_config where key='location_stale_after_days';
 if p_accuracy_meters>coalesce(v_max_accuracy,5000) then raise exception using errcode='22023',message='location_accuracy_too_low'; end if;
 if exists(select 1 from private.location_events e where e.user_id=v_user_id and e.event_type='set' and e.occurred_at>v_now-interval '30 seconds') then raise exception using errcode='54000',message='location_update_rate_limited'; end if;
 v_expires_at:=p_captured_at+make_interval(days=>coalesce(v_stale_days,7));
 insert into private.user_locations(user_id,location,accuracy_meters,captured_at,consented_at,is_enabled,source,expires_at)
 values(v_user_id,extensions.st_setsrid(extensions.st_makepoint(p_longitude,p_latitude),4326)::extensions.geography,p_accuracy_meters,p_captured_at,v_now,true,p_source,v_expires_at)
 on conflict(user_id) do update set location=excluded.location,accuracy_meters=excluded.accuracy_meters,captured_at=excluded.captured_at,consented_at=excluded.consented_at,is_enabled=true,source=excluded.source,expires_at=excluded.expires_at;
 update public.profiles set nearby_enabled=true,updated_at=v_now where id=v_user_id and not nearby_enabled;
 insert into private.location_events(user_id,event_type,source,accuracy_meters) values(v_user_id,'set',p_source,p_accuracy_meters);
 return query select true,p_captured_at,v_expires_at;
end $$;
revoke all on function public.set_my_location(double precision,double precision,integer,timestamptz,text) from public,anon;
grant execute on function public.set_my_location(double precision,double precision,integer,timestamptz,text) to authenticated;

create or replace function public.count_luxy_profiles_v2(
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
  p_view_state text default null,
  p_favorite_scope text default null
)
returns bigint language plpgsql stable security definer set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_view_state text:=nullif(lower(btrim(coalesce(p_view_state,''))),'');
  v_favorite_scope text:=nullif(lower(btrim(coalesce(p_favorite_scope,''))),'');
  v_online_minutes integer;
  v_profile_text text:=nullif(lower(btrim(coalesce(p_profile_text,''))),'');
  v_occupation_text text:=nullif(lower(btrim(coalesce(p_occupation_text,''))),'');
  v_count bigint:=0;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='adult_onboarding_required'; end if;
  if v_view_state is not null and v_view_state not in ('viewed','unviewed') then raise exception using errcode='22023',message='invalid_search_view_state'; end if;
  if v_favorite_scope is not null and v_favorite_scope not in ('favorites','favorited_me') then raise exception using errcode='22023',message='invalid_search_favorite_scope'; end if;
  if p_min_age is null or p_max_age is null or p_min_age<18 or p_max_age>99 or p_min_age>p_max_age then raise exception using errcode='22023',message='invalid_search_age_range'; end if;
  if p_min_height_cm is not null and (p_min_height_cm<120 or p_min_height_cm>230) then raise exception using errcode='22023',message='invalid_search_height_range'; end if;
  if p_max_height_cm is not null and (p_max_height_cm<120 or p_max_height_cm>230) then raise exception using errcode='22023',message='invalid_search_height_range'; end if;
  if p_min_height_cm is not null and p_max_height_cm is not null and p_min_height_cm>p_max_height_cm then raise exception using errcode='22023',message='invalid_search_height_range'; end if;
  if p_min_weight_kg is not null and (p_min_weight_kg<35 or p_min_weight_kg>250) then raise exception using errcode='22023',message='invalid_search_weight_range'; end if;
  if p_max_weight_kg is not null and (p_max_weight_kg<35 or p_max_weight_kg>250) then raise exception using errcode='22023',message='invalid_search_weight_range'; end if;
  if p_min_weight_kg is not null and p_max_weight_kg is not null and p_min_weight_kg>p_max_weight_kg then raise exception using errcode='22023',message='invalid_search_weight_range'; end if;
  if p_max_distance_km is not null and (p_max_distance_km<=0 or p_max_distance_km>3000) then raise exception using errcode='22023',message='invalid_search_distance'; end if;
  if cardinality(coalesce(p_lifestyle_tags,'{}'::public.profile_lifestyle_tag[]))>12 then raise exception using errcode='22023',message='too_many_search_lifestyle_tags'; end if;
  if cardinality(coalesce(p_languages,'{}'::text[]))>8 then raise exception using errcode='22023',message='too_many_search_languages'; end if;
  if cardinality(coalesce(p_interests,'{}'::text[]))>12 then raise exception using errcode='22023',message='too_many_search_interests'; end if;
  if v_profile_text is not null and char_length(v_profile_text)>120 then raise exception using errcode='22023',message='invalid_search_profile_text'; end if;
  if v_occupation_text is not null and char_length(v_occupation_text)>120 then raise exception using errcode='22023',message='invalid_search_occupation_text'; end if;
  if p_province_id is not null and not exists(select 1 from public.administrative_areas a where a.id=p_province_id and a.country_code='VN' and a.is_active) then raise exception using errcode='22023',message='invalid_search_province'; end if;

  select coalesce((value_json#>>'{}')::integer,15) into v_online_minutes from private.app_config where key='luxy_search_online_minutes';
  v_online_minutes:=least(greatest(coalesce(v_online_minutes,15),1),120);

  with caller as (
    select p.id,p.gender,p.interested_in,
      case when p.nearby_enabled and ul.is_enabled and ul.expires_at>now()
        and ul.captured_at>now()-make_interval(mins=>coalesce((select (value_json#>>'{}')::integer from private.app_config where key='nearby_location_fresh_minutes'),10080))
        and ul.accuracy_meters<=coalesce((select (value_json#>>'{}')::integer from private.app_config where key='location_max_accuracy_meters'),5000)
      then ul.location else null end location
    from public.profiles p left join private.user_locations ul on ul.user_id=p.id where p.id=v_user_id
  ), base as (
    select p.id,p.gender,p.interested_in,p.province_id,p.height_cm,p.weight_kg,p.relationship_status,p.children_status,p.smoking_status,p.drinking_status,p.education_level,
      p.lifestyle_tags,p.languages,p.interests,p.occupation,p.username::text username,p.display_name,p.headline,p.bio,p.looking_for,
      (not private.luxy_online_hidden(p.id) and p.last_active_at is not null and p.last_active_at>=now()-make_interval(mins=>v_online_minutes)) is_online,
      case when caller.location is not null and p.nearby_enabled and candidate_location.location is not null then extensions.st_distance(candidate_location.location,caller.location) else null end distance_meters,
      coalesce(photos.photo_count,0)::integer photo_count,
      exists(select 1 from public.profile_favorites f where f.owner_id=caller.id and f.favorite_id=p.id) is_favorited,
      exists(select 1 from public.profile_favorites f where f.owner_id=p.id and f.favorite_id=caller.id) is_favorited_by,
      exists(select 1 from public.profile_views v where v.viewer_id=caller.id and v.viewed_id=p.id) is_viewed,
      extract(year from age(current_date,ui.date_of_birth))::smallint age
    from caller join public.profiles p on p.id<>caller.id join private.user_identity ui on ui.user_id=p.id
    left join private.user_locations candidate_location on candidate_location.user_id=p.id and candidate_location.is_enabled and candidate_location.expires_at>now()
      and candidate_location.captured_at>now()-make_interval(mins=>coalesce((select (value_json#>>'{}')::integer from private.app_config where key='nearby_location_fresh_minutes'),10080))
      and candidate_location.accuracy_meters<=coalesce((select (value_json#>>'{}')::integer from private.app_config where key='location_max_accuracy_meters'),5000)
    left join lateral (
      select count(*)::integer photo_count from public.media_assets m
      where m.owner_id=p.id and m.deleted_at is null and m.uploaded_at is not null and m.moderation_status in ('pending_review','approved') and m.visibility in ('avatar','public')
        and private.can_view_media_internal(m.id,caller.id)
    ) photos on true
    where p.profile_status='active' and p.deleted_at is null and p.discovery_enabled and not private.luxy_listing_hidden(p.id) and private.is_active_adult(p.id)
      and not private.users_are_blocked(caller.id,p.id) and ui.date_of_birth is not null
      and (p_province_id is null or p.province_id=p_province_id)
      and extract(year from age(current_date,ui.date_of_birth)) between p_min_age and p_max_age
      and ((p_genders is not null and cardinality(p_genders)>0 and p.gender=any(p_genders)) or ((p_genders is null or cardinality(p_genders)=0) and (caller.interested_in='everyone' or (caller.interested_in='female' and p.gender='female') or (caller.interested_in='male' and p.gender='male'))))
      and (caller.gender not in ('male','female') or p.interested_in='everyone' or (caller.gender='female' and p.interested_in='female') or (caller.gender='male' and p.interested_in='male'))
      and (p_min_height_cm is null or p.height_cm>=p_min_height_cm) and (p_max_height_cm is null or p.height_cm<=p_max_height_cm)
      and (p_min_weight_kg is null or p.weight_kg>=p_min_weight_kg) and (p_max_weight_kg is null or p.weight_kg<=p_max_weight_kg)
      and (p_relationship_statuses is null or cardinality(p_relationship_statuses)=0 or p.relationship_status=any(p_relationship_statuses))
      and (p_children_statuses is null or cardinality(p_children_statuses)=0 or p.children_status=any(p_children_statuses))
      and (p_smoking_statuses is null or cardinality(p_smoking_statuses)=0 or p.smoking_status=any(p_smoking_statuses))
      and (p_drinking_statuses is null or cardinality(p_drinking_statuses)=0 or p.drinking_status=any(p_drinking_statuses))
      and (p_education_levels is null or cardinality(p_education_levels)=0 or p.education_level=any(p_education_levels))
      and (p_lifestyle_tags is null or cardinality(p_lifestyle_tags)=0 or p.lifestyle_tags @> p_lifestyle_tags)
      and (p_languages is null or cardinality(p_languages)=0 or not exists(select 1 from unnest(p_languages) wanted where not exists(select 1 from unnest(p.languages) actual where lower(btrim(actual))=lower(btrim(wanted)))))
      and (p_interests is null or cardinality(p_interests)=0 or not exists(select 1 from unnest(p_interests) wanted where not exists(select 1 from unnest(p.interests) actual where lower(btrim(actual))=lower(btrim(wanted)))))
      and (v_occupation_text is null or lower(coalesce(p.occupation,'')) like '%'||v_occupation_text||'%')
      and (v_profile_text is null or lower(coalesce(p.username::text,'')) like '%'||v_profile_text||'%' or lower(coalesce(p.display_name,'')) like '%'||v_profile_text||'%' or lower(coalesce(p.headline,'')) like '%'||v_profile_text||'%' or lower(coalesce(p.bio,'')) like '%'||v_profile_text||'%' or lower(coalesce(p.looking_for,'')) like '%'||v_profile_text||'%' or lower(coalesce(p.occupation,'')) like '%'||v_profile_text||'%')
  ), filtered as (
    select * from base b where (p_max_distance_km is null or (b.distance_meters is not null and b.distance_meters<=p_max_distance_km*1000.0))
      and (p_has_photo is null or (p_has_photo and b.photo_count>0) or (not p_has_photo and b.photo_count=0))
      and (p_online_now is null or b.is_online=p_online_now)
      and (v_view_state is null or (v_view_state='viewed' and b.is_viewed) or (v_view_state='unviewed' and not b.is_viewed))
      and (v_favorite_scope is null or (v_favorite_scope='favorites' and b.is_favorited) or (v_favorite_scope='favorited_me' and b.is_favorited_by))
  ) select count(*)::bigint into v_count from filtered;
  return coalesce(v_count,0);
end;
$$;
revoke all on function public.count_luxy_profiles_v2(bigint,numeric,smallint,smallint,public.gender_identity[],smallint,smallint,smallint,smallint,public.relationship_status[],public.children_status[],public.smoking_status[],public.drinking_status[],public.education_level[],public.profile_lifestyle_tag[],text[],text[],boolean,boolean,text,text,text,text) from public,anon;
grant execute on function public.count_luxy_profiles_v2(bigint,numeric,smallint,smallint,public.gender_identity[],smallint,smallint,smallint,smallint,public.relationship_status[],public.children_status[],public.smoking_status[],public.drinking_status[],public.education_level[],public.profile_lifestyle_tag[],text[],text[],boolean,boolean,text,text,text,text) to authenticated,service_role;

create or replace function public.get_public_chon_profile_v2(p_code text)
returns table(
  public_profile_code text,display_name text,headline text,bio text,gender public.gender_identity,age smallint,province_name text,interests text[],height_cm smallint,
  occupation text,education_level public.education_level,relationship_status public.relationship_status,looking_for text,membership_tier public.luxy_membership_tier,
  membership_badge_visible boolean,member_since timestamptz,avatar_available boolean,interested_in public.dating_interest,weight_kg smallint,children_status public.children_status,
  smoking_status public.smoking_status,drinking_status public.drinking_status,lifestyle_tags public.profile_lifestyle_tag[],public_media_ids uuid[],private_photo_count integer
)
language sql stable security definer set search_path=''
as $$
  select p.public_profile_code,p.display_name,p.headline,p.bio,p.gender,extract(year from age(current_date,ui.date_of_birth))::smallint,area.name_vi,coalesce(p.interests,'{}'::text[]),p.height_cm,
    p.occupation,p.education_level,p.relationship_status,p.looking_for,private.get_active_luxy_membership_tier(p.id),private.get_active_luxy_membership_tier(p.id) in ('premium','diamond'),p.created_at,
    exists(select 1 from public.media_assets m where m.id=p.avatar_media_id and m.owner_id=p.id and m.visibility='avatar' and m.moderation_status='approved' and m.deleted_at is null and m.uploaded_at is not null),
    p.interested_in,p.weight_kg,p.children_status,p.smoking_status,p.drinking_status,coalesce(p.lifestyle_tags,'{}'::public.profile_lifestyle_tag[]),coalesce(pub.media_ids,'{}'::uuid[]),coalesce(priv.photo_count,0)::integer
  from public.profiles p join private.user_identity ui on ui.user_id=p.id
  left join public.administrative_areas area on area.id=p.province_id and area.country_code='VN' and area.is_active
  left join lateral (select array_agg(m.id order by m.uploaded_at desc,m.id) media_ids from public.media_assets m where m.owner_id=p.id and m.visibility='public' and m.moderation_status='approved' and m.deleted_at is null and m.uploaded_at is not null) pub on true
  left join lateral (select count(*)::integer photo_count from public.media_assets m where m.owner_id=p.id and m.visibility='private' and m.moderation_status='approved' and m.deleted_at is null and m.uploaded_at is not null) priv on true
  where p.public_profile_code=lower(btrim(coalesce(p_code,''))) and p.profile_status='active' and p.deleted_at is null and p.discovery_enabled=true and private.is_active_adult(p.id)
  limit 1;
$$;
revoke all on function public.get_public_chon_profile_v2(text) from public;
grant execute on function public.get_public_chon_profile_v2(text) to anon,authenticated,service_role;
comment on function public.get_public_chon_profile_v2(text) is 'Public share profile projection. Exposes no user UUID, exact DOB/location, KYC, private media IDs, storage bucket/path or financial data.';
