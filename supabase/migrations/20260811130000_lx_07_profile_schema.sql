-- LX-07: Seeking-derived Luxy profile schema foundation.
--
-- Privacy boundary:
-- - date_of_birth remains private.user_identity only;
-- - exact coordinates remain private.user_locations only;
-- - public.profiles receives only member-visible/searchable profile attributes.
--
-- Compatibility boundary:
-- - public.update_my_profile(...) remains unchanged for existing clients;
-- - new Luxy clients use public.update_my_luxy_profile(...).
--
-- Product boundary:
-- - this migration defines profile data contracts only;
-- - it does not activate membership, gifts, private-photo access, or verification.

create type public.dating_interest as enum (
  'female',
  'male',
  'everyone'
);

create type public.relationship_status as enum (
  'single',
  'divorced',
  'widowed',
  'open',
  'complicated',
  'prefer_not_to_say'
);

create type public.children_status as enum (
  'no_children',
  'has_children',
  'prefer_not_to_say'
);

create type public.smoking_status as enum (
  'never',
  'socially',
  'regularly',
  'trying_to_quit',
  'prefer_not_to_say'
);

create type public.drinking_status as enum (
  'never',
  'socially',
  'regularly',
  'prefer_not_to_say'
);

create type public.education_level as enum (
  'high_school',
  'vocational',
  'college',
  'bachelors',
  'masters',
  'doctorate',
  'other',
  'prefer_not_to_say'
);

-- Canonical Luxy translation of the Seeking-style intent/lifestyle tags used by
-- Edit Profile and Search. Keeping the codes typed now prevents LX-09 from
-- inventing a second taxonomy later.
create type public.profile_lifestyle_tag as enum (
  'true_love',
  'luxury_lifestyle',
  'active_lifestyle',
  'flexible_schedule',
  'emotional_connection',
  'refined',
  'fine_dining',
  'friendship',
  'long_term',
  'marriage_minded',
  'monogamous',
  'romantic',
  'ready_to_travel',
  'travel_companion',
  'vacation',
  'entertainment_events',
  'platonic'
);

alter table public.profiles
  add column headline text,
  add column interested_in public.dating_interest not null default 'everyone'::public.dating_interest,
  add column height_cm smallint,
  add column weight_kg smallint,
  add column relationship_status public.relationship_status not null default 'prefer_not_to_say'::public.relationship_status,
  add column children_status public.children_status not null default 'prefer_not_to_say'::public.children_status,
  add column smoking_status public.smoking_status not null default 'prefer_not_to_say'::public.smoking_status,
  add column drinking_status public.drinking_status not null default 'prefer_not_to_say'::public.drinking_status,
  add column education_level public.education_level not null default 'prefer_not_to_say'::public.education_level,
  add column occupation text,
  add column looking_for text,
  add column age_preference_min smallint not null default 18,
  add column age_preference_max smallint not null default 99,
  add column lifestyle_tags public.profile_lifestyle_tag[] not null default '{}'::public.profile_lifestyle_tag[],
  add column languages text[] not null default '{}'::text[];

alter table public.profiles
  add constraint profiles_headline_length
    check (headline is null or char_length(headline) between 1 and 120),
  add constraint profiles_height_cm_range
    check (height_cm is null or height_cm between 120 and 230),
  add constraint profiles_weight_kg_range
    check (weight_kg is null or weight_kg between 35 and 250),
  add constraint profiles_occupation_length
    check (occupation is null or char_length(occupation) between 1 and 120),
  add constraint profiles_looking_for_length
    check (looking_for is null or char_length(looking_for) between 1 and 1000),
  add constraint profiles_age_preference_range
    check (
      age_preference_min between 18 and 99
      and age_preference_max between 18 and 99
      and age_preference_min <= age_preference_max
    ),
  add constraint profiles_lifestyle_tags_count
    check (cardinality(lifestyle_tags) <= 12),
  add constraint profiles_languages_count
    check (cardinality(languages) <= 8);

comment on column public.profiles.headline is
  'Optional public one-line profile headline, trimmed and limited to 120 characters.';
comment on column public.profiles.interested_in is
  'Public dating preference used for Luxy discovery. Everyone is represented explicitly; this column never contains private identity data.';
comment on column public.profiles.height_cm is
  'Optional public height in centimeters. Nullable for legacy profiles until the Luxy profile setup flow is completed.';
comment on column public.profiles.weight_kg is
  'Optional public weight in kilograms. Nullable and member-controlled.';
comment on column public.profiles.relationship_status is
  'Public member-selected relationship status. Existing profiles default to prefer_not_to_say for forward compatibility.';
comment on column public.profiles.children_status is
  'Public member-selected children status; defaults to prefer_not_to_say.';
comment on column public.profiles.smoking_status is
  'Public member-selected smoking lifestyle status; defaults to prefer_not_to_say.';
comment on column public.profiles.drinking_status is
  'Public member-selected drinking lifestyle status; defaults to prefer_not_to_say.';
comment on column public.profiles.education_level is
  'Public member-selected education level; defaults to prefer_not_to_say.';
comment on column public.profiles.occupation is
  'Optional public occupation/career label, limited to 120 characters.';
comment on column public.profiles.looking_for is
  'Optional public description of relationship intent / what the member is looking for.';
comment on column public.profiles.age_preference_min is
  'Minimum preferred age for discovery/search matching. It is not the member date of birth.';
comment on column public.profiles.age_preference_max is
  'Maximum preferred age for discovery/search matching. It is not the member date of birth.';
comment on column public.profiles.lifestyle_tags is
  'Typed Seeking-derived Luxy intent/lifestyle tag codes used by profile presentation and search filters.';
comment on column public.profiles.languages is
  'Optional public language labels. Up to eight normalized labels are accepted by the Luxy profile RPC.';

create index profiles_luxy_discovery_match_idx
  on public.profiles (gender, interested_in, province_id)
  where profile_status = 'active'::public.profile_status
    and discovery_enabled
    and deleted_at is null;

create index profiles_luxy_physical_idx
  on public.profiles (height_cm, weight_kg)
  where profile_status = 'active'::public.profile_status
    and discovery_enabled
    and deleted_at is null;

create index profiles_luxy_relationship_idx
  on public.profiles (relationship_status, children_status)
  where profile_status = 'active'::public.profile_status
    and discovery_enabled
    and deleted_at is null;

create index profiles_luxy_lifestyle_tags_gin_idx
  on public.profiles using gin (lifestyle_tags)
  where profile_status = 'active'::public.profile_status
    and discovery_enabled
    and deleted_at is null;

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
as $$
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
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'authentication_required';
  end if;

  if v_headline is not null and char_length(v_headline) > 120 then
    raise exception using errcode = '22023', message = 'invalid_headline';
  end if;

  if p_height_cm is not null and (p_height_cm < 120 or p_height_cm > 230) then
    raise exception using errcode = '22023', message = 'invalid_height_cm';
  end if;

  if p_weight_kg is not null and (p_weight_kg < 35 or p_weight_kg > 250) then
    raise exception using errcode = '22023', message = 'invalid_weight_kg';
  end if;

  if v_occupation is not null and char_length(v_occupation) > 120 then
    raise exception using errcode = '22023', message = 'invalid_occupation';
  end if;

  if v_looking_for is not null and char_length(v_looking_for) > 1000 then
    raise exception using errcode = '22023', message = 'invalid_looking_for';
  end if;

  if p_age_preference_min < 18
     or p_age_preference_max > 99
     or p_age_preference_min > p_age_preference_max then
    raise exception using errcode = '22023', message = 'invalid_age_preference';
  end if;

  select coalesce(array_agg(distinct tag order by tag), '{}'::public.profile_lifestyle_tag[])
  into v_lifestyle_tags
  from unnest(coalesce(p_lifestyle_tags, '{}'::public.profile_lifestyle_tag[])) as tag;

  if cardinality(v_lifestyle_tags) > 12 then
    raise exception using errcode = '22023', message = 'too_many_lifestyle_tags';
  end if;

  if cardinality(coalesce(p_languages, '{}'::text[])) > 8 then
    raise exception using errcode = '22023', message = 'too_many_languages';
  end if;

  foreach v_language in array coalesce(p_languages, '{}'::text[])
  loop
    v_language := btrim(v_language);
    if char_length(v_language) < 2 or char_length(v_language) > 32 then
      raise exception using errcode = '22023', message = 'invalid_language';
    end if;
    v_language_key := lower(v_language);
    if not (v_language_key = any(v_seen_language_keys)) then
      v_seen_language_keys := array_append(v_seen_language_keys, v_language_key);
      v_languages := array_append(v_languages, v_language);
    end if;
  end loop;

  -- Delegate the mature validation, province catalog enforcement, interest
  -- normalization, account-state checks, adult gate and username cooldown to
  -- the backwards-compatible profile RPC.
  v_result := public.update_my_profile(
    p_username,
    p_display_name,
    p_bio,
    p_gender,
    p_province_id,
    p_interests,
    p_discovery_enabled,
    p_nearby_enabled
  );

  update public.profiles
  set headline = v_headline,
      interested_in = p_interested_in,
      height_cm = p_height_cm,
      weight_kg = p_weight_kg,
      relationship_status = p_relationship_status,
      children_status = p_children_status,
      smoking_status = p_smoking_status,
      drinking_status = p_drinking_status,
      education_level = p_education_level,
      occupation = v_occupation,
      looking_for = v_looking_for,
      age_preference_min = p_age_preference_min,
      age_preference_max = p_age_preference_max,
      lifestyle_tags = v_lifestyle_tags,
      languages = v_languages
  where id = v_user_id
  returning * into v_result;

  return v_result;
end
$$;

revoke all on function public.update_my_luxy_profile(
  text,
  text,
  text,
  public.gender_identity,
  bigint,
  text[],
  boolean,
  boolean,
  text,
  public.dating_interest,
  smallint,
  smallint,
  public.relationship_status,
  public.children_status,
  public.smoking_status,
  public.drinking_status,
  public.education_level,
  text,
  text,
  smallint,
  smallint,
  public.profile_lifestyle_tag[],
  text[]
) from public, anon;

grant execute on function public.update_my_luxy_profile(
  text,
  text,
  text,
  public.gender_identity,
  bigint,
  text[],
  boolean,
  boolean,
  text,
  public.dating_interest,
  smallint,
  smallint,
  public.relationship_status,
  public.children_status,
  public.smoking_status,
  public.drinking_status,
  public.education_level,
  text,
  text,
  smallint,
  smallint,
  public.profile_lifestyle_tag[],
  text[]
) to authenticated, service_role;

comment on function public.update_my_luxy_profile(
  text,
  text,
  text,
  public.gender_identity,
  bigint,
  text[],
  boolean,
  boolean,
  text,
  public.dating_interest,
  smallint,
  smallint,
  public.relationship_status,
  public.children_status,
  public.smoking_status,
  public.drinking_status,
  public.education_level,
  text,
  text,
  smallint,
  smallint,
  public.profile_lifestyle_tag[],
  text[]
) is
  'LX-07 RPC for public Luxy profile fields. Requires existing adult onboarding through update_my_profile; never writes DOB, KYC, bank data, or exact coordinates.';
