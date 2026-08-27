begin;

select plan(12);

select ok(
  has_function_privilege(
    'service_role',
    'public.admin_list_member_listing_verifications(uuid,integer,integer)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.admin_list_member_listing_verifications(uuid,integer,integer)',
    'EXECUTE'
  ),
  'Admin listing queue remains service-role only'
);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
(
  '00000000-0000-0000-0000-000000000000','33000000-0000-0000-0000-000000000001',
  'authenticated','authenticated','opt03-moderator@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000','33000000-0000-0000-0000-000000000002',
  'authenticated','authenticated','opt03-free-old@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now()-interval '3 days',now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000','33000000-0000-0000-0000-000000000003',
  'authenticated','authenticated','opt03-free-new@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now()-interval '1 hour',now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000','33000000-0000-0000-0000-000000000004',
  'authenticated','authenticated','opt03-paid@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now()-interval '10 minutes',now(),'','','','','','',''
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
  '33000000-0000-0000-0000-000000000001',
  '33000000-0000-0000-0000-000000000002',
  '33000000-0000-0000-0000-000000000003',
  '33000000-0000-0000-0000-000000000004'
);

update public.profiles
set username=case id
      when '33000000-0000-0000-0000-000000000001' then 'opt03moderator'
      when '33000000-0000-0000-0000-000000000002' then 'opt03freeold'
      when '33000000-0000-0000-0000-000000000003' then 'opt03freenew'
      else 'opt03paid'
    end::citext,
    public_profile_code=case id
      when '33000000-0000-0000-0000-000000000001' then '330001'
      when '33000000-0000-0000-0000-000000000002' then '330002'
      when '33000000-0000-0000-0000-000000000003' then '330003'
      else '330004'
    end,
    display_name=case id
      when '33000000-0000-0000-0000-000000000001' then 'OPT03 Moderator'
      when '33000000-0000-0000-0000-000000000002' then 'OPT03 Free Old'
      when '33000000-0000-0000-0000-000000000003' then 'OPT03 Free New'
      else 'OPT03 Paid'
    end,
    profile_status='active'::public.profile_status,
    discovery_enabled=true,
    nearby_enabled=false,
    province_id=(select min(id) from public.administrative_areas where country_code='VN' and is_active and parent_id is null)
where id in (
  '33000000-0000-0000-0000-000000000001',
  '33000000-0000-0000-0000-000000000002',
  '33000000-0000-0000-0000-000000000003',
  '33000000-0000-0000-0000-000000000004'
);

insert into private.user_roles(user_id,role)
values('33000000-0000-0000-0000-000000000001','moderator')
on conflict do nothing;

insert into private.member_profile_verifications(user_id,listing_status,listing_submitted_at)
values
  ('33000000-0000-0000-0000-000000000002','pending',now()-interval '2 days'),
  ('33000000-0000-0000-0000-000000000003','pending',now()-interval '30 minutes'),
  ('33000000-0000-0000-0000-000000000004','pending',now()-interval '5 minutes')
on conflict(user_id) do update
set listing_status=excluded.listing_status,
    listing_submitted_at=excluded.listing_submitted_at,
    listing_reviewed_at=null,
    listing_reviewed_by=null,
    listing_reason_code=null,
    updated_at=now();

insert into private.luxy_memberships(user_id,tier,status,messaging_enabled,starts_at,expires_at,source)
values(
  '33000000-0000-0000-0000-000000000004','premium','active',true,
  now()-interval '1 day',now()+interval '30 days','opt03_test'
)
on conflict(user_id) do update
set tier='premium',status='active',starts_at=excluded.starts_at,expires_at=excluded.expires_at,updated_at=now();

-- Model the already-completed trusted selfie/AWS outcome as an immutable upstream fact.
-- OPT-03 listing review must not rewrite or reinterpret it.
insert into public.moderation_cases(
  id,reported_user_id,source,status,priority,rule_codes,automated_score_json,
  decision,decision_notes,resolved_at
) values(
  '33000000-0000-4000-8000-000000000101',
  '33000000-0000-0000-0000-000000000003',
  'automated_scan','resolved','normal',array['member_photo_verification']::text[],
  '{"provider":"aws_rekognition","faceSimilarity":88.5,"liveness":"passed"}'::jsonb,
  'approve','trusted selfie verification completed before OPT-03',now()-interval '45 minutes'
);

create temporary table opt03_aws_before on commit drop as
select status,decision,automated_score_json,resolved_at
from public.moderation_cases
where id='33000000-0000-4000-8000-000000000101';

grant select on opt03_aws_before to service_role;

set local role service_role;

select is(
  (select count(*) from public.admin_list_member_listing_verifications(
    '33000000-0000-0000-0000-000000000001',100,0
  )),
  2::bigint,
  'manual review queue contains only active Free pending members'
);

select is(
  (select user_id from public.admin_list_member_listing_verifications(
    '33000000-0000-0000-0000-000000000001',100,0
  ) limit 1),
  '33000000-0000-0000-0000-000000000003'::uuid,
  'newest pending Free member is first in the Admin queue'
);

select is(
  (select count(*) from public.admin_list_member_listing_verifications(
    '33000000-0000-0000-0000-000000000001',100,0
  ) where user_id='33000000-0000-0000-0000-000000000004'),
  0::bigint,
  'Premium auto-override member never creates unnecessary Admin review work'
);

select ok(
  (select bool_and(not is_paid_override and not effective_discoverable)
   from public.admin_list_member_listing_verifications(
     '33000000-0000-0000-0000-000000000001',100,0
   )),
  'manual queue rows are Free and remain hidden from Connect before approval'
);

select lives_ok(
  $$select * from public.admin_review_member_listing_verification(
    '33000000-0000-0000-0000-000000000001',
    '33000000-0000-0000-0000-000000000003',
    'approve','admin_approved','33000000-0000-4000-8000-000000000102'
  )$$,
  'Admin approves listing through the OPT-01 canonical review RPC'
);

select is(
  (select listing_status from private.member_profile_verifications
   where user_id='33000000-0000-0000-0000-000000000003'),
  'approved',
  'Admin listing approval persists in the canonical verification record'
);

select ok(
  (select profile_status='active'::public.profile_status and discovery_enabled
   from public.profiles where id='33000000-0000-0000-0000-000000000003'),
  'listing review does not alter the active account/profile or member discovery preference'
);

select is(
  (select count(*) from public.admin_list_member_listing_verifications(
    '33000000-0000-0000-0000-000000000001',100,0
  )),
  1::bigint,
  'approved member leaves the manual review queue immediately'
);

select is(
  (select status::text from public.moderation_cases
   where id='33000000-0000-4000-8000-000000000101'),
  (select status::text from opt03_aws_before),
  'Admin listing review does not change trusted selfie/AWS case status'
);

select is(
  (select decision::text from public.moderation_cases
   where id='33000000-0000-4000-8000-000000000101'),
  (select decision::text from opt03_aws_before),
  'Admin listing review does not change trusted selfie/AWS decision'
);

select is(
  (select automated_score_json from public.moderation_cases
   where id='33000000-0000-4000-8000-000000000101'),
  (select automated_score_json from opt03_aws_before),
  'Admin listing review does not change AWS similarity/liveness evidence'
);

select is(
  (select resolved_at from public.moderation_cases
   where id='33000000-0000-4000-8000-000000000101'),
  (select resolved_at from opt03_aws_before),
  'Admin listing review does not rewrite AWS verification timing'
);

reset role;
select * from finish();
rollback;
