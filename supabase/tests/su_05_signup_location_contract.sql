begin;

select plan(19);

select ok(
  has_function_privilege(
    'authenticated',
    'public.save_my_signup_location_v2(bigint,double precision,double precision,integer,timestamptz,text)',
    'EXECUTE'
  ),
  'authenticated users can execute the staged Signup V2 location RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.save_my_signup_location_v2(bigint,double precision,double precision,integer,timestamptz,text)',
    'EXECUTE'
  ),
  'anonymous users cannot execute the staged Signup V2 location RPC'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name in ('latitude','longitude','location','exact_location')
  ),
  0::bigint,
  'exact coordinates are never added to the public profile table'
);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
(
  '00000000-0000-0000-0000-000000000000',
  '24000000-0000-0000-0000-000000000001',
  'authenticated','authenticated','su05-gps@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000',
  '24000000-0000-0000-0000-000000000002',
  'authenticated','authenticated','su05-province@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000',
  '24000000-0000-0000-0000-000000000003',
  'authenticated','authenticated','su05-before-personal@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000',
  '24000000-0000-0000-0000-000000000004',
  'authenticated','authenticated','su05-legacy-active@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
);

update public.profiles
set username = 'legacyactive2404',
    display_name = 'Legacy Active Member',
    profile_status = 'active',
    discovery_enabled = true,
    province_id = (
      select min(id)
      from public.administrative_areas
      where country_code = 'VN' and is_active and parent_id is null
    )
where id = '24000000-0000-0000-0000-000000000004';

select set_config(
  'request.jwt.claims',
  '{"sub":"24000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  format(
    $$select public.save_my_signup_personal_info_v2(
      (current_date - interval '30 years')::date, %L, %L, 'Location Member One',
      'female'::public.gender_identity, 'male'::public.dating_interest
    )$$,
    (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    (select value_json #>> '{}' from private.app_config where key='community_rules_version_current')
  ),
  'SU-04 personal info can establish the adult/policy authority before location'
);

select lives_ok(
  format(
    $$select public.save_my_signup_location_v2(
      %s::bigint, 10.7769::double precision, 106.7009::double precision,
      50, now(), 'device_foreground'
    )$$,
    (select min(id) from public.administrative_areas where country_code='VN' and is_active and parent_id is null)
  ),
  'incomplete Signup V2 profile can save province plus consented current location'
);

select ok(
  (
    select p.profile_status = 'incomplete'::public.profile_status
      and p.discovery_enabled = false
      and p.nearby_enabled = false
      and p.province_id = (
        select min(id) from public.administrative_areas
        where country_code='VN' and is_active and parent_id is null
      )
    from public.profiles as p
    where p.id = '24000000-0000-0000-0000-000000000001'
  ),
  'Step 4 stores public province while nearby/discovery remain disabled until profile activation'
);

select ok(
  (
    select ul.is_enabled
      and ul.source = 'device_foreground'
      and ul.accuracy_meters = 50
      and ul.expires_at > now()
      and abs(extensions.st_y(ul.location::extensions.geometry) - 10.7769) < 0.00001
      and abs(extensions.st_x(ul.location::extensions.geometry) - 106.7009) < 0.00001
    from private.user_locations as ul
    where ul.user_id = '24000000-0000-0000-0000-000000000001'
  ),
  'exact GPS consent and coordinates are stored only in the private location table'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"24000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select lives_ok(
  format(
    $$select public.save_my_signup_personal_info_v2(
      (current_date - interval '28 years')::date, %L, %L, 'Location Member Two',
      'male'::public.gender_identity, 'female'::public.dating_interest
    )$$,
    (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    (select value_json #>> '{}' from private.app_config where key='community_rules_version_current')
  ),
  'second Signup V2 profile can complete Personal Info before a province-only location save'
);

select lives_ok(
  format(
    $$select public.save_my_signup_location_v2(%s::bigint)$$,
    (select max(id) from public.administrative_areas where country_code='VN' and is_active and parent_id is null)
  ),
  'GPS permission is optional when a canonical province/city is selected'
);

select ok(
  (
    select p.profile_status = 'incomplete'::public.profile_status
      and p.discovery_enabled = false
      and p.nearby_enabled = false
      and p.province_id = (
        select max(id) from public.administrative_areas
        where country_code='VN' and is_active and parent_id is null
      )
      and not exists (
        select 1 from private.user_locations as ul
        where ul.user_id = p.id
      )
    from public.profiles as p
    where p.id = '24000000-0000-0000-0000-000000000002'
  ),
  'province-only signup stores no exact location and keeps nearby disabled'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"24000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  format(
    $$select public.save_my_signup_location_v2(%s::bigint)$$,
    (select min(id) from public.administrative_areas where country_code='VN' and is_active and parent_id is null)
  ),
  'province-only retry does not require recapturing an already-consented location'
);

select ok(
  (
    select not p.nearby_enabled
      and not p.discovery_enabled
      and ul.is_enabled
      and ul.expires_at > now()
    from public.profiles as p
    join private.user_locations as ul on ul.user_id = p.id
    where p.id = '24000000-0000-0000-0000-000000000001'
  ),
  'province-only retry preserves private location while public nearby stays off until activation'
);

select throws_ok(
  $$select public.save_my_signup_location_v2(-999999::bigint)$$,
  '22023',
  'invalid signup province',
  'invalid/non-canonical province ids are rejected'
);

select throws_ok(
  format(
    $$select public.save_my_signup_location_v2(%s::bigint, 10.7::double precision)$$,
    (select min(id) from public.administrative_areas where country_code='VN' and is_active and parent_id is null)
  ),
  '22023',
  'signup location payload must be complete',
  'partial exact-location payloads are rejected atomically'
);

select throws_ok(
  format(
    $$select public.save_my_signup_location_v2(
      %s::bigint, 10.7::double precision, 106.7::double precision,
      6001, now(), 'device_foreground'
    )$$,
    (select min(id) from public.administrative_areas where country_code='VN' and is_active and parent_id is null)
  ),
  '22023',
  'location accuracy too low',
  'location accuracy remains bounded by the existing location configuration'
);

select throws_ok(
  format(
    $$select public.save_my_signup_location_v2(
      %s::bigint, 10.7::double precision, 106.7::double precision,
      50, now(), 'browser_guess'
    )$$,
    (select min(id) from public.administrative_areas where country_code='VN' and is_active and parent_id is null)
  ),
  '22023',
  'invalid location source',
  'unapproved location sources are rejected'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"24000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select throws_ok(
  format(
    $$select public.save_my_signup_location_v2(%s::bigint)$$,
    (select min(id) from public.administrative_areas where country_code='VN' and is_active and parent_id is null)
  ),
  '42501',
  'signup personal info must be completed first',
  'Step 4 cannot bypass the SU-04 adult/policy authority'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"24000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

select throws_ok(
  format(
    $$select public.save_my_signup_location_v2(%s::bigint)$$,
    (select min(id) from public.administrative_areas where country_code='VN' and is_active and parent_id is null)
  ),
  '42501',
  'signup profile must be incomplete',
  'active legacy profiles cannot be rewritten through the staged Signup V2 location RPC'
);

select ok(
  (
    select p.profile_status = 'active'::public.profile_status
      and p.discovery_enabled = true
      and p.username::text = 'legacyactive2404'
    from public.profiles as p
    where p.id = '24000000-0000-0000-0000-000000000004'
  ),
  'rejected staged location write leaves the active legacy profile unchanged'
);

select set_config('request.jwt.claims','',true);

select * from finish();
rollback;