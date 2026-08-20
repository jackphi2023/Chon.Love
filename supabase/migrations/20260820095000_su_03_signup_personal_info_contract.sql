-- Chon.Love Signup / Onboarding V2 — SU-03
-- Additive staged personal-info contract for new/incomplete profiles only.
-- Existing active/pending/suspended profiles are deliberately outside this RPC.

create type public.marital_status as enum (
  'prefer_not_to_say',
  'never_married',
  'married',
  'separated',
  'divorced',
  'widowed'
);

alter table public.profiles
  add column marital_status public.marital_status;

comment on column public.profiles.marital_status is
  'Optional marital-status attribute. Added by SU-03 without backfilling existing profiles.';

create or replace function public.save_my_signup_personal_info_v2(
  p_date_of_birth date,
  p_terms_version text,
  p_community_rules_version text,
  p_display_name text,
  p_gender public.gender_identity,
  p_interested_in public.dating_interest,
  p_height_cm smallint default null,
  p_weight_kg smallint default null,
  p_education_level public.education_level default 'prefer_not_to_say'::public.education_level,
  p_relationship_status public.relationship_status default 'prefer_not_to_say'::public.relationship_status,
  p_marital_status public.marital_status default null,
  p_children_status public.children_status default 'prefer_not_to_say'::public.children_status,
  p_drinking_status public.drinking_status default 'prefer_not_to_say'::public.drinking_status,
  p_smoking_status public.smoking_status default 'prefer_not_to_say'::public.smoking_status
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_result public.profiles%rowtype;
  v_display_name text := btrim(coalesce(p_display_name, ''));
  v_existing_dob date;
  v_candidate text;
  v_attempt integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;

  select p.*
  into v_profile
  from public.profiles as p
  where p.id = v_user_id
  for update;

  if not found then
    raise exception using errcode = '55000', message = 'profile record is missing';
  end if;

  -- SU-03 validation is intentionally isolated to the new staged signup flow.
  -- Do not tighten legacy/global profile constraints and invalidate active users.
  if v_profile.deleted_at is not null
     or v_profile.profile_status is distinct from 'incomplete'::public.profile_status then
    raise exception using errcode = '42501', message = 'signup profile must be incomplete';
  end if;

  if char_length(v_display_name) < 10 or char_length(v_display_name) > 50 then
    raise exception using errcode = '22023', message = 'signup display_name must be between 10 and 50 characters';
  end if;

  if p_gender is null or p_gender::text not in ('male', 'female') then
    raise exception using errcode = '22023', message = 'signup gender must be male or female';
  end if;

  if p_interested_in is null or p_interested_in::text not in ('male', 'female', 'everyone') then
    raise exception using errcode = '22023', message = 'signup interested_in is invalid';
  end if;

  if p_height_cm is not null and (p_height_cm < 120 or p_height_cm > 220) then
    raise exception using errcode = '22023', message = 'signup height_cm must be between 120 and 220';
  end if;

  -- Reuse the established profile contract for the optional numeric weight.
  if p_weight_kg is not null and (p_weight_kg < 35 or p_weight_kg > 250) then
    raise exception using errcode = '22023', message = 'signup weight_kg must be between 35 and 250';
  end if;

  select ui.date_of_birth
  into v_existing_dob
  from private.user_identity as ui
  where ui.user_id = v_user_id;

  if v_existing_dob is not null and v_existing_dob <> p_date_of_birth then
    raise exception using errcode = '22023', message = 'signup date_of_birth is locked';
  end if;

  -- Keep DOB private and preserve the existing versioned policy/18+ authority.
  perform public.complete_my_onboarding(
    p_date_of_birth,
    p_terms_version,
    p_community_rules_version,
    'self_declared'
  );

  -- Username remains a backend/public-profile invariant but is removed from the
  -- Signup V2 UX. Generate it only when absent; never rewrite an existing value.
  if v_profile.username is null then
    loop
      v_attempt := v_attempt + 1;
      if v_attempt = 1 then
        v_candidate := 'chon_' || substr(replace(v_user_id::text, '-', ''), 1, 24);
      else
        v_candidate := 'chon_' || substr(md5(v_user_id::text || ':' || v_attempt::text), 1, 24);
      end if;

      exit when not exists (
        select 1
        from public.profiles as existing
        where existing.username = v_candidate::extensions.citext
          and existing.id <> v_user_id
      );

      if v_attempt >= 8 then
        raise exception using errcode = '23505', message = 'signup username generation failed';
      end if;
    end loop;
  end if;

  update public.profiles
  set
    username = coalesce(v_profile.username, v_candidate::extensions.citext),
    display_name = v_display_name,
    gender = p_gender,
    interested_in = p_interested_in,
    height_cm = p_height_cm,
    weight_kg = p_weight_kg,
    education_level = coalesce(p_education_level, 'prefer_not_to_say'::public.education_level),
    relationship_status = coalesce(p_relationship_status, 'prefer_not_to_say'::public.relationship_status),
    marital_status = p_marital_status,
    children_status = coalesce(p_children_status, 'prefer_not_to_say'::public.children_status),
    drinking_status = coalesce(p_drinking_status, 'prefer_not_to_say'::public.drinking_status),
    smoking_status = coalesce(p_smoking_status, 'prefer_not_to_say'::public.smoking_status),
    updated_at = now()
  where id = v_user_id
  returning * into v_result;

  return v_result;
end;
$function$;

revoke all on function public.save_my_signup_personal_info_v2(
  date,text,text,text,public.gender_identity,public.dating_interest,smallint,smallint,
  public.education_level,public.relationship_status,public.marital_status,
  public.children_status,public.drinking_status,public.smoking_status
) from public, anon;

grant execute on function public.save_my_signup_personal_info_v2(
  date,text,text,text,public.gender_identity,public.dating_interest,smallint,smallint,
  public.education_level,public.relationship_status,public.marital_status,
  public.children_status,public.drinking_status,public.smoking_status
) to authenticated, service_role;

comment on function public.save_my_signup_personal_info_v2(
  date,text,text,text,public.gender_identity,public.dating_interest,smallint,smallint,
  public.education_level,public.relationship_status,public.marital_status,
  public.children_status,public.drinking_status,public.smoking_status
) is
  'SU-03 staged personal-info write for incomplete Signup V2 profiles. Validates 18+, display name 10-50, height 120-220, preserves private DOB/policy acceptance, and auto-generates username without activating the profile.';
