begin;
select plan(10);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000092',
  'authenticated','authenticated','chon-grandfathered@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
);

update private.user_identity
set date_of_birth = date '2012-01-01',
    age_verified_at = null,
    age_verification_method = null,
    terms_version = 'legacy-terms',
    terms_accepted_at = null,
    community_rules_version = 'legacy-community',
    community_rules_accepted_at = null,
    onboarding_grandfathered_at = now()
where user_id = '10000000-0000-0000-0000-000000000092';

update public.profiles
set username = 'chonlegacyqa',
    display_name = 'Chon Legacy QA',
    profile_status = 'active'
where id = '10000000-0000-0000-0000-000000000092';

select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000092","role":"authenticated"}',true);

select is(
  (select age_verified from public.get_my_onboarding_status()),
  true,
  'grandfathered existing user bypasses the age gate'
);
select is(
  (select policies_accepted from public.get_my_onboarding_status()),
  true,
  'grandfathered existing user bypasses stale policy routing'
);
select ok(public.is_current_user_adult(), 'public access helper accepts grandfathered existing user');
select ok(private.is_active_adult('10000000-0000-0000-0000-000000000092'), 'active-profile helper accepts grandfathered existing user');
select lives_ok(
  format(
    $$select public.complete_my_onboarding(date '2012-01-01', %L, %L, 'self_declared')$$,
    (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    (select value_json #>> '{}' from private.app_config where key='community_rules_version_current')
  ),
  'grandfathered existing user is not stopped by the historical 18+ validation'
);
select is(
  (select date_of_birth from private.user_identity where user_id='10000000-0000-0000-0000-000000000092'),
  date '2012-01-01',
  'grandfathered onboarding preserves stored DOB'
);

select set_config('request.jwt.claims','',true);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000093',
  'authenticated','authenticated','chon-future-user@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
);

update private.user_identity
set date_of_birth = date '2012-01-01',
    age_verified_at = now(),
    age_verification_method = 'self_declared',
    terms_version = (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    terms_accepted_at = now(),
    community_rules_version = (select value_json #>> '{}' from private.app_config where key='community_rules_version_current'),
    community_rules_accepted_at = now()
where user_id = '10000000-0000-0000-0000-000000000093';

update public.profiles
set username = 'chonfutureqa',
    display_name = 'Chon Future QA',
    profile_status = 'active'
where id = '10000000-0000-0000-0000-000000000093';

select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000093","role":"authenticated"}',true);

select is(
  (select age_verified from public.get_my_onboarding_status()),
  false,
  'future under-18 user does not inherit the grandfather bypass'
);
select is(
  (select policies_accepted from public.get_my_onboarding_status()),
  true,
  'future user may still satisfy current policy acceptance independently'
);
select is(public.is_current_user_adult(), false, 'future under-18 user remains blocked by the normal age rule');
select throws_ok(
  format(
    $$select public.complete_my_onboarding(date '2012-01-01', %L, %L, 'self_declared')$$,
    (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    (select value_json #>> '{}' from private.app_config where key='community_rules_version_current')
  ),
  '22023',
  'user must be at least 18 years old',
  'future under-18 onboarding remains protected'
);

select set_config('request.jwt.claims','',true);
select * from finish();
rollback;