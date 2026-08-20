begin;

select plan(19);

select ok(
  has_function_privilege(
    'authenticated',
    'public.save_my_signup_looking_for_v2(text,public.profile_lifestyle_tag[])',
    'EXECUTE'
  ),
  'authenticated users can execute the staged Signup V2 looking-for RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.save_my_signup_looking_for_v2(text,public.profile_lifestyle_tag[])',
    'EXECUTE'
  ),
  'anonymous users cannot execute the staged Signup V2 looking-for RPC'
);

select ok(
  (
    select pg_get_constraintdef(oid) like '%4000%'
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_looking_for_length'
  ),
  'shared profiles.looking_for storage is widened safely to 4000 characters'
);

select ok(
  position(
    '4000' in pg_get_functiondef(
      'public.update_my_luxy_profile(text,text,text,public.gender_identity,bigint,text[],boolean,boolean,text,public.dating_interest,smallint,smallint,public.relationship_status,public.children_status,public.smoking_status,public.drinking_status,public.education_level,text,text,smallint,smallint,public.profile_lifestyle_tag[],text[])'::regprocedure
    )
  ) > 0,
  'mature profile editor server contract also accepts up to 4000 characters'
);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
(
  '00000000-0000-0000-0000-000000000000',
  '25000000-0000-0000-0000-000000000001',
  'authenticated','authenticated','su06-looking@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000',
  '25000000-0000-0000-0000-000000000002',
  'authenticated','authenticated','su06-no-location@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000',
  '25000000-0000-0000-0000-000000000003',
  'authenticated','authenticated','su06-active@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
);

update public.profiles
set username = 'legacyactive2503',
    display_name = 'Legacy Active Intent',
    profile_status = 'active',
    discovery_enabled = true,
    province_id = (
      select min(id)
      from public.administrative_areas
      where country_code = 'VN' and is_active and parent_id is null
    )
where id = '25000000-0000-0000-0000-000000000003';

select set_config(
  'request.jwt.claims',
  '{"sub":"25000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  format(
    $$select public.save_my_signup_personal_info_v2(
      (current_date - interval '31 years')::date, %L, %L, 'Intent Member One',
      'female'::public.gender_identity, 'male'::public.dating_interest
    )$$,
    (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    (select value_json #>> '{}' from private.app_config where key='community_rules_version_current')
  ),
  'SU-04 can establish the adult/policy authority before Step 5'
);

select lives_ok(
  format(
    $$select public.save_my_signup_location_v2(%s::bigint)$$,
    (select min(id) from public.administrative_areas where country_code='VN' and is_active and parent_id is null)
  ),
  'SU-05 can establish the required canonical province before Step 5'
);

select lives_ok(
  $$select public.save_my_signup_looking_for_v2(
    repeat('A', 1200),
    array['long_term','marriage_minded','ready_to_travel']::public.profile_lifestyle_tag[]
  )$$,
  'incomplete Signup V2 profile can save long-form intent plus 1-7 typed tags'
);

select ok(
  (
    select p.profile_status = 'incomplete'::public.profile_status
      and p.discovery_enabled = false
      and char_length(p.looking_for) = 1200
      and p.lifestyle_tags = array['long_term','marriage_minded','ready_to_travel']::public.profile_lifestyle_tag[]
    from public.profiles as p
    where p.id = '25000000-0000-0000-0000-000000000001'
  ),
  'Step 5 persists public intent fields without activating profile/discovery'
);

select lives_ok(
  $$select public.save_my_signup_looking_for_v2(
    repeat('B', 4000),
    array['true_love']::public.profile_lifestyle_tag[]
  )$$,
  'Signup V2 accepts exactly 4000 trimmed characters'
);

select throws_ok(
  $$select public.save_my_signup_looking_for_v2(
    repeat('C', 4001),
    array['true_love']::public.profile_lifestyle_tag[]
  )$$,
  '22023',
  'signup looking for must be 50 to 4000 characters',
  'Signup V2 rejects more than 4000 characters'
);

select throws_ok(
  $$select public.save_my_signup_looking_for_v2(
    repeat('D', 49),
    array['long_term']::public.profile_lifestyle_tag[]
  )$$,
  '22023',
  'signup looking for must be 50 to 4000 characters',
  'Signup V2 rejects fewer than 50 characters'
);

select throws_ok(
  $$select public.save_my_signup_looking_for_v2(
    repeat('E', 80),
    '{}'::public.profile_lifestyle_tag[]
  )$$,
  '22023',
  'signup lifestyle tags must contain 1 to 7 values',
  'Signup V2 requires at least one intent/lifestyle tag'
);

select throws_ok(
  $$select public.save_my_signup_looking_for_v2(
    repeat('F', 80),
    array[
      'true_love','luxury_lifestyle','active_lifestyle','flexible_schedule',
      'emotional_connection','refined','fine_dining','friendship'
    ]::public.profile_lifestyle_tag[]
  )$$,
  '22023',
  'signup lifestyle tags must contain 1 to 7 values',
  'Signup V2 rejects more than seven intent/lifestyle tag selections'
);

select lives_ok(
  $$select public.save_my_signup_looking_for_v2(
    repeat('G', 80),
    array['long_term','long_term','romantic']::public.profile_lifestyle_tag[]
  )$$,
  'duplicate typed tags are normalized safely while staying within the raw 1-7 selection bound'
);

select is(
  (
    select cardinality(lifestyle_tags)
    from public.profiles
    where id = '25000000-0000-0000-0000-000000000001'
  ),
  2,
  'duplicate tags are stored once while preserving first-selection order'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"25000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select lives_ok(
  format(
    $$select public.save_my_signup_personal_info_v2(
      (current_date - interval '29 years')::date, %L, %L, 'Intent Member Two',
      'male'::public.gender_identity, 'female'::public.dating_interest
    )$$,
    (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    (select value_json #>> '{}' from private.app_config where key='community_rules_version_current')
  ),
  'a second Signup V2 profile can complete Personal Info without location'
);

select throws_ok(
  $$select public.save_my_signup_looking_for_v2(
    repeat('H', 80),
    array['long_term']::public.profile_lifestyle_tag[]
  )$$,
  '42501',
  'signup location must be completed first',
  'Step 5 cannot bypass the required Step 4 province selection'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"25000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.save_my_signup_looking_for_v2(
    repeat('I', 80),
    array['long_term']::public.profile_lifestyle_tag[]
  )$$,
  '42501',
  'signup profile must be incomplete',
  'active legacy profiles cannot be rewritten through the staged Signup V2 Step 5 RPC'
);

select ok(
  (
    select p.profile_status = 'active'::public.profile_status
      and p.discovery_enabled = true
      and p.username::text = 'legacyactive2503'
    from public.profiles as p
    where p.id = '25000000-0000-0000-0000-000000000003'
  ),
  'rejected staged Step 5 write leaves the active legacy profile unchanged'
);

select set_config('request.jwt.claims','',true);

select * from finish();
rollback;