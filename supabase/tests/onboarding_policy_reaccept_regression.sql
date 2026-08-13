begin;
select plan(6);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000091',
  'authenticated','authenticated','verified-policy-reaccept@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
);

update private.user_identity
set date_of_birth = date '2002-01-01',
    age_verified_at = timestamptz '2026-01-02 03:04:05+00',
    age_verification_method = 'self_declared',
    terms_version = 'legacy-terms',
    terms_accepted_at = timestamptz '2026-01-01 00:00:00+00',
    community_rules_version = 'legacy-community',
    community_rules_accepted_at = timestamptz '2026-01-01 00:00:00+00'
where user_id = '10000000-0000-0000-0000-000000000091';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000091","role":"authenticated"}',true);
select lives_ok(
  format(
    $$select public.complete_my_onboarding(date '1990-01-01', %L, %L, 'self_declared')$$,
    (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    (select value_json #>> '{}' from private.app_config where key='community_rules_version_current')
  ),
  'verified adult may re-accept current policies without rewriting identity'
);
reset role;
select set_config('request.jwt.claims','',true);

select is((select date_of_birth from private.user_identity where user_id='10000000-0000-0000-0000-000000000091'), date '2002-01-01', 'verified DOB is preserved');
select is((select age_verified_at from private.user_identity where user_id='10000000-0000-0000-0000-000000000091'), timestamptz '2026-01-02 03:04:05+00', 'age verification timestamp is preserved');
select is((select age_verification_method::text from private.user_identity where user_id='10000000-0000-0000-0000-000000000091'), 'self_declared', 'age verification method is preserved');
select is((select terms_version from private.user_identity where user_id='10000000-0000-0000-0000-000000000091'), (select value_json #>> '{}' from private.app_config where key='terms_version_current'), 'current Terms version is stored');
select is((select community_rules_version from private.user_identity where user_id='10000000-0000-0000-0000-000000000091'), (select value_json #>> '{}' from private.app_config where key='community_rules_version_current'), 'current Community Standards version is stored');

select * from finish();
rollback;
