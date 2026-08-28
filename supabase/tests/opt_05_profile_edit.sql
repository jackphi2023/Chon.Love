begin;

select plan(12);

select ok(
  has_function_privilege('authenticated','public.get_my_date_of_birth_v2()','EXECUTE')
  and has_function_privilege('authenticated','public.update_my_date_of_birth_v2(date)','EXECUTE')
  and not has_function_privilege('anon','public.get_my_date_of_birth_v2()','EXECUTE')
  and not has_function_privilege('anon','public.update_my_date_of_birth_v2(date)','EXECUTE'),
  'DOB Profile/Edit RPCs are authenticated owner-only client surfaces'
);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
(
  '00000000-0000-0000-0000-000000000000','35000000-0000-0000-0000-000000000001',
  'authenticated','authenticated','opt05-owner@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000','35000000-0000-0000-0000-000000000002',
  'authenticated','authenticated','opt05-other@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
);

update private.user_identity
set date_of_birth=case user_id
      when '35000000-0000-0000-0000-000000000001' then date '1990-05-20'
      else date '1995-09-15'
    end,
    age_verified_at=now()-interval '30 days',
    age_verification_method='manual_review',
    terms_version=(select value_json#>>'{}' from private.app_config where key='terms_version_current'),
    terms_accepted_at=now(),
    community_rules_version=(select value_json#>>'{}' from private.app_config where key='community_rules_version_current'),
    community_rules_accepted_at=now(),
    account_status='active'
where user_id in (
  '35000000-0000-0000-0000-000000000001',
  '35000000-0000-0000-0000-000000000002'
);

update public.profiles
set username=case id
      when '35000000-0000-0000-0000-000000000001' then 'opt05owner'
      else 'opt05other'
    end::citext,
    public_profile_code=case id
      when '35000000-0000-0000-0000-000000000001' then '350001'
      else '350002'
    end,
    display_name=case id
      when '35000000-0000-0000-0000-000000000001' then 'OPT05 Owner'
      else 'OPT05 Other'
    end,
    gender='female'::public.gender_identity,
    interested_in='everyone'::public.dating_interest,
    province_id=(select min(id) from public.administrative_areas where country_code='VN' and is_active and parent_id is null),
    profile_status='active'::public.profile_status,
    discovery_enabled=true,
    nearby_enabled=false
where id in (
  '35000000-0000-0000-0000-000000000001',
  '35000000-0000-0000-0000-000000000002'
);

insert into private.member_profile_verifications(user_id,listing_status,listing_submitted_at)
values('35000000-0000-0000-0000-000000000001','pending',now()-interval '1 day')
on conflict(user_id) do update
set listing_status=excluded.listing_status, listing_submitted_at=excluded.listing_submitted_at, updated_at=now();

insert into public.moderation_cases(
  id,reported_user_id,source,status,priority,rule_codes,automated_score_json,
  decision,decision_notes,resolved_at
) values(
  '35000000-0000-4000-8000-000000000101',
  '35000000-0000-0000-0000-000000000001',
  'automated_scan','resolved','normal',array['member_photo_verification']::text[],
  '{"provider":"aws_rekognition","faceSimilarity":91.2,"liveness":"passed"}'::jsonb,
  'approve','trusted selfie verification completed before OPT-05',now()-interval '1 day'
);

create temporary table opt05_aws_before on commit drop as
select status,decision,automated_score_json,resolved_at
from public.moderation_cases
where id='35000000-0000-4000-8000-000000000101';

set local role authenticated;
select set_config('request.jwt.claim.sub','35000000-0000-0000-0000-000000000001',true);

select is(
  (select date_of_birth from public.get_my_date_of_birth_v2()),
  date '1990-05-20',
  'Profile/Edit reads the authenticated member DOB from private identity data'
);

select lives_ok(
  $$select * from public.update_my_date_of_birth_v2(date '1990-05-20')$$,
  'saving an unchanged DOB is allowed'
);

reset role;
select is(
  (select age_verification_method::text from private.user_identity where user_id='35000000-0000-0000-0000-000000000001'),
  'manual_review',
  'unchanged DOB preserves the existing stronger age verification method'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','35000000-0000-0000-0000-000000000001',true);

select lives_ok(
  $$select * from public.update_my_date_of_birth_v2(date '1991-06-21')$$,
  'active member can update DOB while remaining 18+'
);

reset role;
select is(
  (select date_of_birth from private.user_identity where user_id='35000000-0000-0000-0000-000000000001'),
  date '1991-06-21',
  'changed DOB persists in the existing private identity row'
);

select is(
  (select age_verification_method::text from private.user_identity where user_id='35000000-0000-0000-0000-000000000001'),
  'self_declared',
  'changed DOB is correctly downgraded to a self-declared age assertion'
);

select ok(
  (select profile_status='active'::public.profile_status and discovery_enabled
   from public.profiles where id='35000000-0000-0000-0000-000000000001'),
  'DOB edit does not change active profile or discovery preference'
);

select is(
  (select listing_status from private.member_profile_verifications where user_id='35000000-0000-0000-0000-000000000001'),
  'pending',
  'DOB edit does not approve, reject or reset listing review'
);

select ok(
  (select
     mc.status is not distinct from before.status
     and mc.decision is not distinct from before.decision
     and mc.automated_score_json is not distinct from before.automated_score_json
     and mc.resolved_at is not distinct from before.resolved_at
   from public.moderation_cases mc
   cross join opt05_aws_before before
   where mc.id='35000000-0000-4000-8000-000000000101'),
  'DOB edit does not rewrite AWS selfie/liveness verification evidence'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','35000000-0000-0000-0000-000000000001',true);
select throws_ok(
  $$select * from public.update_my_date_of_birth_v2((current_date - interval '17 years')::date)$$,
  '22023',
  'user must be at least 18 years old',
  'DOB edit cannot cross below the 18+ age gate'
);

select set_config('request.jwt.claim.sub','35000000-0000-0000-0000-000000000002',true);
select is(
  (select date_of_birth from public.get_my_date_of_birth_v2()),
  date '1995-09-15',
  'DOB read model never exposes another member identity row'
);

reset role;
select * from finish();
rollback;
