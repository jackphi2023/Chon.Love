begin;

select plan(39);

select ok(to_regtype('public.private_photo_access_status') is not null, 'LX-14 private-photo access status enum exists');
select has_table('public', 'private_photo_access_requests', 'private-photo request/grant table exists');
select ok(not has_table_privilege('authenticated', 'public.private_photo_access_requests', 'select'), 'authenticated cannot read grant rows directly');
select ok(not has_table_privilege('authenticated', 'public.private_photo_access_requests', 'insert'), 'authenticated cannot insert grant rows directly');
select ok(has_function_privilege('authenticated', 'public.get_private_photo_access_state(uuid)', 'execute'), 'authenticated can read safe private-photo access state');
select ok(has_function_privilege('authenticated', 'public.request_private_photo_access(uuid)', 'execute'), 'authenticated can request private-photo access');
select ok(has_function_privilege('authenticated', 'public.list_my_private_photo_access_requests(public.private_photo_access_status)', 'execute'), 'authenticated owner can list private-photo requests');
select ok(has_function_privilege('authenticated', 'public.respond_to_private_photo_access_request(uuid,boolean)', 'execute'), 'authenticated owner can respond to private-photo requests');
select ok(has_function_privilege('authenticated', 'public.revoke_private_photo_access(uuid)', 'execute'), 'authenticated owner can revoke private-photo grants');
select ok(not has_function_privilege('anon', 'public.request_private_photo_access(uuid)', 'execute'), 'anonymous cannot request private-photo access');
select ok(not has_function_privilege('authenticated', 'private.has_private_photo_access(uuid,uuid)', 'execute'), 'private grant helper is not client-callable');
select ok(
  position('storage_bucket' in lower(pg_get_function_result('public.get_private_photo_access_state(uuid)'::regprocedure))) = 0
  and position('storage_path' in lower(pg_get_function_result('public.get_private_photo_access_state(uuid)'::regprocedure))) = 0
  and position('media_id' in lower(pg_get_function_result('public.get_private_photo_access_state(uuid)'::regprocedure))) = 0,
  'safe access-state RPC leaks no private storage or media identifiers'
);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
('00000000-0000-0000-0000-000000000000','24000000-0000-0000-0000-000000000001','authenticated','authenticated','lx14-owner@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','24000000-0000-0000-0000-000000000002','authenticated','authenticated','lx14-requester@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','24000000-0000-0000-0000-000000000003','authenticated','authenticated','lx14-outsider@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

update private.user_identity
set date_of_birth = (current_date - interval '30 years')::date,
    age_verified_at = now(),
    age_verification_method = 'self_declared',
    terms_version = (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    terms_accepted_at = now(),
    community_rules_version = (select value_json #>> '{}' from private.app_config where key='community_rules_version_current'),
    community_rules_accepted_at = now(),
    account_status = 'active'
where user_id in (
  '24000000-0000-0000-0000-000000000001'::uuid,
  '24000000-0000-0000-0000-000000000002'::uuid,
  '24000000-0000-0000-0000-000000000003'::uuid
);

update public.profiles
set profile_status='active',
    discovery_enabled=true,
    province_id=(select id from public.administrative_areas where country_code='VN' and code='79'),
    username=case id
      when '24000000-0000-0000-0000-000000000001' then 'lx14_owner'
      when '24000000-0000-0000-0000-000000000002' then 'lx14_requester'
      else 'lx14_outsider' end,
    display_name=case id
      when '24000000-0000-0000-0000-000000000001' then 'LX14 Owner'
      when '24000000-0000-0000-0000-000000000002' then 'LX14 Requester'
      else 'LX14 Outsider' end
where id in (
  '24000000-0000-0000-0000-000000000001'::uuid,
  '24000000-0000-0000-0000-000000000002'::uuid,
  '24000000-0000-0000-0000-000000000003'::uuid
);

insert into private.luxy_memberships(user_id,tier,status,messaging_enabled,starts_at,expires_at,source)
values('24000000-0000-0000-0000-000000000002','premium','active',true,now()-interval '1 day',now()+interval '30 days','lx14_test');

insert into public.media_assets(
  id,owner_id,storage_bucket,storage_path,media_type,mime_type,file_size_bytes,width,height,
  visibility,moderation_status,uploaded_at
) values (
  '24000000-0000-4000-8000-000000000101',
  '24000000-0000-0000-0000-000000000001',
  'profile-media',
  '24000000-0000-0000-0000-000000000001/24000000-0000-4000-8000-000000000101/private.jpg',
  'image','image/jpeg',100,100,100,'private','pending_review',now()
);

insert into public.albums(id,owner_id,name,album_type,fan_threshold_units,is_active)
values(
  '24000000-0000-4000-8000-000000000102',
  '24000000-0000-0000-0000-000000000001',
  'LX14 Private Album','private',0,true
);
insert into public.album_media(album_id,media_id,sort_order)
values(
  '24000000-0000-4000-8000-000000000102',
  '24000000-0000-4000-8000-000000000101',0
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000002","role":"authenticated"}',true);

select is((select private_photo_count from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000001')), 1::bigint, 'safe state exposes only the private-photo count');
select is((select can_view from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000001')), false, 'paid requester still cannot view without owner approval');
select is((select request_status::text from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000001')), null, 'request state starts empty');
select is((select count(*) from public.list_profile_album_media('24000000-0000-0000-0000-000000000001','private')), 0::bigint, 'private media paths are not listed before approval');
select throws_ok(
  $$select public.request_private_photo_access('24000000-0000-0000-0000-000000000002')$$,
  '22023','private_photo_self_request_not_allowed','owner cannot request own private photos'
);
select lives_ok(
  $$select public.request_private_photo_access('24000000-0000-0000-0000-000000000001')$$,
  'requester can submit a private-photo access request'
);
select is((select request_status::text from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000001')), 'pending', 'request becomes pending');
select is((select can_view from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000001')), false, 'pending request grants no view access');

reset role;
update public.private_photo_access_requests
set id='24000000-0000-4000-8000-000000000103'
where owner_id='24000000-0000-0000-0000-000000000001'
  and requester_id='24000000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select throws_ok(
  $$select public.respond_to_private_photo_access_request('24000000-0000-4000-8000-000000000103',true)$$,
  '42501','private_photo_request_not_available','unrelated member cannot approve another owner request'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select count(*) from public.list_my_private_photo_access_requests('pending')), 1::bigint, 'owner sees one pending request');
select lives_ok(
  $$select public.respond_to_private_photo_access_request('24000000-0000-4000-8000-000000000103',false)$$,
  'owner can reject request'
);
select is((select status::text from public.list_my_private_photo_access_requests('rejected') limit 1), 'rejected', 'rejection is persisted');

reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select can_view from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000001')), false, 'rejected request grants no access');
select lives_ok(
  $$select public.request_private_photo_access('24000000-0000-0000-0000-000000000001')$$,
  'rejected requester can ask again'
);
select is((select request_status::text from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000001')), 'pending', 're-request returns to pending');

reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok(
  $$select public.respond_to_private_photo_access_request('24000000-0000-4000-8000-000000000103',true)$$,
  'owner can approve request'
);
select is((select count(*) from public.list_my_private_photo_access_requests('approved')), 1::bigint, 'owner sees approved grant');

reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select can_view from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000001')), true, 'approved requester gains private-photo access');
select is((select count(*) from public.list_profile_album_media('24000000-0000-0000-0000-000000000001','private')), 1::bigint, 'approved requester receives private album media through canonical listing RPC');
select is((select storage_path from public.list_profile_album_media('24000000-0000-0000-0000-000000000001','private') limit 1), '24000000-0000-0000-0000-000000000001/24000000-0000-4000-8000-000000000101/private.jpg', 'private media path appears only after approval');

reset role;
insert into public.user_blocks(blocker_id,blocked_id,reason_code)
values('24000000-0000-0000-0000-000000000001','24000000-0000-0000-0000-000000000002','lx14_test');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select count(*) from public.list_profile_album_media('24000000-0000-0000-0000-000000000001','private')), 0::bigint, 'blocking immediately invalidates an approved private-photo grant');

reset role;
delete from public.user_blocks
where blocker_id='24000000-0000-0000-0000-000000000001' and blocked_id='24000000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select can_view from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000001')), true, 'unblocking restores still-approved grant access');

reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok(
  $$select public.revoke_private_photo_access('24000000-0000-0000-0000-000000000002')$$,
  'owner can revoke an approved grant'
);
select is((select count(*) from public.list_my_private_photo_access_requests('revoked')), 1::bigint, 'revoked grant remains visible to owner as history');

reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select can_view from public.get_private_photo_access_state('24000000-0000-0000-0000-000000000001')), false, 'revocation removes private-photo access');
select is((select count(*) from public.list_profile_album_media('24000000-0000-0000-0000-000000000001','private')), 0::bigint, 'revoked requester no longer receives private media paths');

reset role;
update public.profiles set profile_status='pending_review' where id='24000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"24000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select throws_ok(
  $$select public.request_private_photo_access('24000000-0000-0000-0000-000000000001')$$,
  '42501','active_adult_account_required','pending/non-active requester cannot ask for private photos'
);

select * from finish();
rollback;
