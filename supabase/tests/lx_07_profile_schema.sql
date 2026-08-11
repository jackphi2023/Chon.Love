begin;

select plan(29);

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
  (select headline from public.profiles where id='17000000-0000-0000-0000-000000000001'),
  null::text,
  'new profile keeps headline nullable for legacy compatibility'
);

select ok(
  (select height_cm is null and weight_kg is null from public.profiles where id='17000000-0000-0000-0000-000000000001'),
  'new profile keeps physical fields nullable for legacy compatibility'
);

select is(
  (
    select concat_ws('|', children_status::text, smoking_status::text, drinking_status::text, education_level::text)
    from public.profiles where id='17000000-0000-0000-0000-000000000001'
  ),
  'prefer_not_to_say|prefer_not_to_say|prefer_not_to_say|prefer_not_to_say',
  'new lifestyle/career enums default to prefer_not_to_say'
);

select is(
  (
    select concat_ws('|', age_preference_min::text, age_preference_max::text)
    from public.profiles where id='17000000-0000-0000-0000-000000000001'
  ),
  '18|99',
  'new profile receives a broad adult age preference by default'
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

select is(
  (
    select count(*)
    from pg_catalog.pg_enum
    where enumtypid = 'public.profile_lifestyle_tag'::regtype
  ),
  17::bigint,
  'canonical Luxy lifestyle/intent tag taxonomy contains 17 Seeking-derived codes'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.update_my_luxy_profile(text,text,text,public.gender_identity,bigint,text[],boolean,boolean,text,public.dating_interest,smallint,smallint,public.relationship_status,public.children_status,public.smoking_status,public.drinking_status,public.education_level,text,text,smallint,smallint,public.profile_lifestyle_tag[],text[])',
    'EXECUTE'
  ),
  'authenticated members can execute the Luxy profile RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.update_my_luxy_profile(text,text,text,public.gender_identity,bigint,text[],boolean,boolean,text,public.dating_interest,smallint,smallint,public.relationship_status,public.children_status,public.smoking_status,public.drinking_status,public.education_level,text,text,smallint,smallint,public.profile_lifestyle_tag[],text[])',
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
    p_username => 'lx07_user_b'::text,
    p_display_name => 'LX07 User B'::text,
    p_gender => 'male'::public.gender_identity,
    p_province_id => (select id from public.administrative_areas where country_code='VN' and code='79'),
    p_interested_in => 'female'::public.dating_interest,
    p_height_cm => 175::smallint,
    p_relationship_status => 'single'::public.relationship_status
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
    'terms-2026-07-30-v1',
    'community-2026-07-30-v1',
    'self_declared'
  )$$,
  'adult onboarding succeeds before Luxy profile completion'
);

select lives_ok(
  $$select public.update_my_luxy_profile(
    p_username => 'lx07_user_a'::text,
    p_display_name => 'LX07 User A'::text,
    p_bio => 'Seeking-derived Luxy profile'::text,
    p_gender => 'male'::public.gender_identity,
    p_province_id => (select id from public.administrative_areas where country_code='VN' and code='79'),
    p_interests => array['Du lịch','Ẩm thực']::text[],
    p_discovery_enabled => true,
    p_nearby_enabled => true,
    p_headline => 'Doanh nhân yêu du lịch'::text,
    p_interested_in => 'female'::public.dating_interest,
    p_height_cm => 178::smallint,
    p_weight_kg => 72::smallint,
    p_relationship_status => 'single'::public.relationship_status,
    p_children_status => 'no_children'::public.children_status,
    p_smoking_status => 'never'::public.smoking_status,
    p_drinking_status => 'socially'::public.drinking_status,
    p_education_level => 'masters'::public.education_level,
    p_occupation => 'Doanh nhân'::text,
    p_looking_for => 'Mối quan hệ nghiêm túc, tôn trọng và cùng phát triển.'::text,
    p_age_preference_min => 25::smallint,
    p_age_preference_max => 40::smallint,
    p_lifestyle_tags => array['long_term','marriage_minded','long_term','ready_to_travel']::public.profile_lifestyle_tag[],
    p_languages => array[' Tiếng Việt ','tiếng việt','English']::text[]
  )$$,
  'authenticated adult can save the complete Luxy profile contract'
);

select is(
  (
    select concat_ws('|', headline, interested_in::text)
    from public.profiles where id='17000000-0000-0000-0000-000000000001'
  ),
  'Doanh nhân yêu du lịch|female',
  'Luxy RPC persists headline and interested_in'
);

select is(
  (
    select concat_ws('|', height_cm::text, weight_kg::text)
    from public.profiles where id='17000000-0000-0000-0000-000000000001'
  ),
  '178|72',
  'Luxy RPC persists physical fields'
);

select is(
  (
    select concat_ws('|', relationship_status::text, children_status::text, smoking_status::text, drinking_status::text)
    from public.profiles where id='17000000-0000-0000-0000-000000000001'
  ),
  'single|no_children|never|socially',
  'Luxy RPC persists relationship and lifestyle fields'
);

select is(
  (
    select concat_ws('|', education_level::text, occupation)
    from public.profiles where id='17000000-0000-0000-0000-000000000001'
  ),
  'masters|Doanh nhân',
  'Luxy RPC persists education and occupation'
);

select is(
  (
    select concat_ws('|', looking_for, age_preference_min::text, age_preference_max::text)
    from public.profiles where id='17000000-0000-0000-0000-000000000001'
  ),
  'Mối quan hệ nghiêm túc, tôn trọng và cùng phát triển.|25|40',
  'Luxy RPC persists looking-for copy and preferred age range'
);

select is(
  (
    select array_to_string(lifestyle_tags::text[], ',')
    from public.profiles where id='17000000-0000-0000-0000-000000000001'
  ),
  'long_term,marriage_minded,ready_to_travel',
  'Luxy RPC de-duplicates and persists canonical lifestyle tags'
);

select is(
  (
    select array_to_string(languages, '|')
    from public.profiles where id='17000000-0000-0000-0000-000000000001'
  ),
  'Tiếng Việt|English',
  'Luxy RPC trims and de-duplicates public language labels'
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
    select concat_ws('|', headline, interested_in::text, height_cm::text, relationship_status::text, occupation)
    from public.profiles
    where id='17000000-0000-0000-0000-000000000001'
  ),
  'Doanh nhân yêu du lịch|female|178|single|Doanh nhân',
  'legacy profile writes preserve all new Luxy fields'
);

select throws_ok(
  $$select public.update_my_luxy_profile(
    p_username => 'lx07_user_a'::text,
    p_display_name => 'LX07 User A'::text,
    p_height_cm => 119::smallint
  )$$,
  '22023',
  'invalid_height_cm',
  'height outside the supported profile range is rejected'
);

select throws_ok(
  $$select public.update_my_luxy_profile(
    p_username => 'lx07_user_a'::text,
    p_display_name => 'LX07 User A'::text,
    p_weight_kg => 251::smallint
  )$$,
  '22023',
  'invalid_weight_kg',
  'weight outside the supported profile range is rejected'
);

select throws_ok(
  $$select public.update_my_luxy_profile(
    p_username => 'lx07_user_a'::text,
    p_display_name => 'LX07 User A'::text,
    p_age_preference_min => 45::smallint,
    p_age_preference_max => 30::smallint
  )$$,
  '22023',
  'invalid_age_preference',
  'inverted preferred age range is rejected'
);

select throws_ok(
  $$select public.update_my_luxy_profile(
    p_username => 'lx07_user_a'::text,
    p_display_name => 'LX07 User A'::text,
    p_lifestyle_tags => array[
      'true_love','luxury_lifestyle','active_lifestyle','flexible_schedule',
      'emotional_connection','refined','fine_dining','friendship','long_term',
      'marriage_minded','monogamous','romantic','ready_to_travel'
    ]::public.profile_lifestyle_tag[]
  )$$,
  '22023',
  'too_many_lifestyle_tags',
  'more than 12 lifestyle tags are rejected'
);

select throws_ok(
  $$select public.update_my_luxy_profile(
    p_username => 'lx07_user_a'::text,
    p_display_name => 'LX07 User A'::text,
    p_languages => array['a']::text[]
  )$$,
  '22023',
  'invalid_language',
  'invalid public language labels are rejected'
);

select * from finish();
rollback;
