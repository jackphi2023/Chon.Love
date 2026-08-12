begin;

select plan(36);

select has_table('private','private_photo_access_requests','Private Photo access requests are stored server-side');
select ok(not has_table_privilege('authenticated','private.private_photo_access_requests','select'),'authenticated cannot read Private Photo request table directly');
select ok(has_function_privilege('authenticated','public.get_private_photo_access_state(uuid)','execute'),'member can read Private Photo access state through RPC');
select ok(has_function_privilege('authenticated','public.request_private_photo_access(uuid)','execute'),'member can request Private Photo access through RPC');
select ok(has_function_privilege('authenticated','public.respond_private_photo_access(uuid,text)','execute'),'owner can respond through RPC');
select ok(has_function_privilege('authenticated','public.revoke_private_photo_access(uuid)','execute'),'owner can revoke through RPC');
select ok(has_function_privilege('authenticated','public.list_received_private_photo_requests(text)','execute'),'owner can list received requests through RPC');
select ok(has_function_privilege('authenticated','public.list_profile_private_media(uuid)','execute'),'approved viewer can list Private Photos through RPC');
select ok(has_function_privilege('authenticated','public.get_luxy_profile_conversation(uuid)','execute'),'profile messaging uses paid-gated conversation RPC');
select ok(not has_function_privilege('anon','public.request_private_photo_access(uuid)','execute'),'anonymous cannot request Private Photos');

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
('00000000-0000-0000-0000-000000000000','24000000-0000-0000-0000-000000000001','authenticated','authenticated','lx14-viewer@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','24000000-0000-0000-0000-000000000002','authenticated','authenticated','lx14-owner@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','24000000-0000-0000-0000-000000000003','authenticated','authenticated','lx14-other@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','24000000-0000-0000-0000-000000000099','authenticated','authenticated','lx14-moderator@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

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
      when '24000000-0000-0000-0000-000000000001' then 'lx14_viewer'
      when '24000000-0000-0000-0000-000000000002' then 'lx14_owner'
      else 'lx14_other' end,
    display_name=case id
      when '24000000-0000-0000-0000-000000000001' then 'LX14 Viewer'
      when '24000000-0000-0000-0000-000000000002' then 'LX14 Owner'
      else 'LX14 Other' end,
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
  '24000000-0000-0000-0000-000000000002/24000000-0000-4000-8000-000000000101/lx14-private.png',
  'image','image/png',100,100,100,'private','approved',now(),now(),'24000000-0000-0000-0000-000000000099'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000001","role":"authenticated"}',true);

select is((select tier::text from public.get_my_luxy_membership_snapshot()),'free','LX-14 viewer starts Free');
select is((select can_favorite from public.get_my_luxy_membership_snapshot()),false,'Free cannot add Favorite/Interest');
select is((select can_request_private_photo from public.get_my_luxy_membership_snapshot()),false,'Free cannot request Private Photos');
select throws_ok(
  $$select * from public.set_profile_favorite('24000000-0000-0000-0000-000000000002',true)$$,
  '42501','premium_membership_required','Free cannot add Favorite by bypassing UI'
);
select throws_ok(
  $$select * from public.request_private_photo_access('24000000-0000-0000-0000-000000000002')$$,
  '42501','premium_membership_required','Free cannot request Private Photos by bypassing UI'
);
select throws_ok(
  $$select public.get_luxy_profile_conversation('24000000-0000-0000-0000-000000000002')$$,
  '42501','premium_membership_required','Free cannot use profile messaging RPC by bypassing UI'
);
select is((select has_access from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000002')),false,'Free has no Private Photo access');
select is((select private_photo_count from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000002')),1,'Private Photo state exposes safe approved count only');

reset role;
insert into public.profile_favorites(owner_id,favorite_id)
values('24000000-0000-0000-0000-000000000001','24000000-0000-0000-0000-000000000002');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok(
  $$select * from public.set_profile_favorite('24000000-0000-0000-0000-000000000002',false)$$,
  'Free/downgraded member can always remove an existing Favorite'
);
select is((select count(*) from public.profile_favorites where owner_id='24000000-0000-0000-0000-000000000001'),0::bigint,'Favorite removal is persisted');

reset role;
insert into private.luxy_memberships(user_id,tier,status,messaging_enabled,starts_at,expires_at,source)
values('24000000-0000-0000-0000-000000000001','premium','active',true,now()-interval '1 day',now()+interval '30 days','lx14_test');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select ok(
  (select can_message and can_favorite and can_request_private_photo from public.get_my_luxy_membership_snapshot()),
  'Premium enables all profile interaction entitlements'
);
select lives_ok(
  $$select * from public.set_profile_favorite('24000000-0000-0000-0000-000000000002',true)$$,
  'Premium can add Favorite/Interest'
);
select lives_ok(
  $$select * from public.request_private_photo_access('24000000-0000-0000-0000-000000000002')$$,
  'Premium can request Private Photo access'
);
select is((select status from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000002')),'pending','New Private Photo request is pending');
select throws_ok(
  $$select * from public.list_profile_private_media('24000000-0000-0000-0000-000000000002')$$,
  '42501','private_photo_approval_required','Premium alone does not unlock Private Photos without owner approval'
);
select set_config('lx14.request_id',(select request_id::text from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000002')),true);

-- A third party can know a request identifier but still cannot approve somebody else's request.
select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select throws_ok(
  $$select * from public.respond_private_photo_access(current_setting('lx14.request_id')::uuid,'approved')$$,
  '42501','private_photo_request_not_available','Only the Private Photo owner can approve a request'
);

select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select count(*) from public.list_received_private_photo_requests('pending')),1::bigint,'Owner sees the pending request');
select lives_ok(
  $$select * from public.respond_private_photo_access((select request_id from public.list_received_private_photo_requests('pending') limit 1),'approved')$$,
  'Owner can approve Private Photo request'
);

select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select has_access from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000002')),true,'Approved Premium requester gains Private Photo access');
select is((select count(*) from public.list_profile_private_media('24000000-0000-0000-0000-000000000002')),1::bigint,'Approved Premium requester can list Private Photos');

reset role;
select ok(private.can_view_media_internal('24000000-0000-4000-8000-000000000101','24000000-0000-0000-0000-000000000001'),'central media authorization permits approved Premium requester');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select lives_ok(
  $$select public.revoke_private_photo_access((select request_id from public.list_received_private_photo_requests('approved') limit 1))$$,
  'Owner can revoke previously approved Private Photo access'
);

select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select has_access from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000002')),false,'Revocation removes Private Photo access immediately');

reset role;
update private.private_photo_access_requests set status='approved',responded_at=now() where owner_id='24000000-0000-0000-0000-000000000002' and requester_id='24000000-0000-0000-0000-000000000001';
update private.luxy_memberships set status='expired',expires_at=now()-interval '1 second' where user_id='24000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select has_access from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000002')),false,'Approved request is re-gated when Premium expires');
select throws_ok(
  $$select * from public.list_profile_private_media('24000000-0000-0000-0000-000000000002')$$,
  '42501','premium_membership_required','Expired Premium cannot keep viewing approved Private Photos'
);

reset role;
select ok(
  position('gift' in lower(pg_get_functiondef('private.has_approved_private_photo_access(uuid,uuid)'::regprocedure)))=0
  and position('fan' in lower(pg_get_functiondef('private.has_approved_private_photo_access(uuid,uuid)'::regprocedure)))=0,
  'Private Photo approval entitlement contains no gift or Fan unlock path'
);

select * from finish();
rollback;
