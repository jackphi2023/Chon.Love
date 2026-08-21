begin;

select plan(23);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'marital_status'
  ),
  'Signup V2 keeps relationship_status as the single relationship/marital-state field'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.save_my_signup_personal_info_v2(date,text,text,text,public.gender_identity,public.dating_interest,smallint,smallint,public.education_level,public.relationship_status,public.children_status,public.drinking_status,public.smoking_status)',
    'EXECUTE'
  ),
  'authenticated users can execute staged Signup V2 personal-info RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.save_my_signup_personal_info_v2(date,text,text,text,public.gender_identity,public.dating_interest,smallint,smallint,public.education_level,public.relationship_status,public.children_status,public.drinking_status,public.smoking_status)',
    'EXECUTE'
  ),
  'anonymous users cannot execute staged Signup V2 personal-info RPC'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name in ('date_of_birth','latitude','longitude','location','exact_location')
  ),
  0::bigint,
  'DOB and exact coordinates remain outside the public profile table'
);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
(
  '00000000-0000-0000-0000-000000000000',
  '23000000-0000-0000-0000-000000000001',
  'authenticated','authenticated','su03-valid@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000',
  '23000000-0000-0000-0000-000000000002',
  'authenticated','authenticated','su03-underage@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000',
  '23000000-0000-0000-0000-000000000003',
  'authenticated','authenticated','su03-legacy-active@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000',
  '23000000-0000-0000-0000-000000000004',
  'authenticated','authenticated','su03-existing-username@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000',
  '23000000-0000-0000-0000-000000000005',
  'authenticated','authenticated','su03-optional@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
);

update public.profiles
set username = 'legacyactive2303',
    display_name = 'Legacy Active Member',
    profile_status = 'active',
    discovery_enabled = true,
    province_id = (select min(id) from public.administrative_areas where country_code = 'VN' and is_active)
where id = '23000000-0000-0000-0000-000000000003';

update public.profiles
set username = 'keepme2304'
where id = '23000000-0000-0000-0000-000000000004';

select set_config(
  'request.jwt.claims',
  '{"sub":"23000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  format(
    $$select public.save_my_signup_personal_info_v2(
      p_date_of_birth => (current_date - interval '30 years')::date,
      p_terms_version => %L,
      p_community_rules_version => %L,
      p_display_name => 'Nguyen Minh Anh',
      p_gender => 'female'::public.gender_identity,
      p_interested_in => 'male'::public.dating_interest,
      p_height_cm => 165::smallint,
      p_weight_kg => 52::smallint,
      p_education_level => 'bachelors'::public.education_level,
      p_relationship_status => 'single'::public.relationship_status,
      p_children_status => 'no_children'::public.children_status,
      p_drinking_status => 'socially'::public.drinking_status,
      p_smoking_status => 'never'::public.smoking_status
    )$$,
    (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    (select value_json #>> '{}' from private.app_config where key='community_rules_version_current')
  ),
  'valid incomplete Signup V2 profile can persist Step 1 + Step 3 data'
);

select ok(
  (
    select username is not null
      and username::text ~ '^chon_[a-f0-9]{24}$'
      and char_length(username::text) <= 30
    from public.profiles
    where id = '23000000-0000-0000-0000-000000000001'
  ),
  'missing username is generated as an internal valid public-profile invariant'
);

select ok(
  (
    select profile_status = 'incomplete'::public.profile_status
      and discovery_enabled = false
      and nearby_enabled = false
      and province_id is null
      and avatar_media_id is null
    from public.profiles
    where id = '23000000-0000-0000-0000-000000000001'
  ),
  'Step 3 save does not activate discovery or prematurely fill later-step fields'
);

select is(
  (
    select concat_ws('|', display_name, gender::text, interested_in::text, height_cm::text, weight_kg::text)
    from public.profiles
    where id = '23000000-0000-0000-0000-000000000001'
  ),
  'Nguyen Minh Anh|female|male|165|52',
  'core personal fields are persisted with canonical profile columns'
);

select is(
  (
    select concat_ws('|', education_level::text, relationship_status::text, children_status::text, drinking_status::text, smoking_status::text)
    from public.profiles
    where id = '23000000-0000-0000-0000-000000000001'
  ),
  'bachelors|single|no_children|socially|never',
  'optional factual enum fields are persisted without a duplicate marital status'
);

select is(
  (select date_of_birth from private.user_identity where user_id = '23000000-0000-0000-0000-000000000001'),
  (current_date - interval '30 years')::date,
  'date of birth is persisted only in private.user_identity'
);

select ok(
  (
    select age_verified_at is not null
      and terms_version = (select value_json #>> '{}' from private.app_config where key='terms_version_current')
      and community_rules_version = (select value_json #>> '{}' from private.app_config where key='community_rules_version_current')
    from private.user_identity
    where user_id = '23000000-0000-0000-0000-000000000001'
  ),
  'existing adult and versioned policy authority is reused by the staged RPC'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"23000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);

select lives_ok(
  format(
    $$select public.save_my_signup_personal_info_v2(
      p_date_of_birth => (current_date - interval '28 years')::date,
      p_terms_version => %L,
      p_community_rules_version => %L,
      p_display_name => 'Member',
      p_gender => 'male'::public.gender_identity,
      p_interested_in => 'female'::public.dating_interest
    )$$,
    (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    (select value_json #>> '{}' from private.app_config where key='community_rules_version_current')
  ),
  'all optional factual fields may be omitted with a six-character display name'
);

select ok(
  (
    select height_cm is null
      and weight_kg is null
      and education_level = 'prefer_not_to_say'::public.education_level
      and relationship_status = 'prefer_not_to_say'::public.relationship_status
      and children_status = 'prefer_not_to_say'::public.children_status
      and drinking_status = 'prefer_not_to_say'::public.drinking_status
      and smoking_status = 'prefer_not_to_say'::public.smoking_status
    from public.profiles
    where id = '23000000-0000-0000-0000-000000000005'
  ),
  'omitted optional fields persist as null physical values and canonical not-shared enums'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"23000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  format(
    $$select public.save_my_signup_personal_info_v2(
      (current_date - interval '30 years')::date, %L, %L, 'Short',
      'female'::public.gender_identity, 'male'::public.dating_interest
    )$$,
    (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    (select value_json #>> '{}' from private.app_config where key='community_rules_version_current')
  ),
  '22023',
  'signup display_name must be between 6 and 50 characters',
  'Signup V2 rejects display names shorter than 6 characters'
);

select throws_ok(
  format(
    $$select public.save_my_signup_personal_info_v2(
      (current_date - interval '30 years')::date, %L, %L, repeat('A', 51),
      'female'::public.gender_identity, 'male'::public.dating_interest
    )$$,
    (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    (select value_json #>> '{}' from private.app_config where key='community_rules_version_current')
  ),
  '22023',
  'signup display_name must be between 6 and 50 characters',
  'Signup V2 rejects display names longer than 50 characters'
);

select throws_ok(
  format(
    $$select public.save_my_signup_personal_info_v2(
      (current_date - interval '30 years')::date, %L, %L, 'Valid Display Name',
      'female'::public.gender_identity, 'male'::public.dating_interest,
      221::smallint
    )$$,
    (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    (select value_json #>> '{}' from private.app_config where key='community_rules_version_current')
  ),
  '22023',
  'signup height_cm must be between 120 and 220',
  'Signup V2 height is capped at 220 cm without tightening the legacy global check'
);

select throws_ok(
  format(
    $$select public.save_my_signup_personal_info_v2(
      (current_date - interval '30 years')::date, %L, %L, 'Valid Display Name',
      'non_binary'::public.gender_identity, 'everyone'::public.dating_interest
    )$$,
    (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    (select value_json #>> '{}' from private.app_config where key='community_rules_version_current')
  ),
  '22023',
  'signup gender must be male or female',
  'Signup V2 Step 1 only accepts the current male/female self-gender choices'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"23000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  format(
    $$select public.save_my_signup_personal_info_v2(
      (current_date - interval '17 years')::date, %L, %L, 'Underage Member Name',
      'male'::public.gender_identity, 'female'::public.dating_interest
    )$$,
    (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    (select value_json #>> '{}' from private.app_config where key='community_rules_version_current')
  ),
  '22023',
  'user must be at least 18 years old',
  'under-18 Signup V2 users are rejected by the existing adult authority'
);

select ok(
  (
    select p.display_name is null and ui.date_of_birth is null and ui.age_verified_at is null
    from public.profiles p
    join private.user_identity ui on ui.user_id = p.id
    where p.id = '23000000-0000-0000-0000-000000000002'
  ),
  'failed under-18 transaction leaves staged profile and private identity untouched'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"23000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select throws_ok(
  format(
    $$select public.save_my_signup_personal_info_v2(
      (current_date - interval '30 years')::date, %L, %L, 'Legacy Active Member',
      'male'::public.gender_identity, 'female'::public.dating_interest
    )$$,
    (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    (select value_json #>> '{}' from private.app_config where key='community_rules_version_current')
  ),
  '42501',
  'signup profile must be incomplete',
  'active legacy profiles cannot be rewritten through the stricter Signup V2 RPC'
);

select is(
  (
    select concat_ws('|', username::text, display_name, profile_status::text, discovery_enabled::text)
    from public.profiles
    where id = '23000000-0000-0000-0000-000000000003'
  ),
  'legacyactive2303|Legacy Active Member|active|true',
  'active legacy profile remains unchanged after rejected staged write'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"23000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

select lives_ok(
  format(
    $$select public.save_my_signup_personal_info_v2(
      (current_date - interval '30 years')::date, %L, %L, 'Existing User Name',
      'male'::public.gender_identity, 'female'::public.dating_interest
    )$$,
    (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    (select value_json #>> '{}' from private.app_config where key='community_rules_version_current')
  ),
  'incomplete profile with an existing username can continue Signup V2'
);

select is(
  (select username::text from public.profiles where id = '23000000-0000-0000-0000-000000000004'),
  'keepme2304',
  'existing username is preserved rather than regenerated'
);

select set_config('request.jwt.claims','',true);

select * from finish();
rollback;
