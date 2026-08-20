begin;

select plan(13);

select ok(
  has_function_privilege(
    'service_role',
    'public.activate_verified_signup_profile_v2(uuid)',
    'EXECUTE'
  ),
  'service role can execute the verified Signup V2 activation gate'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.activate_verified_signup_profile_v2(uuid)',
    'EXECUTE'
  ),
  'ordinary authenticated users cannot activate their own verified profile directly'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.activate_verified_signup_profile_v2(uuid)',
    'EXECUTE'
  ),
  'anonymous users cannot execute the verified Signup V2 activation gate'
);

select ok(
  position(
    'activate_verified_signup_profile_v2' in pg_get_functiondef(
      'public.admin_review_member_photo_verification(uuid,uuid,text,text,uuid)'::regprocedure
    )
  ) > 0,
  'manual Admin approval reuses the same verified Signup V2 activation gate'
);

select ok(
  position(
    'nearby_enabled = false' in pg_get_functiondef(
      'public.admin_review_member_photo_verification(uuid,uuid,text,text,uuid)'::regprocedure
    )
  ) > 0,
  'manual hide explicitly disables nearby together with discovery'
);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
(
  '00000000-0000-0000-0000-000000000000',
  '29000000-0000-0000-0000-000000000001',
  'authenticated','authenticated','su09-fresh@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000',
  '29000000-0000-0000-0000-000000000002',
  'authenticated','authenticated','su09-stale@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000',
  '29000000-0000-0000-0000-000000000003',
  'authenticated','authenticated','su09-province-only@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
);

update private.user_identity
set date_of_birth = date '1992-01-01',
    age_verified_at = now(),
    age_verification_method = 'self_declared',
    terms_version = (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    terms_accepted_at = now(),
    community_rules_version = (select value_json #>> '{}' from private.app_config where key='community_rules_version_current'),
    community_rules_accepted_at = now(),
    account_status = 'active'
where user_id in (
  '29000000-0000-0000-0000-000000000001',
  '29000000-0000-0000-0000-000000000002',
  '29000000-0000-0000-0000-000000000003'
);

update public.profiles
set username = case id
      when '29000000-0000-0000-0000-000000000001' then 'su09fresh'
      when '29000000-0000-0000-0000-000000000002' then 'su09stale'
      else 'su09province'
    end::citext,
    display_name = case id
      when '29000000-0000-0000-0000-000000000001' then 'SU09 Fresh Member'
      when '29000000-0000-0000-0000-000000000002' then 'SU09 Stale Member'
      else 'SU09 Province Member'
    end,
    province_id = (select min(id) from public.administrative_areas where country_code='VN' and is_active and parent_id is null),
    looking_for = repeat('L', 80),
    lifestyle_tags = array['long_term']::public.profile_lifestyle_tag[],
    headline = 'Sẵn sàng kết nối chân thành',
    bio = repeat('B', 80),
    profile_status = 'pending_review',
    discovery_enabled = false,
    nearby_enabled = false
where id in (
  '29000000-0000-0000-0000-000000000001',
  '29000000-0000-0000-0000-000000000002',
  '29000000-0000-0000-0000-000000000003'
);

insert into public.media_assets(
  id,owner_id,storage_bucket,storage_path,mime_type,file_size_bytes,width,height,
  visibility,moderation_status,uploaded_at
) values
(
  '29000000-0000-4000-8000-000000000001',
  '29000000-0000-0000-0000-000000000001',
  'pending-media','29000000-0000-0000-0000-000000000001/29000000-0000-4000-8000-000000000001/original.jpg',
  'image/jpeg',2048,1200,1600,'avatar','pending_review',now()
),
(
  '29000000-0000-4000-8000-000000000002',
  '29000000-0000-0000-0000-000000000002',
  'pending-media','29000000-0000-0000-0000-000000000002/29000000-0000-4000-8000-000000000002/original.jpg',
  'image/jpeg',2048,1200,1600,'avatar','pending_review',now()
),
(
  '29000000-0000-4000-8000-000000000003',
  '29000000-0000-0000-0000-000000000003',
  'pending-media','29000000-0000-0000-0000-000000000003/29000000-0000-4000-8000-000000000003/original.jpg',
  'image/jpeg',2048,1200,1600,'avatar','pending_review',now()
);

insert into private.user_locations(
  user_id,location,accuracy_meters,captured_at,consented_at,is_enabled,source,expires_at
) values
(
  '29000000-0000-0000-0000-000000000001',
  extensions.st_setsrid(extensions.st_makepoint(106.7009,10.7769),4326)::extensions.geography,
  25,now(),now(),true,'device_foreground',now()+interval '7 days'
),
(
  '29000000-0000-0000-0000-000000000002',
  extensions.st_setsrid(extensions.st_makepoint(106.7009,10.7769),4326)::extensions.geography,
  25,now()-interval '31 minutes',now()-interval '31 minutes',true,'device_foreground',now()+interval '7 days'
);

set local role service_role;

select lives_ok(
  $$select public.activate_verified_signup_profile_v2('29000000-0000-0000-0000-000000000001')$$,
  'fresh consented GPS profile can be activated after selfie approval'
);

select ok(
  (
    select profile_status='active'::public.profile_status
      and discovery_enabled
      and nearby_enabled
    from public.profiles
    where id='29000000-0000-0000-0000-000000000001'
  ),
  'fresh usable GPS consent activates profile, discovery and nearby together'
);

select lives_ok(
  $$select public.activate_verified_signup_profile_v2('29000000-0000-0000-0000-000000000002')$$,
  'stale GPS profile still activates after selfie approval'
);

select ok(
  (
    select profile_status='active'::public.profile_status
      and discovery_enabled
      and not nearby_enabled
    from public.profiles
    where id='29000000-0000-0000-0000-000000000002'
  ),
  'GPS older than Search V2 freshness window does not enable nearby'
);

select lives_ok(
  $$select public.activate_verified_signup_profile_v2('29000000-0000-0000-0000-000000000003')$$,
  'province-only signup can activate without exact GPS'
);

select ok(
  (
    select profile_status='active'::public.profile_status
      and discovery_enabled
      and not nearby_enabled
    from public.profiles
    where id='29000000-0000-0000-0000-000000000003'
  ),
  'province-only signup activates discovery but keeps nearby disabled'
);

select throws_ok(
  $$select public.activate_verified_signup_profile_v2('29000000-0000-0000-0000-000000000001')$$,
  '42501',
  'verified signup profile must be incomplete or pending review',
  'activation gate cannot be replayed against an already-active profile'
);

select ok(
  position(
    'p.nearby_enabled' in pg_get_functiondef(
      'public.search_luxy_profiles_v2(text,bigint,numeric,smallint,smallint,public.gender_identity[],smallint,smallint,smallint,smallint,public.relationship_status[],public.children_status[],public.smoking_status[],public.drinking_status[],public.education_level[],public.profile_lifestyle_tag[],text[],text[],boolean,boolean,text,text,integer,integer)'::regprocedure
    )
  ) > 0,
  'Kết nối distance ranking still derives exact distance only through nearby-enabled private location'
);

reset role;
select * from finish();
rollback;
