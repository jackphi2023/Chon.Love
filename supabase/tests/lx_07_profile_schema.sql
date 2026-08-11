begin;

select plan(18);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
(
  '00000000-0000-0000-0000-000000000000',
  '17000000-0000-0000-0000-000000000001',
  'authenticated','authenticated','lx07-a@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000',
  '17000000-0000-0000-0000-000000000002',
  'authenticated','authenticated','lx07-b@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
);

select is(
  (select interested_in::text from public.profiles where id='17000000-0000-0000-0000-000000000001'),
  'everyone',
  'new profile defaults interested_in to everyone'
);

select is(
  (select relationship_status::text from public.profiles where id='17000000-0000-0000-0000-000000000001'),
  'prefer_not_to_say',
  'new profile defaults relationship status to prefer_not_to_say'
);

select is(
  (select height_cm from public.profiles where id='17000000-0000-0000-0000-000000000001'),
  null::smallint,
  'new profile keeps height nullable for legacy compatibility'
);

select is(
  (
    select pg_catalog.string_agg(enumlabel, ',' order by enumsortorder)
    from pg_catalog.pg_enum
    where enumtypid = 'public.dating_interest'::regtype
  ),
  'female,male,everyone',
  'dating interest enum matches the Seeking-derived first-step choices'
);

select is(
  (
    select pg_catalog.string_agg(enumlabel, ',' order by enumsortorder)
    from pg_catalog.pg_enum
    where enumtypid = 'public.relationship_status'::regtype
  ),
  'single,divorced,widowed,open,complicated,prefer_not_to_say',
  'relationship status enum covers the Luxy profile setup contract'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.update_my_luxy_profile(text,text,text,public.gender_identity,bigint,text[],boolean,boolean,public.dating_interest,smallint,public.relationship_status)',
    'EXECUTE'
  ),
  'authenticated members can execute the Luxy profile RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.update_my_luxy_profile(text,text,text,public.gender_identity,bigint,text[],boolean,boolean,public.dating_interest,smallint,public.relationship_status)',
    'EXECUTE'
  ),
  'anonymous users cannot execute the Luxy profile RPC'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema='public'
      and table_name='profiles'
      and column_name in ('date_of_birth','latitude','longitude','location','exact_location')
  ),
  0::bigint,
  'public profile contract still exposes no DOB or exact coordinate column'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema='private'
      and table_name='user_identity'
      and column_name='date_of_birth'
  ),
  1::bigint,
  'date of birth remains in private.user_identity'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"17000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.update_my_luxy_profile(
    'lx07_user_b','LX07 User B',null,'male',
    (select id from public.administrative_areas where country_code='VN' and code='79'),
    '{}'::text[],true,false,'female',175,'single'
  )$$,
  '42501',
  'adult_onboarding_required',
  'Luxy profile RPC preserves the adult-onboarding gate'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"17000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.complete_my_onboarding(
    (current_date - interval '30 years')::date,
    '2026-07',
    '2026-07',
    'self_declared'
  )$$,
  'adult onboarding succeeds before Luxy profile completion'
);

select lives_ok(
  $$select public.update_my_luxy_profile(
    'lx07_user_a',
    'LX07 User A',
    'Seeking-derived Luxy profile',
    'male',
    (select id from public.administrative_areas where country_code='VN' and code='79'),
    array['Du lịch','Ẩm thực'],
    true,
    true,
    'female',
    178,
    'single'
  )$$,
  'authenticated adult can save the Luxy profile contract'
);

select is(
  (select interested_in::text from public.profiles where id='17000000-0000-0000-0000-000000000001'),
  'female',
  'Luxy RPC persists interested_in'
);

select is(
  (select height_cm from public.profiles where id='17000000-0000-0000-0000-000000000001'),
  178::smallint,
  'Luxy RPC persists height_cm'
);

select is(
  (select relationship_status::text from public.profiles where id='17000000-0000-0000-0000-000000000001'),
  'single',
  'Luxy RPC persists relationship_status'
);

select lives_ok(
  $$select public.update_my_profile(
    'lx07_user_a',
    'LX07 User A legacy edit',
    'Legacy editor remains compatible',
    'male',
    (select id from public.administrative_areas where country_code='VN' and code='79'),
    array['Du lịch'],
    true,
    false
  )$$,
  'legacy update_my_profile RPC remains callable after LX-07'
);

select is(
  (
    select concat_ws('|', interested_in::text, height_cm::text, relationship_status::text)
    from public.profiles
    where id='17000000-0000-0000-0000-000000000001'
  ),
  'female|178|single',
  'legacy profile writes preserve the new Luxy fields'
);

select throws_ok(
  $$select public.update_my_luxy_profile(
    'lx07_user_a','LX07 User A',null,'male',
    (select id from public.administrative_areas where country_code='VN' and code='79'),
    '{}'::text[],true,false,'female',119,'single'
  )$$,
  '22023',
  'invalid_height_cm',
  'height outside the supported profile range is rejected'
);

select * from finish();
rollback;
