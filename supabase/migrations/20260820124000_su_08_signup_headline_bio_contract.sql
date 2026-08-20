-- Chon.Love Signup / Onboarding V2 — SU-08
-- Step 7 optional headline + required long-form bio.
-- Signup uses stricter minimums while mature active profiles keep their existing rules.

alter table public.profiles
  drop constraint if exists profiles_bio_length;

alter table public.profiles
  add constraint profiles_bio_length
    check (bio is null or char_length(bio) <= 4000);

comment on column public.profiles.bio is
  'Public profile biography. Signup V2 requires 50-4000 trimmed characters; mature profile editing accepts blank through 4000 characters.';

-- A valid Signup V2 biography can be longer than the old 500-character mature
-- editor ceiling. Widen only the maximum so existing active profiles (including
-- short/blank bios) remain valid and editable without any backfill.
create or replace function public.update_my_profile(
  p_username text,
  p_display_name text,
  p_bio text default null,
  p_gender public.gender_identity default 'prefer_not_to_say',
  p_province_id bigint default null,
  p_interests text[] default '{}'::text[],
  p_discovery_enabled boolean default true,
  p_nearby_enabled boolean default false
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_existing public.profiles%rowtype;
  v_result public.profiles%rowtype;
  v_new_username extensions.citext;
  v_interests text[] := '{}'::text[];
  v_interest text;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'authentication_required';
  end if;
  if not public.is_current_user_adult() then
    raise exception using errcode = '42501', message = 'adult_onboarding_required';
  end if;

  v_new_username := nullif(pg_catalog.btrim(p_username), '')::extensions.citext;
  if v_new_username is null or v_new_username::text !~ '^[A-Za-z0-9_]{3,30}$' then
    raise exception using errcode = '22023', message = 'invalid_username';
  end if;
  if nullif(pg_catalog.btrim(p_display_name), '') is null
     or pg_catalog.char_length(pg_catalog.btrim(p_display_name)) > 60 then
    raise exception using errcode = '22023', message = 'invalid_display_name';
  end if;
  if p_bio is not null and pg_catalog.char_length(pg_catalog.btrim(p_bio)) > 4000 then
    raise exception using errcode = '22023', message = 'invalid_bio';
  end if;
  if p_province_id is null then
    raise exception using errcode = '22023', message = 'province_required';
  end if;
  if not exists (
    select 1
    from public.administrative_areas area
    where area.id = p_province_id
      and area.country_code = 'VN'
      and area.parent_id is null
      and area.area_type in ('province','municipality')
      and area.is_active
  ) then
    raise exception using errcode = '23503', message = 'province_not_in_active_vn_34_catalog';
  end if;

  foreach v_interest in array coalesce(p_interests, '{}'::text[]) loop
    v_interest := pg_catalog.btrim(v_interest);
    if v_interest = '' then continue; end if;
    if pg_catalog.char_length(v_interest) < 2 or pg_catalog.char_length(v_interest) > 32 then
      raise exception using errcode = '22023', message = 'invalid_interests';
    end if;
    if not exists (
      select 1 from pg_catalog.unnest(v_interests) existing
      where pg_catalog.lower(existing) = pg_catalog.lower(v_interest)
    ) then
      v_interests := pg_catalog.array_append(v_interests, v_interest);
    end if;
  end loop;
  if cardinality(v_interests) > 12 then
    raise exception using errcode = '22023', message = 'invalid_interests';
  end if;

  select * into v_existing
  from public.profiles
  where id = v_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'profile_not_found';
  end if;
  if v_existing.profile_status in ('suspended','deactivated','deleted') then
    raise exception using errcode = '42501', message = 'account_not_available';
  end if;
  if v_existing.username is not null
     and v_existing.username <> v_new_username
     and v_existing.username_changed_at is not null
     and v_existing.username_changed_at > now() - interval '30 days'
  then
    raise exception using errcode = '22023', message = 'username_change_cooldown';
  end if;

  update public.profiles
  set username = v_new_username,
      display_name = pg_catalog.btrim(p_display_name),
      bio = nullif(pg_catalog.btrim(p_bio), ''),
      gender = p_gender,
      province_id = p_province_id,
      interests = v_interests,
      discovery_enabled = p_discovery_enabled,
      nearby_enabled = p_nearby_enabled,
      profile_status = 'active'::public.profile_status,
      username_changed_at = case
        when v_existing.username is distinct from v_new_username then now()
        else v_existing.username_changed_at
      end
  where id = v_user_id
  returning * into v_result;

  return v_result;
end $function$;

create or replace function public.save_my_signup_headline_bio_v2(
  p_bio text,
  p_headline text default null
)
returns table(
  headline_length integer,
  bio_length integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_headline text := nullif(btrim(coalesce(p_headline, '')), '');
  v_bio text := btrim(coalesce(p_bio, ''));
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

  if coalesce(char_length(btrim(v_profile.looking_for)), 0) < 50
     or coalesce(char_length(btrim(v_profile.looking_for)), 0) > 4000
     or cardinality(coalesce(v_profile.lifestyle_tags, '{}'::public.profile_lifestyle_tag[])) < 1
     or cardinality(coalesce(v_profile.lifestyle_tags, '{}'::public.profile_lifestyle_tag[])) > 7 then
    raise exception using errcode='42501', message='signup looking for must be completed first';
  end if;

  if not exists (
    select 1
    from public.media_assets as media
    where media.owner_id = v_user_id
      and media.visibility in ('avatar'::public.media_visibility, 'public'::public.media_visibility)
      and media.moderation_status in ('pending_review'::public.media_moderation_status, 'approved'::public.media_moderation_status)
      and media.deleted_at is null
      and media.uploaded_at is not null
  ) then
    raise exception using errcode='42501', message='signup profile photo must be completed first';
  end if;

  if v_headline is not null and (char_length(v_headline) < 10 or char_length(v_headline) > 50) then
    raise exception using errcode='22023', message='signup headline must be blank or 10 to 50 characters';
  end if;

  if char_length(v_bio) < 50 or char_length(v_bio) > 4000 then
    raise exception using errcode='22023', message='signup bio must be 50 to 4000 characters';
  end if;

  update public.profiles
  set headline = v_headline,
      bio = v_bio,
      updated_at = v_now
  where id = v_user_id;

  return query
  select coalesce(char_length(v_headline), 0), char_length(v_bio);
end;
$function$;

revoke all on function public.save_my_signup_headline_bio_v2(text, text) from public, anon;
grant execute on function public.save_my_signup_headline_bio_v2(text, text) to authenticated, service_role;

comment on function public.save_my_signup_headline_bio_v2(text, text) is
  'SU-08 staged Step 7 write for incomplete adult Signup V2 profiles after Location, Looking For and at least one usable profile photo. Headline is optional but 10-50 when present; bio is required at 50-4000; never activates profile/discovery.';