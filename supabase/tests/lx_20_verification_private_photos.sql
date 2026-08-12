begin;

select plan(25);

select ok(has_function_privilege('authenticated','public.set_my_profile_photo_visibility(uuid,text)','execute'),'Owner can call profile photo Public/Private toggle RPC');
select ok(has_function_privilege('authenticated','public.get_private_photo_access_state(uuid)','execute'),'Authenticated viewer can read safe private-photo gate state');
select ok(has_function_privilege('authenticated','public.list_profile_private_media(uuid)','execute'),'Authenticated viewer can call server-gated private-photo listing');
select ok(has_function_privilege('authenticated','public.get_my_member_verification_status()','execute'),'Member can read own verification status');
select ok(has_function_privilege('authenticated','public.prepare_member_identity_document(text,text,bigint,text)','execute'),'Member may prepare private CCCD upload');
select ok(not has_table_privilege('authenticated','private.member_identity_documents','select'),'Client cannot read raw CCCD metadata table');
select ok(not has_table_privilege('authenticated','private.member_profile_verifications','select'),'Client cannot read private verification table directly');
select ok(has_function_privilege('service_role','public.admin_review_member_profile_verification(uuid,uuid,text,text,text,uuid)','execute'),'Only trusted service surface exposes verification review RPC');

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
  confirmation_token,recovery_token,email_change_token_new,email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
('00000000-0000-0000-0000-000000000000','30000000-0000-0000-0000-000000000001','authenticated','authenticated','lx20-free@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','30000000-0000-0000-0000-000000000002','authenticated','authenticated','lx20-premium@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','30000000-0000-0000-0000-000000000003','authenticated','authenticated','lx20-owner@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

update private.user_identity set
  date_of_birth=(current_date-interval '34 years')::date,
  age_verified_at=now(),age_verification_method='self_declared',
  terms_version=(select value_json#>>'{}' from private.app_config where key='terms_version_current'),terms_accepted_at=now(),
  community_rules_version=(select value_json#>>'{}' from private.app_config where key='community_rules_version_current'),community_rules_accepted_at=now(),
  account_status='active'
where user_id::text like '30000000-0000-0000-0000-00000000000%';

update public.profiles set
  profile_status='active',discovery_enabled=true,
  province_id=(select id from public.administrative_areas where country_code='VN' and code='79'),
  username=case id
    when '30000000-0000-0000-0000-000000000001' then 'lx20_free'
    when '30000000-0000-0000-0000-000000000002' then 'lx20_premium'
    else 'lx20_owner' end,
  display_name=case id
    when '30000000-0000-0000-0000-000000000001' then 'LX20 Free'
    when '30000000-0000-0000-0000-000000000002' then 'LX20 Premium'
    else 'LX20 Owner' end,
  gender='female'::public.gender_identity,interested_in='everyone'::public.dating_interest,last_active_at=now()
where id::text like '30000000-0000-0000-0000-00000000000%';

insert into private.luxy_memberships(user_id,tier,status,messaging_enabled,starts_at,expires_at,source)
values('30000000-0000-0000-0000-000000000002','premium','active',true,now()-interval '1 minute',now()+interval '30 days','lx20_test');

-- Keep these fixtures in the pending-media location. LX-20 explicitly treats pending-review
-- profile photos as owner/viewer-visible while moderation completes, matching the live upload flow.
insert into public.media_assets(
  id,owner_id,storage_bucket,storage_path,mime_type,file_size_bytes,width,height,visibility,moderation_status,uploaded_at
) values
('30000000-0000-4000-8000-000000000101','30000000-0000-0000-0000-000000000003','pending-media','30000000-0000-0000-0000-000000000003/30000000-0000-4000-8000-000000000101/original.jpg','image/jpeg',1024,900,1200,'public','pending_review',now()),
('30000000-0000-4000-8000-000000000102','30000000-0000-0000-0000-000000000003','pending-media','30000000-0000-0000-0000-000000000003/30000000-0000-4000-8000-000000000102/original.jpg','image/jpeg',1024,900,1200,'private','pending_review',now());

insert into public.albums(id,owner_id,name,album_type,fan_threshold_units)
values('30000000-0000-4000-8000-000000000110','30000000-0000-0000-0000-000000000003','Ảnh công khai','public',0);
insert into public.album_media(album_id,media_id,sort_order)
values('30000000-0000-4000-8000-000000000110','30000000-0000-4000-8000-000000000101',0);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select has_access from public.get_private_photo_access_state('30000000-0000-0000-0000-000000000003')),false,'Free viewer does not receive private-photo access');
select is((select can_request from public.get_private_photo_access_state('30000000-0000-0000-0000-000000000003')),false,'Free private-photo gate no longer creates owner approval requests');
select is((select private_photo_count from public.get_private_photo_access_state('30000000-0000-0000-0000-000000000003')),1,'Free viewer receives only safe private-photo count');
select throws_ok(
  $$select * from public.list_profile_private_media('30000000-0000-0000-0000-000000000003')$$,
  '42501','premium_membership_required','Free viewer cannot list private storage paths'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select has_access from public.get_private_photo_access_state('30000000-0000-0000-0000-000000000003')),true,'Premium viewer automatically receives private-photo entitlement');
select is((select count(*) from public.list_profile_private_media('30000000-0000-0000-0000-000000000003')),1::bigint,'Premium viewer receives every eligible private photo without owner approval');
select is((select can_request from public.get_private_photo_access_state('30000000-0000-0000-0000-000000000003')),false,'Paid access is a membership entitlement, not an approval request');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((select visibility from public.set_my_profile_photo_visibility('30000000-0000-4000-8000-000000000101','private')),'private','Owner can hide a public profile photo');
select is((select visibility::text from public.media_assets where id='30000000-0000-4000-8000-000000000101'),'private','Hidden photo is persisted as private media');
select is((select count(*) from public.album_media where media_id='30000000-0000-4000-8000-000000000101'),0::bigint,'Hiding removes the photo from public album membership');
select is((select visibility from public.set_my_profile_photo_visibility('30000000-0000-4000-8000-000000000101','public')),'public','Owner can make a private photo public again');
select is((select count(*) from public.album_media where media_id='30000000-0000-4000-8000-000000000101'),1::bigint,'Making public reattaches photo to public album');
select is(public.submit_my_linkedin_verification('https://www.linkedin.com/in/lx20-owner'),'pending','Valid LinkedIn URL enters pending verification');
select throws_ok(
  $$select public.submit_my_linkedin_verification('https://evil.example/in/lx20-owner')$$,
  '22023','invalid_linkedin_profile_url','Non-LinkedIn URL is rejected'
);
reset role;

insert into private.member_identity_documents(id,user_id,document_side,mime_type,file_size_bytes,storage_path,status,submitted_at)
values
('30000000-0000-4000-8000-000000000201','30000000-0000-0000-0000-000000000003','front','image/jpeg',1000,'30000000-0000-0000-0000-000000000003/30000000-0000-4000-8000-000000000201/front.jpg','submitted',now()),
('30000000-0000-4000-8000-000000000202','30000000-0000-0000-0000-000000000003','back','image/jpeg',1000,'30000000-0000-0000-0000-000000000003/30000000-0000-4000-8000-000000000202/back.jpg','submitted',now());

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is(public.submit_my_member_identity_verification(),'pending','CCCD front/back moves identity verification to pending');
select is((select identity_status from public.get_my_member_verification_status()),'pending','Caller-owned verification status exposes pending CCCD without raw document data');
reset role;

update private.member_profile_verifications set identity_status='approved',linkedin_status='approved' where user_id='30000000-0000-0000-0000-000000000003';
insert into public.moderation_cases(reported_user_id,source,status,priority,rule_codes,automated_score_json,decision,resolved_at)
values('30000000-0000-0000-0000-000000000003','automated_scan','resolved','normal',array['member_photo_verification'],jsonb_build_object('maxSimilarity',87.3),'approve',now());

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select ok((select selfie_verified and identity_verified and linkedin_verified from public.get_luxy_member_verification_badges('30000000-0000-0000-0000-000000000003')),'Public profile badge contract exposes only approved booleans');
reset role;

select * from finish();
rollback;
