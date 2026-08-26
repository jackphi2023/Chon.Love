begin;

select plan(6);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
('00000000-0000-0000-0000-000000000000','26000000-0000-0000-0000-000000000001','authenticated','authenticated','connect-eligibility-viewer@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','26000000-0000-0000-0000-000000000002','authenticated','authenticated','connect-eligibility-candidate@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

update private.user_identity
set date_of_birth = case
      when user_id='26000000-0000-0000-0000-000000000001' then (current_date-interval '35 years')::date
      else (current_date-interval '30 years')::date
    end,
    age_verified_at=now(),
    age_verification_method='self_declared',
    terms_version='terms-2026-07-30-v1',
    terms_accepted_at=now(),
    community_rules_version='community-2026-07-30-v1',
    community_rules_accepted_at=now(),
    account_status='active'
where user_id in (
  '26000000-0000-0000-0000-000000000001',
  '26000000-0000-0000-0000-000000000002'
);

update public.profiles
set profile_status='active',
    discovery_enabled=true,
    username=case id
      when '26000000-0000-0000-0000-000000000001' then 'connect_eligibility_viewer'
      else 'connect_eligibility_candidate'
    end,
    display_name=case id
      when '26000000-0000-0000-0000-000000000001' then 'Eligibility Viewer'
      else 'Eligibility Candidate'
    end,
    gender=case id
      when '26000000-0000-0000-0000-000000000001' then 'male'::public.gender_identity
      else 'female'::public.gender_identity
    end,
    interested_in=case id
      when '26000000-0000-0000-0000-000000000001' then 'female'::public.dating_interest
      else 'male'::public.dating_interest
    end
where id in (
  '26000000-0000-0000-0000-000000000001',
  '26000000-0000-0000-0000-000000000002'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"26000000-0000-0000-0000-000000000001","role":"authenticated"}',true);

select is(
  (select count(*) from public.search_luxy_profiles_v2() where id='26000000-0000-0000-0000-000000000002'),
  1::bigint,
  'active approved discoverable member is listed in Connect'
);

reset role;
update public.profiles set discovery_enabled=false where id='26000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"26000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is(
  (select count(*) from public.search_luxy_profiles_v2() where id='26000000-0000-0000-0000-000000000002'),
  0::bigint,
  'admin-hidden member is excluded from Connect'
);

reset role;
update public.profiles set discovery_enabled=true where id='26000000-0000-0000-0000-000000000002';
update private.user_identity set account_status='suspended' where user_id='26000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"26000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is(
  (select count(*) from public.search_luxy_profiles_v2() where id='26000000-0000-0000-0000-000000000002'),
  0::bigint,
  'admin-suspended member is excluded from Connect even if profile flags drift active'
);

reset role;
update private.user_identity set account_status='active' where user_id='26000000-0000-0000-0000-000000000002';
update auth.users set banned_until=now()+interval '1 day' where id='26000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"26000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is(
  (select count(*) from public.search_luxy_profiles_v2() where id='26000000-0000-0000-0000-000000000002'),
  0::bigint,
  'Auth-banned member is excluded from Connect even if profile and identity flags drift active'
);

reset role;
update auth.users set banned_until=null where id='26000000-0000-0000-0000-000000000002';
insert into public.moderation_cases(
  id, source, reported_user_id, status, priority, rule_codes, reason_code
) values (
  '26000000-0000-0000-0000-000000000099',
  'automated_scan',
  '26000000-0000-0000-0000-000000000002',
  'open',
  60,
  array['member_photo_verification']::text[],
  'signup_selfie_manual_review'
);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"26000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is(
  (select count(*) from public.search_luxy_profiles_v2() where id='26000000-0000-0000-0000-000000000002'),
  0::bigint,
  'AWS/member-photo pending-review member is excluded from Connect even if profile flags drift active'
);

reset role;
update public.moderation_cases
set status='resolved', decision='approve', resolved_at=now()
where id='26000000-0000-0000-0000-000000000099';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"26000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is(
  (select count(*) from public.search_luxy_profiles_v2() where id='26000000-0000-0000-0000-000000000002'),
  1::bigint,
  'resolved approved verification restores Connect eligibility when all other states are active'
);

select * from finish();
rollback;
