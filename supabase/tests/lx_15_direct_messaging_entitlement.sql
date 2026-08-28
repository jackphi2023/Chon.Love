begin;

-- OPT-15 final candidate fan-out marker: #FFBB00 test-contract alignment; no database contract behavior changes.
select plan(24);

select has_column('public','conversations','direct_member_low_id','LX-15 stores canonical lower direct participant');
select has_column('public','conversations','direct_member_high_id','LX-15 stores canonical higher direct participant');
select col_is_null('public','conversations','friendship_id','Legacy friendship pointer is optional after LX-15');
select ok(has_function_privilege('authenticated','public.get_luxy_profile_conversation(uuid)','execute'),'Authenticated member can call paid-gated profile conversation RPC');
select ok(has_function_privilege('authenticated','public.get_direct_conversation(uuid)','execute'),'Authenticated participant can look up an existing direct conversation');
select ok(not has_function_privilege('anon','public.get_luxy_profile_conversation(uuid)','execute'),'Anonymous cannot create direct conversations');

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
('00000000-0000-0000-0000-000000000000','25000000-0000-0000-0000-000000000001','authenticated','authenticated','lx15-premium@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','25000000-0000-0000-0000-000000000002','authenticated','authenticated','lx15-free@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','25000000-0000-0000-0000-000000000003','authenticated','authenticated','lx15-legacy@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

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
  '25000000-0000-0000-0000-000000000001'::uuid,
  '25000000-0000-0000-0000-000000000002'::uuid,
  '25000000-0000-0000-0000-000000000003'::uuid
);

update public.profiles
set profile_status='active',discovery_enabled=true,
    province_id=(select id from public.administrative_areas where country_code='VN' and code='79'),
    username=case id
      when '25000000-0000-0000-0000-000000000001' then 'lx15_premium'
      when '25000000-0000-0000-0000-000000000002' then 'lx15_free'
      else 'lx15_legacy' end,
    display_name=case id
      when '25000000-0000-0000-0000-000000000001' then 'LX15 Premium'
      when '25000000-0000-0000-0000-000000000002' then 'LX15 Free'
      else 'LX15 Legacy' end,
    gender='male'::public.gender_identity,
    interested_in='female'::public.dating_interest
where id in (
  '25000000-0000-0000-0000-000000000001'::uuid,
  '25000000-0000-0000-0000-000000000002'::uuid,
  '25000000-0000-0000-0000-000000000003'::uuid
);

insert into private.luxy_memberships(user_id,tier,status,messaging_enabled,starts_at,expires_at,source)
values
('25000000-0000-0000-0000-000000000001','premium','active',true,now()-interval '1 day',now()+interval '30 days','lx15_test'),
('25000000-0000-0000-0000-000000000003','diamond','active',true,now()-interval '1 day',now()+interval '30 days','lx15_test');

-- Premium starts a direct conversation with a Free recipient without creating friendship.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"25000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select set_config('lx15.direct_id',public.get_luxy_profile_conversation('25000000-0000-0000-0000-000000000002')::text,true);
select ok(current_setting('lx15.direct_id')::uuid is not null,'Premium creates a direct conversation without friendship');
reset role;

select is(
  (select count(*) from public.friendships where pair_low_id='25000000-0000-0000-0000-000000000001' and pair_high_id='25000000-0000-0000-0000-000000000002'),
  0::bigint,
  'Starting direct messaging does not create a friendship row'
);
select is(
  (select friendship_id from public.conversations where id=current_setting('lx15.direct_id')::uuid),
  null::uuid,
  'New Seeking-style direct conversation has no friendship pointer'
);
select is(
  (select count(*) from public.conversation_members where conversation_id=current_setting('lx15.direct_id')::uuid),
  2::bigint,
  'Both sender and recipient are conversation members'
);
select is(
  (select direct_member_low_id from public.conversations where id=current_setting('lx15.direct_id')::uuid),
  '25000000-0000-0000-0000-000000000001'::uuid,
  'Canonical lower participant is persisted'
);
select is(
  (select direct_member_high_id from public.conversations where id=current_setting('lx15.direct_id')::uuid),
  '25000000-0000-0000-0000-000000000002'::uuid,
  'Canonical higher participant is persisted'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"25000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is(
  public.get_luxy_profile_conversation('25000000-0000-0000-0000-000000000002'),
  current_setting('lx15.direct_id')::uuid,
  'Repeated profile CTA is idempotent and returns the same direct conversation'
);
select lives_ok(
  $$select public.send_message(
      current_setting('lx15.direct_id')::uuid,
      'Premium can message without friendship',
      '25000000-0000-4000-8000-000000000101'
    )$$,
  'Premium can send text without accepted friendship'
);
select is(
  (select friendship_status from public.get_conversation_detail(current_setting('lx15.direct_id')::uuid)),
  'direct',
  'Conversation detail exposes direct context rather than faking friendship'
);
select is(
  (select can_send from public.get_conversation_detail(current_setting('lx15.direct_id')::uuid)),
  true,
  'Premium sender can_send is true'
);
reset role;

-- Free recipient can receive/read the conversation but cannot create or send text.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"25000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is(
  public.get_direct_conversation('25000000-0000-0000-0000-000000000001'),
  current_setting('lx15.direct_id')::uuid,
  'Free recipient can discover the existing conversation addressed to them'
);
select is(
  (select count(*) from public.list_conversation_messages(current_setting('lx15.direct_id')::uuid,40,null,null)),
  1::bigint,
  'Free recipient can read received messages'
);
select is(
  (select can_send from public.get_conversation_detail(current_setting('lx15.direct_id')::uuid)),
  false,
  'Free recipient sees read-only conversation entitlement'
);
select throws_ok(
  $$select public.get_luxy_profile_conversation('25000000-0000-0000-0000-000000000001')$$,
  '42501','premium_membership_required','Free cannot start/re-open messaging via paid profile CTA'
);
select throws_ok(
  $$select public.send_message(
      current_setting('lx15.direct_id')::uuid,
      'Free must not reply',
      '25000000-0000-4000-8000-000000000102'
    )$$,
  '42501','premium_membership_required','Free cannot send text by RPC bypass'
);
reset role;

-- Blocking immediately prevents paid sender from using the existing conversation.
insert into public.user_blocks(blocker_id,blocked_id,reason_code)
values('25000000-0000-0000-0000-000000000002','25000000-0000-0000-0000-000000000001','lx15_test');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"25000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok(
  $$select public.send_message(
      current_setting('lx15.direct_id')::uuid,
      'Blocked message must fail',
      '25000000-0000-4000-8000-000000000103'
    )$$,
  '42501','messaging_blocked','Block still hard-stops direct messaging'
);
reset role;
delete from public.user_blocks where blocker_id='25000000-0000-0000-0000-000000000002' and blocked_id='25000000-0000-0000-0000-000000000001';

-- Existing friendship workflow remains backward compatible and populates canonical pair columns.
insert into public.friendships(id,requester_id,addressee_id,status)
values(
  '25000000-0000-4000-8000-000000000201',
  '25000000-0000-0000-0000-000000000001',
  '25000000-0000-0000-0000-000000000003',
  'pending'
);
update public.friendships
set status='accepted',responded_at=now()
where id='25000000-0000-4000-8000-000000000201';

select is(
  (select friendship_id from public.conversations where direct_member_low_id='25000000-0000-0000-0000-000000000001' and direct_member_high_id='25000000-0000-0000-0000-000000000003'),
  '25000000-0000-4000-8000-000000000201'::uuid,
  'Legacy accepted friendship links to its canonical conversation'
);
select is(
  (select count(*) from public.conversations where direct_member_low_id='25000000-0000-0000-0000-000000000001' and direct_member_high_id='25000000-0000-0000-0000-000000000003'),
  1::bigint,
  'Legacy trigger cannot create duplicate pair conversations'
);

select * from finish();
rollback;
