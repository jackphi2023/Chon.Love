begin;

select plan(23);

select ok(
  has_function_privilege(
    'authenticated',
    'public.save_my_signup_headline_bio_v2(text,text)',
    'EXECUTE'
  ),
  'authenticated users can execute the staged Signup V2 headline/bio RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.save_my_signup_headline_bio_v2(text,text)',
    'EXECUTE'
  ),
  'anonymous users cannot execute the staged Signup V2 headline/bio RPC'
);

select ok(
  (
    select pg_get_constraintdef(oid) like '%4000%'
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_bio_length'
  ),
  'shared profiles.bio storage is widened safely to 4000 characters'
);

select ok(
  (
    select pg_get_constraintdef(oid) like '%120%'
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_headline_length'
  ),
  'mature headline storage remains unchanged at up to 120 characters'
);

select ok(
  position(
    '4000' in pg_get_functiondef(
      'public.update_my_profile(text,text,text,public.gender_identity,bigint,text[],boolean,boolean)'::regprocedure
    )
  ) > 0,
  'mature profile editor server contract accepts biographies up to 4000 characters'
);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
(
  '00000000-0000-0000-0000-000000000000',
  '28000000-0000-0000-0000-000000000001',
  'authenticated','authenticated','su08-about@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000',
  '28000000-0000-0000-0000-000000000002',
  'authenticated','authenticated','su08-no-photo@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000',
  '28000000-0000-0000-0000-000000000003',
  'authenticated','authenticated','su08-active@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
);

select set_config(
  'request.jwt.claims',
  '{"sub":"28000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  format(
    $$select public.save_my_signup_personal_info_v2(
      (current_date - interval '32 years')::date, %L, %L, 'About Member One',
      'female'::public.gender_identity, 'male'::public.dating_interest
    )$$,
    (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    (select value_json #>> '{}' from private.app_config where key='community_rules_version_current')
  ),
  'SU-04 establishes adult/policy authority for Step 7'
);

select lives_ok(
  format(
    $$select public.save_my_signup_location_v2(%s::bigint)$$,
    (select min(id) from public.administrative_areas where country_code='VN' and is_active and parent_id is null)
  ),
  'SU-05 establishes the required province for Step 7'
);

select lives_ok(
  $$select public.save_my_signup_looking_for_v2(
    repeat('L', 80),
    array['long_term','romantic']::public.profile_lifestyle_tag[]
  )$$,
  'SU-06 establishes relationship intent before Step 7'
);

insert into public.media_assets(
  id,owner_id,storage_bucket,storage_path,mime_type,file_size_bytes,width,height,
  visibility,moderation_status,uploaded_at
) values (
  '28000000-0000-4000-8000-000000000001',
  '28000000-0000-0000-0000-000000000001',
  'pending-media',
  '28000000-0000-0000-0000-000000000001/28000000-0000-4000-8000-000000000001/original.jpg',
  'image/jpeg',2048,1200,1600,'avatar','pending_review',now()
);

select lives_ok(
  $$select public.save_my_signup_headline_bio_v2(repeat('B', 50), null)$$,
  'headline may be blank when the required 50-character biography is present'
);

select is(
  (select headline from public.profiles where id='28000000-0000-0000-0000-000000000001'),
  null::text,
  'blank optional headline persists as null'
);

select is(
  (select char_length(bio) from public.profiles where id='28000000-0000-0000-0000-000000000001'),
  50,
  'Step 7 persists the minimum valid biography length'
);

select lives_ok(
  $$select public.save_my_signup_headline_bio_v2(repeat('C', 4000), repeat('H', 10))$$,
  'Step 7 accepts exactly 10 headline characters and 4000 biography characters'
);

select ok(
  (
    select char_length(headline)=10
      and char_length(bio)=4000
      and profile_status='incomplete'::public.profile_status
      and discovery_enabled=false
      and nearby_enabled=false
    from public.profiles
    where id='28000000-0000-0000-0000-000000000001'
  ),
  'Step 7 writes only profile copy and does not activate discovery/profile'
);

select throws_ok(
  $$select public.save_my_signup_headline_bio_v2(repeat('B', 80), repeat('H', 9))$$,
  '22023',
  'signup headline must be blank or 10 to 50 characters',
  'Step 7 rejects a nonblank headline shorter than 10 characters'
);

select throws_ok(
  $$select public.save_my_signup_headline_bio_v2(repeat('B', 80), repeat('H', 51))$$,
  '22023',
  'signup headline must be blank or 10 to 50 characters',
  'Step 7 rejects a headline longer than 50 characters'
);

select throws_ok(
  $$select public.save_my_signup_headline_bio_v2(repeat('B', 49), null)$$,
  '22023',
  'signup bio must be 50 to 4000 characters',
  'Step 7 rejects a biography shorter than 50 characters'
);

select throws_ok(
  $$select public.save_my_signup_headline_bio_v2(repeat('B', 4001), null)$$,
  '22023',
  'signup bio must be 50 to 4000 characters',
  'Step 7 rejects a biography longer than 4000 characters'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"28000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select lives_ok(
  format(
    $$select public.save_my_signup_personal_info_v2(
      (current_date - interval '30 years')::date, %L, %L, 'About Member Two',
      'male'::public.gender_identity, 'female'::public.dating_interest
    )$$,
    (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    (select value_json #>> '{}' from private.app_config where key='community_rules_version_current')
  ),
  'second Signup V2 profile can establish Personal Info before the photo prerequisite test'
);

select lives_ok(
  format(
    $$select public.save_my_signup_location_v2(%s::bigint)$$,
    (select min(id) from public.administrative_areas where country_code='VN' and is_active and parent_id is null)
  ),
  'second Signup V2 profile can establish Location before the photo prerequisite test'
);

select lives_ok(
  $$select public.save_my_signup_looking_for_v2(
    repeat('Q', 80),
    array['long_term']::public.profile_lifestyle_tag[]
  )$$,
  'second Signup V2 profile can establish Looking For without a photo'
);

select throws_ok(
  $$select public.save_my_signup_headline_bio_v2(repeat('B', 80), null)$$,
  '42501',
  'signup profile photo must be completed first',
  'Step 7 cannot bypass the required Step 6 profile photo'
);

update public.profiles
set username='legacyactive2803',
    display_name='Legacy Active About',
    headline=repeat('X', 60),
    bio='Short legacy biography remains valid.',
    profile_status='active',
    discovery_enabled=true,
    province_id=(select min(id) from public.administrative_areas where country_code='VN' and is_active and parent_id is null)
where id='28000000-0000-0000-0000-000000000003';

select set_config(
  'request.jwt.claims',
  '{"sub":"28000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.save_my_signup_headline_bio_v2(repeat('B', 80), repeat('H', 20))$$,
  '42501',
  'signup profile must be incomplete',
  'active legacy profiles cannot be rewritten through the staged Signup V2 Step 7 RPC'
);

select ok(
  (
    select profile_status='active'::public.profile_status
      and discovery_enabled=true
      and char_length(headline)=60
      and bio='Short legacy biography remains valid.'
    from public.profiles
    where id='28000000-0000-0000-0000-000000000003'
  ),
  'rejected staged Step 7 write leaves mature active headline/bio unchanged'
);

select set_config('request.jwt.claims','',true);
select * from finish();
rollback;