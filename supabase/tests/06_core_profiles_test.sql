begin;

select extensions.plan(25);

insert into public.administrative_areas (
  id, code, name_vi, name_en, area_type, country_code, sort_order, is_active
) values (
  '10000000-0000-0000-0000-000000000001',
  'TEST-VN-PROVINCE-01',
  'Tỉnh kiểm thử 01',
  'Test Province 01',
  'province',
  'VN',
  1,
  true
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  '20000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'email-user-01@example.invalid',
  extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
  timezone('utc', now()),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"UNTRUSTED ADMIN","role":"super_admin"}'::jsonb,
  timezone('utc', now()),
  timezone('utc', now())
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  '20000000-0000-0000-0000-000000000002',
  'authenticated',
  'authenticated',
  'oauth-user-01@example.invalid',
  null,
  timezone('utc', now()),
  '{"provider":"google","providers":["google"]}'::jsonb,
  '{"full_name":"UNTRUSTED OAUTH NAME","role":"finance_admin"}'::jsonb,
  timezone('utc', now()),
  timezone('utc', now())
);

select extensions.ok(
  exists (
    select 1
    from public.profiles
    where id = '20000000-0000-0000-0000-000000000001'
      and username is null
      and display_name is null
      and profile_status = 'onboarding'
  ),
  'email signup creates a safe minimal public profile without trusting user metadata'
);

select extensions.ok(
  exists (
    select 1
    from public.profiles
    where id = '20000000-0000-0000-0000-000000000002'
      and username is null
      and display_name is null
      and profile_status = 'onboarding'
  ),
  'OAuth signup creates the same safe minimal profile contract'
);

select extensions.is(
  (
    select count(*)::bigint
    from private.user_roles
    where user_id in (
      '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000002'
    )
      and role = 'user'
      and revoked_at is null
  ),
  2::bigint,
  'auth bootstrap grants only the base user role'
);

select extensions.is(
  (
    select count(*)::bigint
    from private.user_roles
    where user_id = '20000000-0000-0000-0000-000000000001'
      and role in ('creator', 'moderator', 'finance_admin', 'super_admin')
      and revoked_at is null
  ),
  0::bigint,
  'user-editable metadata cannot grant Creator or administrative roles'
);

update public.profiles
set username = 'Alice_01'
where id = '20000000-0000-0000-0000-000000000001';

select extensions.throws_ok(
  $$
    update public.profiles
    set username = 'ALICE_01'
    where id = '20000000-0000-0000-0000-000000000002'
  $$,
  '23505',
  null,
  'username uniqueness is case-insensitive through citext'
);

update public.profiles
set username_changed_at = timezone('utc', now()) - interval '31 days'
where id = '20000000-0000-0000-0000-000000000001';

select extensions.throws_ok(
  $$
    update private.user_identity
    set date_of_birth = current_date + 1
    where user_id = '20000000-0000-0000-0000-000000000001'
  $$,
  '23514',
  null,
  'future date of birth is rejected'
);

select extensions.throws_ok(
  $$
    update private.user_identity
    set
      date_of_birth = (current_date - interval '17 years')::date,
      age_verified_at = timezone('utc', now()),
      age_verification_method = 'self_declared_dob'
    where user_id = '20000000-0000-0000-0000-000000000001'
  $$,
  '23514',
  null,
  'a user under 18 cannot be marked age verified'
);

select extensions.ok(
  not has_schema_privilege('anon', 'private', 'usage')
  and not has_schema_privilege('authenticated', 'private', 'usage'),
  'private schema is inaccessible to anon and authenticated roles'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'private.user_identity', 'select')
  and not has_table_privilege('authenticated', 'private.user_identity', 'insert')
  and not has_table_privilege('authenticated', 'private.user_identity', 'update')
  and not has_table_privilege('authenticated', 'private.user_identity', 'delete'),
  'authenticated clients have no direct private identity privileges'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'private.user_roles', 'insert')
  and not has_table_privilege('authenticated', 'private.user_roles', 'update')
  and not has_table_privilege('authenticated', 'private.user_roles', 'delete'),
  'authenticated clients cannot grant or revoke roles'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'private.app_config', 'insert')
  and not has_table_privilege('authenticated', 'private.app_config', 'update')
  and not has_table_privilege('authenticated', 'private.app_config', 'delete'),
  'authenticated clients cannot mutate application configuration'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000001',
  true
);

select extensions.throws_ok(
  $$
    select *
    from public.complete_adult_onboarding(
      (current_date - interval '17 years')::date,
      true,
      'terms-v1',
      'community-v1',
      'alice_adult',
      'Alice Test',
      null,
      'prefer_not_to_say',
      '10000000-0000-0000-0000-000000000001'
    )
  $$,
  '23514',
  'user_must_be_at_least_18',
  'the shared onboarding RPC rejects underage users'
);

select extensions.lives_ok(
  $$
    select *
    from public.complete_adult_onboarding(
      date '1990-01-01',
      true,
      'terms-v1',
      'community-v1',
      'alice_adult',
      'Alice Test',
      'Safe Social Creator test profile',
      'prefer_not_to_say',
      '10000000-0000-0000-0000-000000000001'
    )
  $$,
  'the shared onboarding RPC completes an adult account atomically'
);

select extensions.results_eq(
  $$
    select
      profile_status,
      account_status,
      is_adult_verified,
      terms_accepted,
      community_rules_accepted,
      creator_status,
      is_creator,
      payout_eligible
    from public.get_my_account_bootstrap()
  $$,
  $$
    values (
      'active'::text,
      'active'::text,
      true,
      true,
      true,
      'not_applied'::text,
      false,
      false
    )
  $$,
  'mobile web, Android and iOS receive the same safe bootstrap contract'
);

select extensions.lives_ok(
  $$ select public.accept_creator_terms('creator-terms-v1') $$,
  'an active adult can accept versioned Creator terms'
);

select extensions.is(
  public.apply_for_creator('Compliant test Creator profile', 1200),
  'pending'::text,
  'Creator application becomes pending without self-approval or payout eligibility'
);

reset role;

select extensions.ok(
  exists (
    select 1
    from public.creator_profiles
    where user_id = '20000000-0000-0000-0000-000000000001'
      and creator_status = 'pending'
      and payout_eligible = false
  ),
  'Creator applicant cannot self-enable payout'
);

select extensions.results_eq(
  $$
    select count(*)::bigint
    from public.get_public_app_config()
  $$,
  $$
    values (11::bigint)
  $$,
  'public config RPC returns only explicitly public configuration'
);

select extensions.is(
  (
    select
      (creator.value_json #>> '{}')::integer
      + (platform.value_json #>> '{}')::integer
    from private.app_config creator
    cross join private.app_config platform
    where creator.key = 'creator_share_bps'
      and platform.key = 'platform_share_bps'
  ),
  10000,
  'Creator and platform shares reconcile to 10,000 basis points'
);

select extensions.is(
  (
    select count(*)::bigint
    from information_schema.columns
    where table_schema in ('public', 'private')
      and table_name in (
        'profiles',
        'creator_profiles',
        'user_identity',
        'user_roles',
        'app_config',
        'administrative_areas'
      )
      and data_type in ('real', 'double precision')
  ),
  0::bigint,
  'core MyFan tables contain no floating-point columns'
);

select extensions.ok(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('profiles', 'creator_profiles', 'administrative_areas')
      and c.relrowsecurity
    group by n.nspname
    having count(*) = 3
  ),
  'all exposed Session 6 tables have RLS enabled'
);

select extensions.ok(
  exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'postgis'
      and n.nspname = 'extensions'
  ),
  'PostGIS is installed consistently in the extensions schema'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  '20000000-0000-0000-0000-000000000003',
  'authenticated',
  'authenticated',
  'delete-user-01@example.invalid',
  extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
  timezone('utc', now()),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  timezone('utc', now()),
  timezone('utc', now())
);

delete from auth.users
where id = '20000000-0000-0000-0000-000000000003';

select extensions.ok(
  not exists (
    select 1 from public.profiles
    where id = '20000000-0000-0000-0000-000000000003'
  )
  and not exists (
    select 1 from private.user_identity
    where user_id = '20000000-0000-0000-0000-000000000003'
  )
  and not exists (
    select 1 from private.user_roles
    where user_id = '20000000-0000-0000-0000-000000000003'
  ),
  'deleting an auth user cascades only Session 6 bootstrap records'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.get_my_account_bootstrap()',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.get_my_account_bootstrap()',
    'execute'
  ),
  'private account bootstrap RPC is authenticated-only'
);

select extensions.is(
  (
    select count(*)::bigint
    from private.app_config
    where key in (
      'heart_units_per_heart',
      'heart_vnd_rate',
      'creator_share_bps',
      'platform_share_bps',
      'estimated_google_fee_bps',
      'creator_reward_hold_days',
      'minimum_withdrawal_units',
      'maximum_daily_gift_units',
      'maximum_daily_purchase_units',
      'fan_minimum_units',
      'location_max_radius_meters',
      'location_stale_after_days',
      'location_max_accuracy_meters',
      'account_deletion_grace_days'
    )
  ),
  14::bigint,
  'all mandatory Session 6 application config keys are seeded'
);

select * from extensions.finish();

rollback;
