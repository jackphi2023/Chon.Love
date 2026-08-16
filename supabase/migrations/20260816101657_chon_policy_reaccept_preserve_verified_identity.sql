-- Chon.Love: existing verified adults may re-accept current policies without
-- rewriting a previously verified date of birth or age-verification state.
create or replace function public.complete_my_onboarding(
  p_date_of_birth date,
  p_terms_version text,
  p_community_rules_version text,
  p_age_verification_method text default 'self_declared'::text
)
returns table(user_id uuid, age_verified boolean, account_status text, completed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := now();
  v_existing_dob date;
  v_existing_age_verified_at timestamptz;
  v_account_status private.account_status;
  v_method private.age_verification_method;
  v_terms_version text;
  v_community_rules_version text;
  v_already_age_verified boolean := false;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;

  select ac.value_json #>> '{}'
  into v_terms_version
  from private.app_config as ac
  where ac.key = 'terms_version_current';

  select ac.value_json #>> '{}'
  into v_community_rules_version
  from private.app_config as ac
  where ac.key = 'community_rules_version_current';

  if v_terms_version is null or v_community_rules_version is null then
    raise exception using errcode = '55000', message = 'policy versions are not configured';
  end if;

  select ui.date_of_birth, ui.age_verified_at, ui.account_status
  into v_existing_dob, v_existing_age_verified_at, v_account_status
  from private.user_identity as ui
  where ui.user_id = v_user_id;

  if v_account_status is distinct from 'active'::private.account_status then
    raise exception using errcode = '42501', message = 'account is not active';
  end if;

  if p_date_of_birth is null or p_date_of_birth > current_date then
    raise exception using errcode = '22008', message = 'invalid date_of_birth';
  end if;

  if p_date_of_birth > (current_date - interval '18 years')::date then
    raise exception using errcode = '22023', message = 'user must be at least 18 years old';
  end if;

  if p_age_verification_method not in ('self_declared','document','manual_review','third_party') then
    raise exception using errcode = '22023', message = 'invalid age verification method';
  end if;
  v_method := p_age_verification_method::private.age_verification_method;

  v_already_age_verified := (
    v_existing_age_verified_at is not null
    and v_existing_dob is not null
    and v_existing_dob <= (current_date - interval '18 years')::date
  );

  if not v_already_age_verified
     and v_existing_dob is not null
     and v_existing_dob <> p_date_of_birth then
    raise exception using errcode = '22023', message = 'verified date_of_birth cannot be changed by client';
  end if;

  if btrim(coalesce(p_terms_version, '')) <> v_terms_version then
    raise exception using errcode = '22023', message = 'current terms version must be accepted';
  end if;

  if btrim(coalesce(p_community_rules_version, '')) <> v_community_rules_version then
    raise exception using errcode = '22023', message = 'current community rules version must be accepted';
  end if;

  if v_already_age_verified then
    update private.user_identity
    set
      terms_version = v_terms_version,
      terms_accepted_at = v_now,
      community_rules_version = v_community_rules_version,
      community_rules_accepted_at = v_now,
      updated_at = v_now
    where private.user_identity.user_id = v_user_id;
  else
    update private.user_identity
    set
      date_of_birth = p_date_of_birth,
      age_verified_at = v_now,
      age_verification_method = v_method,
      terms_version = v_terms_version,
      terms_accepted_at = v_now,
      community_rules_version = v_community_rules_version,
      community_rules_accepted_at = v_now,
      updated_at = v_now
    where private.user_identity.user_id = v_user_id;
  end if;

  if not found then
    raise exception using errcode = '55000', message = 'user identity record is missing';
  end if;

  return query select v_user_id, true, v_account_status::text, v_now;
end;
$function$;

revoke all on function public.complete_my_onboarding(date,text,text,text) from public, anon;
grant execute on function public.complete_my_onboarding(date,text,text,text) to authenticated, service_role;

comment on function public.complete_my_onboarding(date,text,text,text) is
  'Completes adult onboarding. Existing age-verified adults re-accept policies without changing verified DOB or age-verification state.';
