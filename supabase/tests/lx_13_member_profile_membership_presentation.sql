begin;

select plan(22);

select ok(to_regtype('public.luxy_membership_tier') is not null, 'Luxy membership tier enum exists');
select has_table('private', 'luxy_memberships', 'server-controlled membership snapshot table exists');
select has_table('private', 'luxy_upgrade_intents', 'upgrade intent table exists');
select ok(not has_table_privilege('authenticated', 'private.luxy_memberships', 'select'), 'authenticated cannot read private membership rows directly');
select ok(not has_table_privilege('authenticated', 'private.luxy_upgrade_intents', 'select'), 'authenticated cannot read private upgrade intents directly');
select ok(has_function_privilege('authenticated', 'public.get_my_luxy_membership_snapshot()', 'execute'), 'authenticated can read own membership snapshot');
select ok(not has_function_privilege('anon', 'public.get_my_luxy_membership_snapshot()', 'execute'), 'anonymous cannot read membership snapshot');
select ok(has_function_privilege('authenticated', 'public.create_luxy_upgrade_intent(public.luxy_membership_tier,text)', 'execute'), 'authenticated can create upgrade intent');
select ok(not has_function_privilege('anon', 'public.create_luxy_upgrade_intent(public.luxy_membership_tier,text)', 'execute'), 'anonymous cannot create upgrade intent');
select ok(has_function_privilege('authenticated', 'public.get_luxy_member_profile(text)', 'execute'), 'authenticated can read safe Member Profile');
select ok(not has_function_privilege('anon', 'public.get_luxy_member_profile(text)', 'execute'), 'anonymous cannot read Member Profile');
select ok(
  position('date_of_birth' in lower(pg_get_function_result('public.get_luxy_member_profile(text)'::regprocedure))) = 0
  and position('latitude' in lower(pg_get_function_result('public.get_luxy_member_profile(text)'::regprocedure))) = 0
  and position('longitude' in lower(pg_get_function_result('public.get_luxy_member_profile(text)'::regprocedure))) = 0,
  'Member Profile signature exposes no DOB or exact coordinates'
);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
('00000000-0000-0000-0000-000000000000','23000000-0000-0000-0000-000000000001','authenticated','authenticated','lx13-viewer@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','23000000-0000-0000-0000-000000000002','authenticated','authenticated','lx13-target@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

update private.user_identity
set date_of_birth = case user_id
      when '23000000-0000-0000-0000-000000000001' then (current_date - interval '34 years')::date
      else (current_date - interval '31 years')::date
    end,
    age_verified_at = now(),
    age_verification_method = 'self_declared',
    terms_version = (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    terms_accepted_at = now(),
    community_rules_version = (select value_json #>> '{}' from private.app_config where key='community_rules_version_current'),
    community_rules_accepted_at = now(),
    account_status = 'active'
where user_id in (
  '23000000-0000-0000-0000-000000000001'::uuid,
  '23000000-0000-0000-0000-000000000002'::uuid
);

update public.profiles
set profile_status='active',
    discovery_enabled=true,
    province_id=(select id from public.administrative_areas where country_code='VN' and code='79'),
    username=case id
      when '23000000-0000-0000-0000-000000000001' then 'lx13_viewer'
      else 'lx13_target' end,
    display_name=case id
      when '23000000-0000-0000-0000-000000000001' then 'LX13 Viewer'
      else 'LX13 Target' end,
    gender='male'::public.gender_identity,
    interested_in='female'::public.dating_interest,
    headline='Kết nối có chủ đích',
    bio='Hồ sơ an toàn cho LX-13',
    height_cm=178,
    weight_kg=74,
    relationship_status='single'::public.relationship_status,
    children_status='no_children'::public.children_status,
    smoking_status='never'::public.smoking_status,
    drinking_status='socially'::public.drinking_status,
    education_level='bachelors'::public.education_level,
    occupation='Founder',
    looking_for='Một kết nối chất lượng.',
    lifestyle_tags=array['fine_dining','ready_to_travel']::public.profile_lifestyle_tag[],
    languages=array['Tiếng Việt','English']::text[],
    interests=array['Du lịch']::text[],
    last_active_at=now()
where id in (
  '23000000-0000-0000-0000-000000000001'::uuid,
  '23000000-0000-0000-0000-000000000002'::uuid
);

insert into private.luxy_memberships(user_id,tier,status,messaging_enabled,starts_at,expires_at,source)
values('23000000-0000-0000-0000-000000000002','diamond','active',true,now()-interval '1 day',now()+interval '30 days','lx13_test');

insert into public.media_assets(
  id,owner_id,storage_bucket,storage_path,media_type,mime_type,file_size_bytes,width,height,
  visibility,moderation_status,uploaded_at
) values
('23000000-0000-4000-8000-000000000101','23000000-0000-0000-0000-000000000002','profile-media','23000000-0000-0000-0000-000000000002/23000000-0000-4000-8000-000000000101/lx13-public.png','image','image/png',100,100,100,'public','pending_review',now()),
('23000000-0000-4000-8000-000000000102','23000000-0000-0000-0000-000000000002','profile-media','23000000-0000-0000-0000-000000000002/23000000-0000-4000-8000-000000000102/lx13-private.png','image','image/png',100,100,100,'private','pending_review',now());

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"23000000-0000-0000-0000-000000000001","role":"authenticated"}',true);

select is((select tier::text from public.get_my_luxy_membership_snapshot()), 'free', 'viewer starts as Free');
select is((select can_message from public.get_my_luxy_membership_snapshot()), false, 'Free viewer cannot message through membership presentation snapshot');
select lives_ok($$select public.create_luxy_upgrade_intent('premium','member_profile_message')$$, 'Free viewer can create a Premium upgrade handoff');
select throws_ok($$select public.create_luxy_upgrade_intent('free','member_profile_message')$$, '22023', 'paid_membership_tier_required', 'Free cannot be used as an upgrade target');
select is((select membership_tier::text from public.get_luxy_member_profile('lx13_target')), 'diamond', 'Member Profile exposes server-controlled Diamond tier');
select is((select membership_badge_visible from public.get_luxy_member_profile('lx13_target')), true, 'paid target exposes a prominent membership badge signal');
select is((select age::integer from public.get_luxy_member_profile('lx13_target')), 31, 'Member Profile derives age without exposing DOB');
select is((select public_photo_count from public.get_luxy_member_profile('lx13_target')), 1, 'Member Profile exposes safe public-photo count');
select is((select private_photo_count from public.get_luxy_member_profile('lx13_target')), 1, 'Member Profile exposes only private-photo count, not private image data');

reset role;
select is((select count(*) from private.luxy_upgrade_intents where user_id='23000000-0000-0000-0000-000000000001'), 1::bigint, 'upgrade handoff records one server-side intent');

insert into private.luxy_memberships(user_id,tier,status,messaging_enabled,starts_at,expires_at,source)
values('23000000-0000-0000-0000-000000000001','premium','active',true,now()-interval '1 day',now()+interval '30 days','lx13_test');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"23000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select ok(
  (select tier='premium'::public.luxy_membership_tier and can_message from public.get_my_luxy_membership_snapshot()),
  'active Premium membership enables the presentation messaging entitlement'
);

select * from finish();
rollback;
