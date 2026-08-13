-- LX-12: Luxy Favorite / Interests system.
--
-- Product boundary:
-- - favorites are a free dating-interest signal and are completely independent from gifts, Fan and wallet/economy;
-- - profile views are a private interaction signal used for Viewed Me and viewed/unviewed Search filters;
-- - verification remains deferred to LX-20;
-- - blocked/inactive members must never leak through Search or Interests lists.
--
-- Access boundary:
-- - profile_favorites and profile_views are RPC-only for authenticated clients;
-- - mutation/read RPCs are SECURITY DEFINER with an empty search_path;
-- - the Search V2 RPC is extended in place rather than introducing a second Search backend.

create table public.profile_favorites (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  favorite_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(owner_id,favorite_id),
  constraint profile_favorites_not_self check(owner_id<>favorite_id)
);

create index profile_favorites_received_idx
on public.profile_favorites(favorite_id,created_at desc,owner_id);

comment on table public.profile_favorites is
  'LX-12 dating-interest shortlist. Independent from gifts, Fan status, friendship and economy.';

create table public.profile_views (
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_id uuid not null references public.profiles(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  view_count integer not null default 1,
  primary key(viewer_id,viewed_id),
  constraint profile_views_not_self check(viewer_id<>viewed_id),
  constraint profile_views_count_positive check(view_count>0),
  constraint profile_views_time_order check(last_viewed_at>=first_viewed_at)
);

create index profile_views_received_idx
on public.profile_views(viewed_id,last_viewed_at desc,viewer_id);

comment on table public.profile_views is
  'LX-12 privacy-aware profile-view history. Stores pair/timestamps/count only; no location, KYC or financial data.';

alter table public.profile_favorites enable row level security;
alter table public.profile_views enable row level security;

revoke all on table public.profile_favorites from public,anon,authenticated;
revoke all on table public.profile_views from public,anon,authenticated;
grant all on table public.profile_favorites to service_role;
grant all on table public.profile_views to service_role;

create or replace function public.set_profile_favorite(
  p_profile_id uuid,
  p_favorited boolean
)
returns table(
  is_favorited boolean,
  is_favorited_by boolean,
  is_match boolean
)
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reverse boolean := false;
begin
  if v_user_id is null then
    raise exception using errcode='28000', message='authentication_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode='42501', message='adult_onboarding_required';
  end if;
  if p_profile_id is null or p_profile_id=v_user_id then
    raise exception using errcode='22023', message='invalid_favorite_target';
  end if;
  if p_favorited is null then
    raise exception using errcode='22023', message='invalid_favorite_state';
  end if;

  if p_favorited then
    if not private.is_active_adult(p_profile_id)
      or private.users_are_blocked(v_user_id,p_profile_id)
      or not exists(
        select 1 from public.profiles p
        where p.id=p_profile_id
          and p.profile_status='active'
          and p.deleted_at is null
      ) then
      raise exception using errcode='42501', message='favorite_target_not_available';
    end if;

    insert into public.profile_favorites(owner_id,favorite_id)
    values(v_user_id,p_profile_id)
    on conflict(owner_id,favorite_id) do nothing;
  else
    -- Removal must remain possible even if the target later becomes hidden/blocked/inactive.
    delete from public.profile_favorites
    where owner_id=v_user_id and favorite_id=p_profile_id;
  end if;

  if not private.users_are_blocked(v_user_id,p_profile_id) then
    select exists(
      select 1 from public.profile_favorites f
      where f.owner_id=p_profile_id and f.favorite_id=v_user_id
    ) into v_reverse;
  end if;

  return query
  select
    exists(
      select 1 from public.profile_favorites f
      where f.owner_id=v_user_id and f.favorite_id=p_profile_id
    ),
    v_reverse,
    exists(
      select 1 from public.profile_favorites mine
      join public.profile_favorites theirs
        on theirs.owner_id=p_profile_id
       and theirs.favorite_id=v_user_id
      where mine.owner_id=v_user_id and mine.favorite_id=p_profile_id
    );
end;
$$;

revoke all on function public.set_profile_favorite(uuid,boolean) from public,anon;
grant execute on function public.set_profile_favorite(uuid,boolean) to authenticated,service_role;

create or replace function public.get_profile_interest_state(p_profile_id uuid)
returns table(
  is_favorited boolean,
  is_favorited_by boolean,
  is_viewed boolean,
  has_viewed_me boolean,
  is_match boolean
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode='28000', message='authentication_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode='42501', message='adult_onboarding_required';
  end if;
  if p_profile_id is null or p_profile_id=v_user_id or private.users_are_blocked(v_user_id,p_profile_id) then
    return query select false,false,false,false,false;
    return;
  end if;

  return query
  select
    exists(select 1 from public.profile_favorites f where f.owner_id=v_user_id and f.favorite_id=p_profile_id),
    exists(select 1 from public.profile_favorites f where f.owner_id=p_profile_id and f.favorite_id=v_user_id),
    exists(select 1 from public.profile_views v where v.viewer_id=v_user_id and v.viewed_id=p_profile_id),
    exists(select 1 from public.profile_views v where v.viewer_id=p_profile_id and v.viewed_id=v_user_id),
    exists(
      select 1 from public.profile_favorites mine
      join public.profile_favorites theirs
        on theirs.owner_id=p_profile_id and theirs.favorite_id=v_user_id
      where mine.owner_id=v_user_id and mine.favorite_id=p_profile_id
    );
end;
$$;

revoke all on function public.get_profile_interest_state(uuid) from public,anon;
grant execute on function public.get_profile_interest_state(uuid) to authenticated,service_role;

create or replace function public.record_profile_view(p_profile_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode='28000', message='authentication_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode='42501', message='adult_onboarding_required';
  end if;
  if p_profile_id is null or p_profile_id=v_user_id then
    return false;
  end if;
  if private.users_are_blocked(v_user_id,p_profile_id)
    or not private.is_active_adult(p_profile_id)
    or not exists(
      select 1 from public.profiles p
      where p.id=p_profile_id
        and p.profile_status='active'
        and p.deleted_at is null
    ) then
    return false;
  end if;

  insert into public.profile_views(viewer_id,viewed_id)
  values(v_user_id,p_profile_id)
  on conflict(viewer_id,viewed_id) do update set
    last_viewed_at=now(),
    view_count=public.profile_views.view_count+1;

  return true;
end;
$$;

revoke all on function public.record_profile_view(uuid) from public,anon;
grant execute on function public.record_profile_view(uuid) to authenticated,service_role;

create or replace function public.list_luxy_interests(
  p_scope text default 'favorites',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table(
  id uuid,
  username text,
  display_name text,
  age smallint,
  province_name text,
  avatar_media_id uuid,
  avatar_storage_bucket text,
  avatar_storage_path text,
  photo_count integer,
  last_active_at timestamptz,
  is_online boolean,
  is_favorited boolean,
  is_favorited_by boolean,
  is_match boolean,
  interaction_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_scope text := lower(btrim(coalesce(p_scope,'')));
  v_limit integer := least(greatest(coalesce(p_limit,24),1),40);
  v_offset integer := least(greatest(coalesce(p_offset,0),0),199);
  v_online_minutes integer;
begin
  if v_user_id is null then
    raise exception using errcode='28000', message='authentication_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode='42501', message='adult_onboarding_required';
  end if;
  if v_scope not in ('favorites','viewed_me','favorited_me') then
    raise exception using errcode='22023', message='invalid_interest_scope';
  end if;

  select coalesce((value_json#>>'{}')::integer,15)
  into v_online_minutes
  from private.app_config
  where key='luxy_search_online_minutes';
  v_online_minutes := least(greatest(coalesce(v_online_minutes,15),1),120);

  return query
  with relations as (
    select f.favorite_id target_id,f.created_at relation_at
    from public.profile_favorites f
    where v_scope='favorites' and f.owner_id=v_user_id

    union all

    select f.owner_id target_id,f.created_at relation_at
    from public.profile_favorites f
    where v_scope='favorited_me' and f.favorite_id=v_user_id

    union all

    select v.viewer_id target_id,v.last_viewed_at relation_at
    from public.profile_views v
    where v_scope='viewed_me' and v.viewed_id=v_user_id
  )
  select
    p.id,
    p.username::text,
    p.display_name,
    extract(year from age(current_date,ui.date_of_birth))::smallint,
    area.name_vi,
    p.avatar_media_id,
    avatar.storage_bucket,
    avatar.storage_path,
    coalesce(photos.photo_count,0)::integer,
    p.last_active_at,
    (p.last_active_at is not null and p.last_active_at>=now()-make_interval(mins=>v_online_minutes)),
    exists(select 1 from public.profile_favorites f where f.owner_id=v_user_id and f.favorite_id=p.id),
    exists(select 1 from public.profile_favorites f where f.owner_id=p.id and f.favorite_id=v_user_id),
    exists(
      select 1 from public.profile_favorites mine
      join public.profile_favorites theirs
        on theirs.owner_id=p.id and theirs.favorite_id=v_user_id
      where mine.owner_id=v_user_id and mine.favorite_id=p.id
    ),
    r.relation_at
  from relations r
  join public.profiles p on p.id=r.target_id
  join private.user_identity ui on ui.user_id=p.id
  left join public.administrative_areas area
    on area.id=p.province_id and area.country_code='VN' and area.is_active
  left join public.media_assets avatar
    on avatar.id=p.avatar_media_id
    and avatar.owner_id=p.id
    and avatar.visibility='avatar'
    and avatar.moderation_status in ('pending_review','approved')
    and avatar.deleted_at is null
    and avatar.uploaded_at is not null
    and private.can_view_media_internal(avatar.id,v_user_id)
  left join lateral (
    select count(*)::integer photo_count
    from public.media_assets m
    where m.owner_id=p.id
      and m.deleted_at is null
      and m.uploaded_at is not null
      and m.moderation_status in ('pending_review','approved')
      and m.visibility in ('avatar','public')
      and private.can_view_media_internal(m.id,v_user_id)
  ) photos on true
  where p.profile_status='active'
    and p.deleted_at is null
    and p.discovery_enabled
    and private.is_active_adult(p.id)
    and not private.users_are_blocked(v_user_id,p.id)
  order by r.relation_at desc,p.id
  offset v_offset
  limit least(v_limit,greatest(200-v_offset,0));
end;
$$;

revoke all on function public.list_luxy_interests(text,integer,integer) from public,anon;
grant execute on function public.list_luxy_interests(text,integer,integer) to authenticated,service_role;

comment on function public.list_luxy_interests(text,integer,integer) is
  'LX-12 Seeking-derived Interests list: my favorites, who viewed me, and who favorited me. Blocked/inactive/hidden profiles are excluded.';

-- Extend Search V2 in place with LX-12 relationship filters and card state.
drop function public.search_luxy_profiles_v2(
  text,bigint,numeric,smallint,smallint,public.gender_identity[],smallint,smallint,smallint,smallint,
  public.relationship_status[],public.children_status[],public.smoking_status[],public.drinking_status[],
  public.education_level[],public.profile_lifestyle_tag[],text[],text[],boolean,boolean,text,text,integer,integer
);

create function public.search_luxy_profiles_v2(
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
  p_view_state text default null,
  p_favorite_scope text default null,
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
  member_since timestamptz,
  is_favorited boolean,
  is_favorited_by boolean,
  is_viewed boolean
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_sort text := lower(btrim(coalesce(p_sort,'')));
  v_view_state text := nullif(lower(btrim(coalesce(p_view_state,''))), '');
  v_favorite_scope text := nullif(lower(btrim(coalesce(p_favorite_scope,''))), '');
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
  if v_view_state is not null and v_view_state not in ('viewed','unviewed') then
    raise exception using errcode='22023', message='invalid_search_view_state';
  end if;
  if v_favorite_scope is not null and v_favorite_scope not in ('favorites','favorited_me') then
    raise exception using errcode='22023', message='invalid_search_favorite_scope';
  end if;
  if p_min_age is null or p_max_age is null or p_min_age<18 or p_max_age>99 or p_min_age>p_max_age then
    raise exception using errcode='22023', message='invalid_search_age_range';
  end if;
  if p_min_height_cm is not null and (p_min_height_cm<120 or p_min_height_cm>230) then
    raise exception using errcode='22023', message='invalid_search_height_range';
  end if;
  if p_max_height_cm is not null and (p_max_height_cm<120 or p_max_height_cm>230) then
    raise exception using errcode='22023', message='invalid_search_height_range';
  end if;
  if p_min_height_cm is not null and p_max_height_cm is not null and p_min_height_cm>p_max_height_cm then
    raise exception using errcode='22023', message='invalid_search_height_range';
  end if;
  if p_min_weight_kg is not null and (p_min_weight_kg<35 or p_min_weight_kg>250) then
    raise exception using errcode='22023', message='invalid_search_weight_range';
  end if;
  if p_max_weight_kg is not null and (p_max_weight_kg<35 or p_max_weight_kg>250) then
    raise exception using errcode='22023', message='invalid_search_weight_range';
  end if;
  if p_min_weight_kg is not null and p_max_weight_kg is not null and p_min_weight_kg>p_max_weight_kg then
    raise exception using errcode='22023', message='invalid_search_weight_range';
  end if;
  if p_max_distance_km is not null and (p_max_distance_km<=0 or p_max_distance_km>3000) then
    raise exception using errcode='22023', message='invalid_search_distance';
  end if;
  if cardinality(coalesce(p_lifestyle_tags,'{}'::public.profile_lifestyle_tag[]))>12 then
    raise exception using errcode='22023', message='too_many_search_lifestyle_tags';
  end if;
  if cardinality(coalesce(p_languages,'{}'::text[]))>8 then
    raise exception using errcode='22023', message='too_many_search_languages';
  end if;
  if cardinality(coalesce(p_interests,'{}'::text[]))>12 then
    raise exception using errcode='22023', message='too_many_search_interests';
  end if;
  if v_profile_text is not null and char_length(v_profile_text)>120 then
    raise exception using errcode='22023', message='invalid_search_profile_text';
  end if;
  if v_occupation_text is not null and char_length(v_occupation_text)>120 then
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
      (p.last_active_at is not null and p.last_active_at>=now()-make_interval(mins=>v_online_minutes)) is_online,
      case
        when caller.location is not null and p.nearby_enabled and candidate_location.location is not null
        then extensions.st_distance(candidate_location.location,caller.location)
        else null
      end distance_meters,
      p.created_at member_since,
      exists(select 1 from public.profile_favorites f where f.owner_id=caller.id and f.favorite_id=p.id) is_favorited,
      exists(select 1 from public.profile_favorites f where f.owner_id=p.id and f.favorite_id=caller.id) is_favorited_by,
      exists(select 1 from public.profile_views v where v.viewer_id=caller.id and v.viewed_id=p.id) is_viewed
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
    where (p_max_distance_km is null or (b.distance_meters is not null and b.distance_meters<=p_max_distance_km*1000.0))
      and (p_has_photo is null or (p_has_photo and b.photo_count>0) or (not p_has_photo and b.photo_count=0))
      and (p_online_now is null or b.is_online=p_online_now)
      and (v_view_state is null or (v_view_state='viewed' and b.is_viewed) or (v_view_state='unviewed' and not b.is_viewed))
      and (v_favorite_scope is null or (v_favorite_scope='favorites' and b.is_favorited) or (v_favorite_scope='favorited_me' and b.is_favorited_by))
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
    case when f.distance_meters is null then null else round((f.distance_meters/1000.0)::numeric,1) end,
    f.member_since,
    f.is_favorited,
    f.is_favorited_by,
    f.is_viewed
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
  public.education_level[],public.profile_lifestyle_tag[],text[],text[],boolean,boolean,text,text,text,text,integer,integer
) from public,anon;

grant execute on function public.search_luxy_profiles_v2(
  text,bigint,numeric,smallint,smallint,public.gender_identity[],smallint,smallint,smallint,smallint,
  public.relationship_status[],public.children_status[],public.smoking_status[],public.drinking_status[],
  public.education_level[],public.profile_lifestyle_tag[],text[],text[],boolean,boolean,text,text,text,text,integer,integer
) to authenticated,service_role;

comment on function public.search_luxy_profiles_v2(
  text,bigint,numeric,smallint,smallint,public.gender_identity[],smallint,smallint,smallint,smallint,
  public.relationship_status[],public.children_status[],public.smoking_status[],public.drinking_status[],
  public.education_level[],public.profile_lifestyle_tag[],text[],text[],boolean,boolean,text,text,text,text,integer,integer
) is
  'LX-12 Search V2 extension. Adds viewed/unviewed + favorites/favorited-me filtering and safe relationship booleans while preserving age/location privacy and the existing Search architecture.';
