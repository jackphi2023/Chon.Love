begin;

-- Historical filename is retained because the LX-15 workflow invokes it as a
-- regression suite. Assertions below intentionally follow the final LX-20 product
-- contract, which supersedes LX-14 owner-approval semantics.
select plan(26);

select has_table('private','private_photo_access_requests','legacy Private Photo request storage remains for backward compatibility');
select ok(not has_table_privilege('authenticated','private.private_photo_access_requests','select'),'authenticated cannot read legacy Private Photo request storage directly');
select ok(has_function_privilege('authenticated','public.get_private_photo_access_state(uuid)','execute'),'member can read server-authoritative Private Photo entitlement state');
select ok(has_function_privilege('authenticated','public.list_profile_private_media(uuid)','execute'),'paid member can list eligible Private Photos through RPC');
select ok(has_function_privilege('authenticated','public.get_luxy_profile_conversation(uuid)','execute'),'profile messaging uses paid-gated direct-conversation RPC');
select ok(not has_function_privilege('anon','public.get_private_photo_access_state(uuid)','execute'),'anonymous users cannot inspect Private Photo entitlement state');

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
('00000000-0000-0000-0000-000000000000','24000000-0000-0000-0000-000000000001','authenticated','authenticated','lx20-viewer@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','24000000-0000-0000-0000-000000000002','authenticated','authenticated','lx20-owner@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','24000000-0000-0000-0000-000000000003','authenticated','authenticated','lx20-other@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','24000000-0000-0000-0000-000000000099','authenticated','authenticated','lx20-moderator@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

update private.user_identity
set date_of_birth=(current_date-interval '30 years')::date,
    age_verified_at=now(),
    age_verification_method='self_declared',
    terms_version=(select value_json#>>'{}' from private.app_config where key='terms_version_current'),
    terms_accepted_at=now(),
    community_rules_version=(select value_json#>>'{}' from private.app_config where key='community_rules_version_current'),
    community_rules_accepted_at=now(),
    account_status='active'
where user_id in (
  '24000000-0000-0000-0000-000000000001'::uuid,
  '24000000-0000-0000-0000-000000000002'::uuid,
  '24000000-0000-0000-0000-000000000003'::uuid
);

update public.profiles
set profile_status='active',discovery_enabled=true,
    province_id=(select id from public.administrative_areas where country_code='VN' and code='79'),
    username=case id
      when '24000000-0000-0000-0000-000000000001' then 'lx20_viewer'
      when '24000000-0000-0000-0000-000000000002' then 'lx20_owner'
      else 'lx20_other' end,
    display_name=case id
      when '24000000-0000-0000-0000-000000000001' then 'LX20 Viewer'
      when '24000000-0000-0000-0000-000000000002' then 'LX20 Owner'
      else 'LX20 Other' end,
    gender='male'::public.gender_identity,
    interested_in='female'::public.dating_interest
where id in (
  '24000000-0000-0000-0000-000000000001'::uuid,
  '24000000-0000-0000-0000-000000000002'::uuid,
  '24000000-0000-0000-0000-000000000003'::uuid
);

insert into public.media_assets(
  id,owner_id,storage_bucket,storage_path,media_type,mime_type,file_size_bytes,width,height,
  visibility,moderation_status,uploaded_at,approved_at,approved_by
) values(
  '24000000-0000-4000-8000-000000000101',
  '24000000-0000-0000-0000-000000000002',
  'profile-media',
  '24000000-0000-0000-0000-000000000002/24000000-0000-4000-8000-000000000101/lx20-private.png',
  'image','image/png',100,100,100,'private','approved',now(),now(),'24000000-0000-0000-0000-000000000099'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select tier::text from public.get_my_luxy_membership_snapshot()),'free','viewer starts Free');
select is((select can_favorite from public.get_my_luxy_membership_snapshot()),true,'Free can add Favorite/Interest');
select is((select can_request_private_photo from public.get_my_luxy_membership_snapshot()),false,'Free does not have paid Private Photo entitlement');
select lives_ok(
  $$select * from public.set_profile_favorite('24000000-0000-0000-0000-000000000002',true)$$,
  'Free can add Favorite without a paid-membership gate'
);
select is((select status from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000002')),'not_requested','Free receives a locked entitlement state, not an approval workflow');
select is((select has_access from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000002')),false,'Free has no Private Photo access');
select is((select can_request from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000002')),false,'LX-20 legacy request flow is not an authorization path');
select is((select private_photo_count from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000002')),1,'Free receives only the safe approved Private Photo count');
select throws_ok(
  $$select * from public.list_profile_private_media('24000000-0000-0000-0000-000000000002')$$,
  '42501','premium_membership_required','Free cannot list Private Photo storage paths'
);
select throws_ok(
  $$select public.get_luxy_profile_conversation('24000000-0000-0000-0000-000000000002')$$,
  '42501','premium_membership_required','Free cannot open direct messaging by bypassing UI'
);
reset role;

select is(
  (select count(*) from public.profile_favorites where owner_id='24000000-0000-0000-0000-000000000001' and favorite_id='24000000-0000-0000-0000-000000000002'),
  1::bigint,
  'Free Favorite persists'
);

insert into private.luxy_memberships(user_id,tier,status,messaging_enabled,starts_at,expires_at,source)
values('24000000-0000-0000-0000-000000000001','premium','active',true,now()-interval '1 day',now()+interval '30 days','lx20_regression_test');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select ok(
  (select can_message and can_favorite and can_request_private_photo from public.get_my_luxy_membership_snapshot()),
  'Premium enables direct messaging and Private Photo entitlement while retaining Favorite'
);
select is((select status from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000002')),'approved','Premium entitlement is automatically approved');
select is((select has_access from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000002')),true,'Premium automatically has Private Photo access');
select is((select can_request from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000002')),false,'Premium does not need legacy owner approval');
select is((select count(*) from public.list_profile_private_media('24000000-0000-0000-0000-000000000002')),1::bigint,'Premium can list eligible Private Photos automatically');
reset role;

select ok(private.can_view_media_internal('24000000-0000-4000-8000-000000000101','24000000-0000-0000-0000-000000000001'),'central media authorization permits active Premium member');
select ok(
  position('private_photo_access_requests' in lower(pg_get_functiondef('private.has_approved_private_photo_access(uuid,uuid)'::regprocedure)))=0
  and position('gift' in lower(pg_get_functiondef('private.has_approved_private_photo_access(uuid,uuid)'::regprocedure)))=0
  and position('fan' in lower(pg_get_functiondef('private.has_approved_private_photo_access(uuid,uuid)'::regprocedure)))=0
  and position('friendship' in lower(pg_get_functiondef('private.has_approved_private_photo_access(uuid,uuid)'::regprocedure)))=0,
  'Private Photo authorization is independent of legacy approval, Gift, Fan and friendship state'
);

update private.luxy_memberships
set status='expired',expires_at=now()-interval '1 second'
where user_id='24000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select has_access from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000002')),false,'Private Photo access is removed immediately when Premium expires');
select throws_ok(
  $$select * from public.list_profile_private_media('24000000-0000-0000-0000-000000000002')$$,
  '42501','premium_membership_required','Expired Premium cannot list Private Photos'
);

reset role;
select * from finish();
rollback;
