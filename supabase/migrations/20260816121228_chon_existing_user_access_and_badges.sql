alter table private.user_identity
  add column onboarding_grandfathered_at timestamptz;

comment on column private.user_identity.onboarding_grandfathered_at is
  'Non-null only for accounts that existed when Chon.Love enabled the Web V1 existing-user onboarding bypass. Future accounts must satisfy the normal onboarding gates.';

update private.user_identity
set onboarding_grandfathered_at = now(),
    updated_at = now()
where onboarding_grandfathered_at is null;

create or replace function private.is_active_adult(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles p
    join private.user_identity i on i.user_id = p.id
    where p.id = p_user_id
      and p.profile_status = 'active'::public.profile_status
      and p.deleted_at is null
      and i.account_status = 'active'::private.account_status
      and (
        i.onboarding_grandfathered_at is not null
        or (
          i.age_verified_at is not null
          and i.date_of_birth <= (current_date - interval '18 years')::date
          and i.terms_accepted_at is not null
          and i.community_rules_accepted_at is not null
        )
      )
  )
$function$;

create or replace function private.is_profile_setup_adult(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles p
    join private.user_identity i on i.user_id = p.id
    where p.id = p_user_id
      and p.profile_status in ('incomplete'::public.profile_status, 'pending_review'::public.profile_status)
      and p.deleted_at is null
      and i.account_status = 'active'::private.account_status
      and (
        i.onboarding_grandfathered_at is not null
        or (
          i.age_verified_at is not null
          and i.date_of_birth <= (current_date - interval '18 years')::date
          and i.terms_accepted_at is not null
          and i.community_rules_accepted_at is not null
        )
      )
  )
$function$;

create or replace function public.is_current_user_adult()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from private.user_identity ui
    where ui.user_id = (select auth.uid())
      and ui.account_status = 'active'::private.account_status
      and (
        ui.onboarding_grandfathered_at is not null
        or (
          ui.age_verified_at is not null
          and ui.date_of_birth <= (current_date - interval '18 years')::date
          and ui.terms_accepted_at is not null
          and ui.community_rules_accepted_at is not null
        )
      )
  )
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
    (
      ui.onboarding_grandfathered_at is not null
      or (
        ui.age_verified_at is not null
        and ui.date_of_birth <= (current_date - interval '18 years')::date
      )
    ) as age_verified,
    (
      ui.onboarding_grandfathered_at is not null
      or (
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
      )
    ) as policies_accepted,
    (ui.creator_terms_accepted_at is not null) as creator_terms_accepted,
    ui.account_status::text,
    p.profile_status::text
  from private.user_identity ui
  join public.profiles p on p.id = ui.user_id
  where ui.user_id = (select auth.uid());
$function$;

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
  v_grandfathered_at timestamptz;
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

  select ui.date_of_birth, ui.age_verified_at, ui.onboarding_grandfathered_at, ui.account_status
  into v_existing_dob, v_existing_age_verified_at, v_grandfathered_at, v_account_status
  from private.user_identity as ui
  where ui.user_id = v_user_id;

  if v_account_status is distinct from 'active'::private.account_status then
    raise exception using errcode = '42501', message = 'account is not active';
  end if;

  if v_grandfathered_at is null then
    if p_date_of_birth is null or p_date_of_birth > current_date then
      raise exception using errcode = '22008', message = 'invalid date_of_birth';
    end if;

    if p_date_of_birth > (current_date - interval '18 years')::date then
      raise exception using errcode = '22023', message = 'user must be at least 18 years old';
    end if;
  end if;

  if p_age_verification_method not in ('self_declared','document','manual_review','third_party') then
    raise exception using errcode = '22023', message = 'invalid age verification method';
  end if;
  v_method := p_age_verification_method::private.age_verification_method;

  v_already_age_verified := (
    v_grandfathered_at is not null
    or (
      v_existing_age_verified_at is not null
      and v_existing_dob is not null
      and v_existing_dob <= (current_date - interval '18 years')::date
    )
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

insert into public.moderation_cases (
  reported_user_id,
  source,
  status,
  priority,
  rule_codes,
  automated_score_json,
  decision,
  decision_notes,
  resolved_at
)
select
  p.id,
  'admin_review'::public.moderation_source,
  'resolved'::public.moderation_case_status,
  'normal'::public.moderation_priority,
  array['member_photo_verification']::text[],
  jsonb_build_object(
    'verificationSource', 'chon_existing_user_default',
    'grandfatheredAt', ui.onboarding_grandfathered_at
  ),
  'approve'::public.moderation_decision,
  'Chon.Love existing-user launch policy: selfie verification default approved; no similarity score was fabricated.',
  now()
from public.profiles p
join private.user_identity ui on ui.user_id = p.id
where ui.onboarding_grandfathered_at is not null
  and not exists (
    select 1
    from public.moderation_cases mc
    where mc.reported_user_id = p.id
      and 'member_photo_verification' = any(mc.rule_codes)
      and mc.status = 'resolved'::public.moderation_case_status
      and mc.decision = 'approve'::public.moderation_decision
  );

insert into private.member_profile_verifications (
  user_id,
  identity_status,
  identity_submitted_at,
  identity_reviewed_at,
  identity_reason_code,
  updated_at
)
select
  p.id,
  'approved',
  now(),
  now(),
  'chon_launch_verified',
  now()
from public.profiles p
where p.username::text ~ '^love(0[1-9]|1[0-9]|2[0-8])$'
on conflict (user_id) do update
set identity_status = 'approved',
    identity_submitted_at = coalesce(private.member_profile_verifications.identity_submitted_at, excluded.identity_submitted_at),
    identity_reviewed_at = coalesce(private.member_profile_verifications.identity_reviewed_at, excluded.identity_reviewed_at),
    identity_reason_code = coalesce(private.member_profile_verifications.identity_reason_code, excluded.identity_reason_code),
    updated_at = now();

insert into private.luxy_memberships (
  user_id,
  tier,
  status,
  messaging_enabled,
  starts_at,
  expires_at,
  source,
  updated_at
)
select
  p.id,
  case when p.username::text = 'love20' then 'diamond'::public.luxy_membership_tier else 'premium'::public.luxy_membership_tier end,
  'active',
  true,
  now(),
  '2030-12-31 16:59:59+00'::timestamptz,
  'manual_admin',
  now()
from public.profiles p
where p.username::text in ('myfan11','love18','love20')
on conflict (user_id) do update
set tier = excluded.tier,
    status = 'active',
    messaging_enabled = true,
    starts_at = coalesce(private.luxy_memberships.starts_at, excluded.starts_at),
    expires_at = greatest(coalesce(private.luxy_memberships.expires_at, excluded.expires_at), excluded.expires_at),
    source = 'manual_admin',
    updated_at = now();