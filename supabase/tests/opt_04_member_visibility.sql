begin;

select plan(12);

select ok(
  has_function_privilege('authenticated','public.get_my_listing_approval_status()','EXECUTE'),
  'member visibility status is readable by the authenticated member'
);

select ok(
  not has_function_privilege('authenticated','public.list_discovery_profiles(text,bigint,integer,integer)','EXECUTE'),
  'retired legacy discovery RPC cannot bypass Search V2 visibility policy'
);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
(
  '00000000-0000-0000-0000-000000000000','34000000-0000-0000-0000-000000000001',
  'authenticated','authenticated','opt04-pending-viewer@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000','34000000-0000-0000-0000-000000000002',
  'authenticated','authenticated','opt04-approved@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000','34000000-0000-0000-0000-000000000003',
  'authenticated','authenticated','opt04-pending-target@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000','34000000-0000-0000-0000-000000000004',
  'authenticated','authenticated','opt04-premium@example.test','',
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
  '34000000-0000-0000-0000-000000000001',
  '34000000-0000-0000-0000-000000000002',
  '34000000-0000-0000-0000-000000000003',
  '34000000-0000-0000-0000-000000000004'
);

update public.profiles
set username=case id
      when '34000000-0000-0000-0000-000000000001' then 'opt04pendingviewer'
      when '34000000-0000-0000-0000-000000000002' then 'opt04approved'
      when '34000000-0000-0000-0000-000000000003' then 'opt04pendingtarget'
      else 'opt04premium'
    end::citext,
    public_profile_code=case id
      when '34000000-0000-0000-0000-000000000001' then '340001'
      when '34000000-0000-0000-0000-000000000002' then '340002'
      when '34000000-0000-0000-0000-000000000003' then '340003'
      else '340004'
    end,
    display_name=case id
      when '34000000-0000-0000-0000-000000000001' then 'OPT04 Pending Viewer'
      when '34000000-0000-0000-0000-000000000002' then 'OPT04 Approved'
      when '34000000-0000-0000-0000-000000000003' then 'OPT04 Pending Target'
      else 'OPT04 Premium'
    end,
    gender=case when id='34000000-0000-0000-0000-000000000001' then 'male'::public.gender_identity else 'female'::public.gender_identity end,
    interested_in='everyone'::public.dating_interest,
    province_id=(select min(id) from public.administrative_areas where country_code='VN' and is_active and parent_id is null),
    profile_status='active'::public.profile_status,
    discovery_enabled=true,
    nearby_enabled=false,
    last_active_at=now()
where id in (
  '34000000-0000-0000-0000-000000000001',
  '34000000-0000-0000-0000-000000000002',
  '34000000-0000-0000-0000-000000000003',
  '34000000-0000-0000-0000-000000000004'
);

insert into private.member_profile_verifications(user_id,listing_status,listing_submitted_at,listing_reviewed_at,listing_reason_code)
values
  ('34000000-0000-0000-0000-000000000001','pending',now(),null,null),
  ('34000000-0000-0000-0000-000000000002','approved',now(),now(),'admin_approved'),
  ('34000000-0000-0000-0000-000000000003','pending',now(),null,null),
  ('34000000-0000-0000-0000-000000000004','pending',now(),null,null)
on conflict(user_id) do update
set listing_status=excluded.listing_status,
    listing_submitted_at=excluded.listing_submitted_at,
    listing_reviewed_at=excluded.listing_reviewed_at,
    listing_reason_code=excluded.listing_reason_code,
    updated_at=now();

insert into private.luxy_memberships(user_id,tier,status,messaging_enabled,starts_at,expires_at,source)
values('34000000-0000-0000-0000-000000000004','premium','active',true,now()-interval '1 day',now()+interval '30 days','manual')
on conflict(user_id) do update
set tier='premium',status='active',starts_at=excluded.starts_at,expires_at=excluded.expires_at,updated_at=now();

set local role authenticated;
select set_config('request.jwt.claim.sub','34000000-0000-0000-0000-000000000001',true);

select is(
  (select listing_status from public.get_my_listing_approval_status() limit 1),
  'pending',
  'Free pending member sees their canonical listing status'
);

select is(
  (select is_paid_override from public.get_my_listing_approval_status() limit 1),
  false,
  'Free pending member has no paid visibility override'
);

select is(
  (select effective_discoverable from public.get_my_listing_approval_status() limit 1),
  false,
  'Free pending member is not effectively discoverable'
);

select is(
  (select count(*) from public.search_luxy_profiles_v2() where id='34000000-0000-0000-0000-000000000002'),
  1::bigint,
  'Free pending member can still use Connect/Search V2 to see an approved member'
);

select is(
  (select count(*) from public.search_luxy_profiles_v2() where id='34000000-0000-0000-0000-000000000003'),
  0::bigint,
  'Search V2 does not expose another Free pending member'
);

select is(
  (select count(*) from public.search_luxy_profiles_v2() where id='34000000-0000-0000-0000-000000000004'),
  1::bigint,
  'Search V2 exposes active Premium member through paid override even while listing status is pending'
);

select is(
  (select public_profile_code from public.resolve_chon_member_route('340003') limit 1),
  '340003',
  'authenticated direct route remains available for an active Free pending member'
);

reset role;

select is(
  (select public_profile_code from public.get_public_chon_profile_v2('340003') limit 1),
  '340003',
  'public direct profile remains available for an active Free pending member'
);

update public.profiles
set discovery_enabled=false
where id='34000000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub','34000000-0000-0000-0000-000000000001',true);

select is(
  (select count(*) from public.search_luxy_profiles_v2() where id='34000000-0000-0000-0000-000000000002'),
  0::bigint,
  'approved member discovery preference still controls Connect visibility'
);

reset role;

select is(
  (select public_profile_code from public.get_public_chon_profile_v2('340002') limit 1),
  '340002',
  'turning off Connect discovery does not remove the direct public profile'
);

select * from finish();
rollback;
