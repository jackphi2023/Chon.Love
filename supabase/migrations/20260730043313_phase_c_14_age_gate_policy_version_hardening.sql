insert into private.app_config (key, value_json, value_type, description, is_public)
values
  ('terms_version_current', to_jsonb('terms-2026-07-30-v1'::text), 'string'::private.config_value_type, 'Current Terms of Service version required for onboarding.', true),
  ('community_rules_version_current', to_jsonb('community-2026-07-30-v1'::text), 'string'::private.config_value_type, 'Current Community Standards version required for onboarding.', true)
on conflict (key) do update set
  value_json = excluded.value_json,
  value_type = excluded.value_type,
  description = excluded.description,
  is_public = excluded.is_public,
  updated_at = now();

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
  v_account_status private.account_status;
  v_method private.age_verification_method;
  v_terms_version text;
  v_community_rules_version text;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;

  select value_json #>> '{}'
  into v_terms_version
  from private.app_config
  where key = 'terms_version_current';

  select value_json #>> '{}'
  into v_community_rules_version
  from private.app_config
  where key = 'community_rules_version_current';

  if v_terms_version is null or v_community_rules_version is null then
    raise exception using errcode = '55000', message = 'policy versions are not configured';
  end if;

  select ui.date_of_birth, ui.account_status
  into v_existing_dob, v_account_status
  from private.user_identity ui
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

  if v_existing_dob is not null and v_existing_dob <> p_date_of_birth then
    raise exception using errcode = '22023', message = 'verified date_of_birth cannot be changed by client';
  end if;

  if btrim(coalesce(p_terms_version, '')) <> v_terms_version then
    raise exception using errcode = '22023', message = 'current terms version must be accepted';
  end if;

  if btrim(coalesce(p_community_rules_version, '')) <> v_community_rules_version then
    raise exception using errcode = '22023', message = 'current community rules version must be accepted';
  end if;

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
  where user_id = v_user_id;

  if not found then
    raise exception using errcode = '55000', message = 'user identity record is missing';
  end if;

  return query
  select v_user_id, true, v_account_status::text, v_now;
end;
$function$;

create or replace function public.get_my_onboarding_status()
returns table(
  user_id uuid,
  age_verified boolean,
  policies_accepted boolean,
  creator_terms_accepted boolean,
  account_status text,
  profile_status text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    ui.user_id,
    (ui.age_verified_at is not null and ui.date_of_birth <= (current_date - interval '18 years')::date) as age_verified,
    (
      ui.terms_accepted_at is not null
      and ui.community_rules_accepted_at is not null
      and ui.terms_version = (
        select c.value_json #>> '{}'
        from private.app_config c
        where c.key = 'terms_version_current'
      )
      and ui.community_rules_version = (
        select c.value_json #>> '{}'
        from private.app_config c
        where c.key = 'community_rules_version_current'
      )
    ) as policies_accepted,
    (ui.creator_terms_accepted_at is not null) as creator_terms_accepted,
    ui.account_status::text,
    p.profile_status::text
  from private.user_identity ui
  join public.profiles p on p.id = ui.user_id
  where ui.user_id = (select auth.uid());
$function$;

revoke all on function public.complete_my_onboarding(date, text, text, text) from public;
grant execute on function public.complete_my_onboarding(date, text, text, text) to authenticated;
revoke all on function public.get_my_onboarding_status() from public;
grant execute on function public.get_my_onboarding_status() to authenticated;
