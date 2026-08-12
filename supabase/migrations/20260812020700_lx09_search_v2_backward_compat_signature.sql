-- Restore the original LX-09 Search V2 function signature after LX-12 extended
-- search_luxy_profiles_v2 with view/favorite filters.
--
-- Important: this overload intentionally has NO defaults. Therefore calls such
-- as search_luxy_profiles_v2() or calls with named optional arguments continue
-- resolving to the LX-12 26-argument function, while clients compiled against
-- the original 24-argument LX-09 contract remain valid when supplying all args.

create function public.search_luxy_profiles_v2(
  p_sort text,
  p_province_id bigint,
  p_max_distance_km numeric,
  p_min_age smallint,
  p_max_age smallint,
  p_genders public.gender_identity[],
  p_min_height_cm smallint,
  p_max_height_cm smallint,
  p_min_weight_kg smallint,
  p_max_weight_kg smallint,
  p_relationship_statuses public.relationship_status[],
  p_children_statuses public.children_status[],
  p_smoking_statuses public.smoking_status[],
  p_drinking_statuses public.drinking_status[],
  p_education_levels public.education_level[],
  p_lifestyle_tags public.profile_lifestyle_tag[],
  p_languages text[],
  p_interests text[],
  p_has_photo boolean,
  p_online_now boolean,
  p_occupation_text text,
  p_profile_text text,
  p_limit integer,
  p_offset integer
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
language sql
stable
security definer
set search_path=''
as $$
  select
    s.id,
    s.username,
    s.display_name,
    s.headline,
    s.bio,
    s.gender,
    s.age,
    s.province_id,
    s.province_name,
    s.avatar_media_id,
    s.avatar_storage_bucket,
    s.avatar_storage_path,
    s.photo_count,
    s.interests,
    s.height_cm,
    s.weight_kg,
    s.relationship_status,
    s.children_status,
    s.smoking_status,
    s.drinking_status,
    s.education_level,
    s.occupation,
    s.looking_for,
    s.lifestyle_tags,
    s.languages,
    s.last_active_at,
    s.is_online,
    s.distance_km,
    s.member_since
  from public.search_luxy_profiles_v2(
    p_sort => p_sort,
    p_province_id => p_province_id,
    p_max_distance_km => p_max_distance_km,
    p_min_age => p_min_age,
    p_max_age => p_max_age,
    p_genders => p_genders,
    p_min_height_cm => p_min_height_cm,
    p_max_height_cm => p_max_height_cm,
    p_min_weight_kg => p_min_weight_kg,
    p_max_weight_kg => p_max_weight_kg,
    p_relationship_statuses => p_relationship_statuses,
    p_children_statuses => p_children_statuses,
    p_smoking_statuses => p_smoking_statuses,
    p_drinking_statuses => p_drinking_statuses,
    p_education_levels => p_education_levels,
    p_lifestyle_tags => p_lifestyle_tags,
    p_languages => p_languages,
    p_interests => p_interests,
    p_has_photo => p_has_photo,
    p_online_now => p_online_now,
    p_occupation_text => p_occupation_text,
    p_profile_text => p_profile_text,
    p_view_state => null,
    p_favorite_scope => null,
    p_limit => p_limit,
    p_offset => p_offset
  ) s;
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
) is 'Backward-compatible LX-09 Search V2 signature. Delegates to the LX-12 extended Search V2 with relationship filters unset.';
