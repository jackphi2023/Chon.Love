begin;

select plan(6);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
  ('00000000-0000-0000-0000-000000000000','44000000-0000-4000-8000-000000000001','authenticated','authenticated','session-d-moderator@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
  ('00000000-0000-0000-0000-000000000000','44000000-0000-4000-8000-000000000002','authenticated','authenticated','session-d-oldest@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
  ('00000000-0000-0000-0000-000000000000','44000000-0000-4000-8000-000000000003','authenticated','authenticated','session-d-middle@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
  ('00000000-0000-0000-0000-000000000000','44000000-0000-4000-8000-000000000004','authenticated','authenticated','session-d-newest@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

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
  '44000000-0000-4000-8000-000000000001',
  '44000000-0000-4000-8000-000000000002',
  '44000000-0000-4000-8000-000000000003',
  '44000000-0000-4000-8000-000000000004'
);

update public.profiles
set profile_status='pending_review'::public.profile_status,
    discovery_enabled=false,
    nearby_enabled=false,
    province_id=(select min(id) from public.administrative_areas where country_code='VN' and is_active and parent_id is null),
    username=case id
      when '44000000-0000-4000-8000-000000000001' then 'sessiondmoderator'
      when '44000000-0000-4000-8000-000000000002' then 'sessiondoldest'
      when '44000000-0000-4000-8000-000000000003' then 'sessiondmiddle'
      else 'sessiondnewest'
    end::citext,
    display_name=case id
      when '44000000-0000-4000-8000-000000000001' then 'Session D Moderator'
      when '44000000-0000-4000-8000-000000000002' then 'Session D Oldest'
      when '44000000-0000-4000-8000-000000000003' then 'Session D Middle'
      else 'Session D Newest'
    end,
    gender='female'::public.gender_identity
where id in (
  '44000000-0000-4000-8000-000000000001',
  '44000000-0000-4000-8000-000000000002',
  '44000000-0000-4000-8000-000000000003',
  '44000000-0000-4000-8000-000000000004'
);

insert into private.user_roles(user_id,role,granted_by)
values('44000000-0000-4000-8000-000000000001','moderator','44000000-0000-4000-8000-000000000001');

insert into public.moderation_cases(
  id,reported_user_id,source,status,priority,rule_codes,automated_score_json,created_at
) values
  ('44000000-0000-4000-8000-000000000101','44000000-0000-4000-8000-000000000002','automated_scan','queued','high',array['member_photo_verification']::text[],'{"maxSimilarity":41.0}'::jsonb,timestamptz '2026-09-07 08:00:00+00'),
  ('44000000-0000-4000-8000-000000000102','44000000-0000-4000-8000-000000000003','automated_scan','queued','high',array['member_photo_verification']::text[],'{"maxSimilarity":42.0}'::jsonb,timestamptz '2026-09-07 09:00:00+00'),
  ('44000000-0000-4000-8000-000000000103','44000000-0000-4000-8000-000000000004','automated_scan','queued','high',array['member_photo_verification']::text[],'{"maxSimilarity":43.0}'::jsonb,timestamptz '2026-09-07 10:00:00+00');

set local role service_role;

select is(
  (select case_id from public.admin_list_member_photo_verifications('44000000-0000-4000-8000-000000000001',2,0) limit 1),
  '44000000-0000-4000-8000-000000000103'::uuid,
  'photo verification queue returns newest case first'
);

select is(
  (select array_agg(case_id order by created_at desc) from public.admin_list_member_photo_verifications('44000000-0000-4000-8000-000000000001',2,0)),
  array['44000000-0000-4000-8000-000000000103'::uuid,'44000000-0000-4000-8000-000000000102'::uuid],
  'first page contains the two newest cases in descending time order'
);

select is(
  (select count(*) from public.admin_list_member_photo_verifications('44000000-0000-4000-8000-000000000001',2,0)),
  2::bigint,
  'first page respects the requested bounded page size'
);

select is(
  (select case_id from public.admin_list_member_photo_verifications('44000000-0000-4000-8000-000000000001',2,2) limit 1),
  '44000000-0000-4000-8000-000000000101'::uuid,
  'second page returns the remaining oldest case'
);

select is(
  (select count(*) from public.admin_list_member_photo_verifications('44000000-0000-4000-8000-000000000001',2,2)),
  1::bigint,
  'second page contains no duplicate from page one'
);

select ok(
  not exists(
    select 1
    from public.admin_list_member_photo_verifications('44000000-0000-4000-8000-000000000001',2,0) first_page
    join public.admin_list_member_photo_verifications('44000000-0000-4000-8000-000000000001',2,2) second_page
      using(case_id)
  ),
  'adjacent photo verification pages are disjoint'
);

reset role;
select * from finish();
rollback;