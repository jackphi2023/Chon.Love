begin;

select plan(18);

select has_column(
  'private','member_profile_verifications','listing_status',
  'listing approval lives in the existing private verification record'
);

select ok(
  has_function_privilege('service_role','public.admin_review_member_listing_verification(uuid,uuid,text,text,uuid)','EXECUTE')
  and not has_function_privilege('authenticated','public.admin_review_member_listing_verification(uuid,uuid,text,text,uuid)','EXECUTE'),
  'listing review is service-role only'
);

select ok(
  not has_function_privilege('authenticated','public.list_discovery_profiles(text,bigint,integer,integer)','EXECUTE'),
  'legacy discovery RPC cannot bypass the OPT-01 approval gate from clients'
);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
(
  '00000000-0000-0000-0000-000000000000','31000000-0000-0000-0000-000000000001',
  'authenticated','authenticated','opt01-caller@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000','31000000-0000-0000-0000-000000000002',
  'authenticated','authenticated','opt01-free@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000','31000000-0000-0000-0000-000000000003',
  'authenticated','authenticated','opt01-paid@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000','31000000-0000-0000-0000-000000000004',
  'authenticated','authenticated','opt01-moderator@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000','31000000-0000-0000-0000-000000000005',
  'authenticated','authenticated','opt01-signup-free@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
);

update private.user_identity
set date_of_birth=date '1992-01-01',
    age_verified_at=now(),
    age_verification_method='self_declared',
    terms_version=(select value_json#>>'{}' from private.app_config where key='terms_version_current'),
    terms_accepted_at=now(),
    community_rules_version=(select value_json#>>'{}' from private.app_config where key='community_rules_version_current'),
    community_rules_accepted_at=now(),
    account_status='active'
where user_id in (
  '31000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000002',
  '31000000-0000-0000-0000-000000000003',
  '31000000-0000-0000-0000-000000000004',
  '31000000-0000-0000-0000-000000000005'
);

update public.profiles
set username=case id
      when '31000000-0000-0000-0000-000000000001' then 'opt01caller'
      when '31000000-0000-0000-0000-000000000002' then 'opt01free'
      when '31000000-0000-0000-0000-000000000003' then 'opt01paid'
      when '31000000-0000-0000-0000-000000000004' then 'opt01moderator'
      else 'opt01signupfree'
    end::citext,
    public_profile_code=case id
      when '31000000-0000-0000-0000-000000000001' then '310001'
      when '31000000-0000-0000-0000-000000000002' then '310002'
      when '31000000-0000-0000-0000-000000000003' then '310003'
      when '31000000-0000-0000-0000-000000000004' then '310004'
      else '310005'
    end,
    display_name=case id
      when '31000000-0000-0000-0000-000000000001' then 'OPT01 Caller'
      when '31000000-0000-0000-0000-000000000002' then 'OPT01 Free'
      when '31000000-0000-0000-0000-000000000003' then 'OPT01 Paid'
      when '31000000-0000-0000-0000-000000000004' then 'OPT01 Moderator'
      else 'OPT01 Signup Free'
    end,
    gender=case when id='31000000-0000-0000-0000-000000000001' then 'male'::public.gender_identity else 'female'::public.gender_identity end,
    interested_in='everyone'::public.dating_interest,
    province_id=(select min(id) from public.administrative_areas where country_code='VN' and is_active and parent_id is null),
    profile_status=case when id='31000000-0000-0000-0000-000000000005' then 'pending_review'::public.profile_status else 'active'::public.profile_status end,
    discovery_enabled=case when id='31000000-0000-0000-0000-000000000005' then false else true end,
    nearby_enabled=false,
    headline=case when id='31000000-0000-0000-0000-000000000005' then 'Sẵn sàng kết nối chân thành' else headline end,
    bio=case when id='31000000-0000-0000-0000-000000000005' then repeat('B',80) else bio end,
    looking_for=case when id='31000000-0000-0000-0000-000000000005' then repeat('L',80) else looking_for end,
    lifestyle_tags=case when id='31000000-0000-0000-0000-000000000005' then array['long_term']::public.profile_lifestyle_tag[] else lifestyle_tags end
where id in (
  '31000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000002',
  '31000000-0000-0000-0000-000000000003',
  '31000000-0000-0000-0000-000000000004',
  '31000000-0000-0000-0000-000000000005'
);

insert into public.media_assets(
  id,owner_id,storage_bucket,storage_path,mime_type,file_size_bytes,width,height,
  visibility,moderation_status,uploaded_at
) values(
  '31000000-0000-4000-8000-000000000005',
  '31000000-0000-0000-0000-000000000005',
  'pending-media','31000000-0000-0000-0000-000000000005/31000000-0000-4000-8000-000000000005/original.jpg',
  'image/jpeg',2048,1200,1600,'avatar','pending_review',now()
);

insert into private.member_profile_verifications(user_id,listing_status,listing_submitted_at)
values
  ('31000000-0000-0000-0000-000000000001','approved',now()),
  ('31000000-0000-0000-0000-000000000002','pending',now()),
  ('31000000-0000-0000-0000-000000000003','pending',now()),
  ('31000000-0000-0000-0000-000000000004','approved',now())
on conflict(user_id) do update set listing_status=excluded.listing_status,listing_submitted_at=excluded.listing_submitted_at,updated_at=now();

insert into private.luxy_memberships(user_id,tier,status,messaging_enabled,starts_at,expires_at,source)
values('31000000-0000-0000-0000-000000000003','premium','active',true,now()-interval '1 day',now()+interval '30 days','manual')
on conflict(user_id) do update set tier='premium',status='active',starts_at=excluded.starts_at,expires_at=excluded.expires_at,updated_at=now();

insert into private.user_roles(user_id,role)
values('31000000-0000-0000-0000-000000000004','moderator')
on conflict do nothing;

set local role service_role;

select lives_ok(
  $$select public.activate_verified_signup_profile_v2('31000000-0000-0000-0000-000000000005')$$,
  'trusted selfie completion activates a valid Free signup'
);

select ok(
  (select profile_status='active'::public.profile_status and discovery_enabled from public.profiles where id='31000000-0000-0000-0000-000000000005'),
  'Free signup account/profile activates and initializes discovery preference on'
);

select is(
  (select listing_status from private.member_profile_verifications where user_id='31000000-0000-0000-0000-000000000005'),
  'pending',
  'Free signup enters listing approval pending instead of becoming immediately discoverable'
);

reset role;

select ok(
  private.luxy_listing_hidden('31000000-0000-0000-0000-000000000002'),
  'Free pending member is hidden from Connect'
);

select ok(
  not private.luxy_listing_hidden('31000000-0000-0000-0000-000000000003'),
  'active Premium member bypasses manual listing approval'
);

update public.profiles set discovery_enabled=false where id='31000000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000001',true);

select is(
  (select public_profile_code from public.resolve_chon_member_route('310002') limit 1),
  '310002',
  'direct authenticated route resolves an active pending member even when discovery preference is off'
);

reset role;

select is(
  (select public_profile_code from public.get_public_chon_profile_v2('310002') limit 1),
  '310002',
  'canonical public profile remains directly addressable while not discoverable'
);

update public.profiles set discovery_enabled=true where id='31000000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000001',true);

select is(
  (select count(*) from public.search_luxy_profiles_v2() where id='31000000-0000-0000-0000-000000000002'),
  0::bigint,
  'Search V2 excludes Free pending member'
);

select is(
  (select count(*) from public.search_luxy_profiles_v2() where id='31000000-0000-0000-0000-000000000003'),
  1::bigint,
  'Search V2 includes active Premium member even while listing review is pending'
);

reset role;
set local role service_role;

select lives_ok(
  $$select * from public.admin_review_member_listing_verification(
    '31000000-0000-0000-0000-000000000004',
    '31000000-0000-0000-0000-000000000002',
    'approve','admin_approved','31000000-0000-4000-8000-000000000001'
  )$$,
  'Admin can approve a pending Free listing without changing account status'
);

select is(
  (select listing_status from private.member_profile_verifications where user_id='31000000-0000-0000-0000-000000000002'),
  'approved',
  'Admin approval persists in the listing contract'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000001',true);

select is(
  (select count(*) from public.search_luxy_profiles_v2() where id='31000000-0000-0000-0000-000000000002'),
  1::bigint,
  'approved Free member appears in Search V2'
);

reset role;
update public.profiles set discovery_enabled=false where id='31000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000001',true);

select is(
  (select count(*) from public.search_luxy_profiles_v2() where id='31000000-0000-0000-0000-000000000002'),
  0::bigint,
  'member discovery preference remains authoritative after approval'
);

reset role;

select ok(
  position('p.discovery_enabled = true' in pg_get_functiondef('public.resolve_chon_member_route(text)'::regprocedure))=0,
  'direct route contract no longer depends on discovery flag'
);

select ok(
  position('p.discovery_enabled=true' in pg_get_functiondef('public.get_public_chon_profile_v2(text)'::regprocedure))=0,
  'public direct-profile read model no longer depends on discovery flag'
);

select * from finish();
rollback;
