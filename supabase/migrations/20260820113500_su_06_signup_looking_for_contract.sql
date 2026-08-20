-- Chon.Love Signup / Onboarding V2 — SU-06
-- Step 5 relationship-intent text + 1..7 Seeking-derived lifestyle/intent tags.
-- Signup uses stricter minimum/selection rules while preserving mature profile compatibility.

alter table public.profiles
  drop constraint if exists profiles_looking_for_length;

alter table public.profiles
  add constraint profiles_looking_for_length
    check (looking_for is null or char_length(looking_for) between 1 and 4000);

comment on column public.profiles.looking_for is
  'Public relationship-intent description. Signup V2 requires 50-4000 characters; mature profile editing accepts up to 4000 characters.';

-- Widen the mature editor from 1000 to 4000 characters so a member who wrote a
-- valid Signup V2 answer can later edit/save the rest of the profile without
-- being forced to shorten the existing value. This is a backwards-compatible
-- relaxation only; all other mature profile rules remain unchanged.
create or replace function public.update_my_luxy_profile(
  p_username text,
  p_display_name text,
  p_bio text default null,
  p_gender public.gender_identity default 'prefer_not_to_say',
  p_province_id bigint default null,
  p_interests text[] default '{}'::text[],
  p_discovery_enabled boolean default true,
  p_nearby_enabled boolean default false,
  p_headline text default null,
  p_interested_in public.dating_interest default 'everyone',
  p_height_cm smallint default null,
  p_weight_kg smallint default null,
  p_relationship_status public.relationship_status default 'prefer_not_to_say',
  p_children_status public.children_status default 'prefer_not_to_say',
  p_smoking_status public.smoking_status default 'prefer_not_to_say',
  p_drinking_status public.drinking_status default 'prefer_not_to_say',
  p_education_level public.education_level default 'prefer_not_to_say',
  p_occupation text default null,
  p_looking_for text default null,
  p_age_preference_min smallint default 18,
  p_age_preference_max smallint default 99,
  p_lifestyle_tags public.profile_lifestyle_tag[] default '{}'::public.profile_lifestyle_tag[],
  p_languages text[] default '{}'::text[]
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_result public.profiles%rowtype;
  v_headline text := nullif(btrim(coalesce(p_headline, '')), '');
  v_occupation text := nullif(btrim(coalesce(p_occupation, '')), '');
  v_looking_for text := nullif(btrim(coalesce(p_looking_for, '')), '');
  v_lifestyle_tags public.profile_lifestyle_tag[];
  v_languages text[] := '{}'::text[];
  v_language text;
  v_language_key text;
  v_seen_language_keys text[] := '{}'::text[];
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if v_headline is not null and char_length(v_headline)>120 then raise exception using errcode='22023',message='invalid_headline'; end if;
  if p_height_cm is not null and (p_height_cm<120 or p_height_cm>230) then raise exception using errcode='22023',message='invalid_height_cm'; end if;
  if p_weight_kg is not null and (p_weight_kg<35 or p_weight_kg>250) then raise exception using errcode='22023',message='invalid_weight_kg'; end if;
  if v_occupation is not null and char_length(v_occupation)>120 then raise exception using errcode='22023',message='invalid_occupation'; end if;
  if v_looking_for is not null and char_length(v_looking_for)>4000 then raise exception using errcode='22023',message='invalid_looking_for'; end if;
  if p_age_preference_min<18 or p_age_preference_max>99 or p_age_preference_min>p_age_preference_max then raise exception using errcode='22023',message='invalid_age_preference'; end if;

  select coalesce(array_agg(distinct tag order by tag), '{}'::public.profile_lifestyle_tag[])
  into v_lifestyle_tags
  from unnest(coalesce(p_lifestyle_tags,'{}'::public.profile_lifestyle_tag[])) as tag;

  if cardinality(v_lifestyle_tags)>12 then raise exception using errcode='22023',message='too_many_lifestyle_tags'; end if;
  if cardinality(coalesce(p_languages,'{}'::text[]))>8 then raise exception using errcode='22023',message='too_many_languages'; end if;

  foreach v_language in array coalesce(p_languages,'{}'::text[])
  loop
    v_language:=btrim(v_language);
    if char_length(v_language)<2 or char_length(v_language)>32 then raise exception using errcode='22023',message='invalid_language'; end if;
    v_language_key:=lower(v_language);
    if not (v_language_key=any(v_seen_language_keys)) then
      v_seen_language_keys:=array_append(v_seen_language_keys,v_language_key);
      v_languages:=array_append(v_languages,v_language);
    end if;
  end loop;

  v_result:=public.update_my_profile(
    p_username,p_display_name,p_bio,p_gender,p_province_id,p_interests,
    p_discovery_enabled,p_nearby_enabled
  );

  update public.profiles
  set headline=v_headline,
      interested_in=p_interested_in,
      height_cm=p_height_cm,
      weight_kg=p_weight_kg,
      relationship_status=p_relationship_status,
      children_status=p_children_status,
      smoking_status=p_smoking_status,
      drinking_status=p_drinking_status,
      education_level=p_education_level,
      occupation=v_occupation,
      looking_for=v_looking_for,
      age_preference_min=p_age_preference_min,
      age_preference_max=p_age_preference_max,
      lifestyle_tags=v_lifestyle_tags,
      languages=v_languages
  where id=v_user_id
  returning * into v_result;

  return v_result;
end;
$function$;

create or replace function public.save_my_signup_looking_for_v2(
  p_looking_for text,
  p_lifestyle_tags public.profile_lifestyle_tag[]
)
returns table(
  looking_for_length integer,
  lifestyle_tag_count integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_looking_for text := btrim(coalesce(p_looking_for, ''));
  v_tags public.profile_lifestyle_tag[] := '{}'::public.profile_lifestyle_tag[];
  v_tag public.profile_lifestyle_tag;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception using errcode='28000', message='authentication required';
  end if;

  select p.*
  into v_profile
  from public.profiles as p
  where p.id = v_user_id
  for update;

  if not found then
    raise exception using errcode='55000', message='profile record is missing';
  end if;

  if v_profile.deleted_at is not null
     or v_profile.profile_status is distinct from 'incomplete'::public.profile_status then
    raise exception using errcode='42501', message='signup profile must be incomplete';
  end if;

  if not public.is_current_user_adult() then
    raise exception using errcode='42501', message='signup personal info must be completed first';
  end if;

  if v_profile.province_id is null or not exists (
    select 1
    from public.administrative_areas as area
    where area.id = v_profile.province_id
      and area.country_code = 'VN'
      and area.is_active
      and area.parent_id is null
      and area.area_type in ('province', 'municipality')
  ) then
    raise exception using errcode='42501', message='signup location must be completed first';
  end if;

  if char_length(v_looking_for) < 50 or char_length(v_looking_for) > 4000 then
    raise exception using errcode='22023', message='signup looking for must be 50 to 4000 characters';
  end if;

  if cardinality(coalesce(p_lifestyle_tags, '{}'::public.profile_lifestyle_tag[])) < 1
     or cardinality(coalesce(p_lifestyle_tags, '{}'::public.profile_lifestyle_tag[])) > 7 then
    raise exception using errcode='22023', message='signup lifestyle tags must contain 1 to 7 values';
  end if;

  foreach v_tag in array coalesce(p_lifestyle_tags, '{}'::public.profile_lifestyle_tag[])
  loop
    if not (v_tag = any(v_tags)) then
      v_tags := array_append(v_tags, v_tag);
    end if;
  end loop;

  if cardinality(v_tags) < 1 or cardinality(v_tags) > 7 then
    raise exception using errcode='22023', message='signup lifestyle tags must contain 1 to 7 values';
  end if;

  update public.profiles
  set looking_for = v_looking_for,
      lifestyle_tags = v_tags,
      updated_at = v_now
  where id = v_user_id;

  return query
  select char_length(v_looking_for), cardinality(v_tags);
end;
$function$;

revoke all on function public.save_my_signup_looking_for_v2(
  text, public.profile_lifestyle_tag[]
) from public, anon;

grant execute on function public.save_my_signup_looking_for_v2(
  text, public.profile_lifestyle_tag[]
) to authenticated, service_role;

comment on function public.save_my_signup_looking_for_v2(
  text, public.profile_lifestyle_tag[]
) is
  'SU-06 staged Step 5 write for incomplete adult Signup V2 profiles after canonical province selection. Requires 50-4000 trimmed characters and 1-7 typed lifestyle/intent tags; never activates profile or discovery.';