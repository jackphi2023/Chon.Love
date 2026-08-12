begin;

select plan(34);

create temporary table br04_state (
  key text primary key,
  value uuid not null
) on commit drop;

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
  confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,
  reauthentication_token
) values
('00000000-0000-0000-0000-000000000000','4b000000-0000-0000-0000-000000000001','authenticated','authenticated','br04-a@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','4b000000-0000-0000-0000-000000000002','authenticated','authenticated','br04-b@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','4b000000-0000-0000-0000-000000000003','authenticated','authenticated','br04-c@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','4b000000-0000-0000-0000-000000000004','authenticated','authenticated','br04-d@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

update private.user_identity set
  date_of_birth=(current_date-interval '25 years')::date,
  age_verified_at=now(),
  age_verification_method='self_declared',
  terms_version=(select value_json#>>'{}' from private.app_config where key='terms_version_current'),
  terms_accepted_at=now(),
  community_rules_version=(select value_json#>>'{}' from private.app_config where key='community_rules_version_current'),
  community_rules_accepted_at=now(),
  account_status='active'
where user_id::text like '4b000000-0000-0000-0000-00000000000%';

-- BR-04 exercises already-active social actors. Since Luxy signup now requires a
-- resolved member-photo verification before an incomplete profile can activate,
-- create explicit approved fixture cases rather than bypassing the production gate.
insert into public.moderation_cases(
  reported_user_id,
  source,
  status,
  priority,
  rule_codes,
  automated_score_json,
  decision,
  decision_notes,
  resolved_at
)
select
  p.id,
  'automated_scan'::public.moderation_source,
  'resolved'::public.moderation_case_status,
  'normal'::public.moderation_priority,
  array['member_photo_verification']::text[],
  jsonb_build_object('fixture', 'br04', 'maxSimilarity', 99.9, 'threshold', 60),
  'approve'::public.moderation_decision,
  'BR-04 approved selfie verification fixture',
  now()
from public.profiles p
where p.id::text like '4b000000-0000-0000-0000-00000000000%';

update public.profiles set
  profile_status='active',
  discovery_enabled=true,
  nearby_enabled=false,
  province_id=1,
  last_active_at=now(),
  username=case id
    when '4b000000-0000-0000-0000-000000000001' then 'br04_actor_a'
    when '4b000000-0000-0000-0000-000000000002' then 'br04_actor_b'
    when '4b000000-0000-0000-0000-000000000003' then 'br04_actor_c'
    else 'br04_actor_d'
  end,
  display_name=case id
    when '4b000000-0000-0000-0000-000000000001' then 'BR04 Actor A'
    when '4b000000-0000-0000-0000-000000000002' then 'BR04 Actor B'
    when '4b000000-0000-0000-0000-000000000003' then 'BR04 Actor C'
    else 'BR04 Actor D'
  end
where id::text like '4b000000-0000-0000-0000-00000000000%';

select is(
  (select count(*)::integer from public.profiles where id::text like '4b000000-0000-0000-0000-00000000000%'),
  4,
  'four isolated adult social actors are available'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4b000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
end $$;

select ok(
  exists(select 1 from public.list_discovery_profiles('province',1,40,0) x where x.id='4b000000-0000-0000-0000-000000000002'),
  'actor A discovers actor B in the same province'
);

select ok(
  not exists(select 1 from public.list_discovery_profiles('province',1,40,0) x where x.id='4b000000-0000-0000-0000-000000000001'),
  'discovery never returns the signed-in actor'
);

insert into br04_state(key,value)
select 'friendship_one',(public.send_friend_request('4b000000-0000-0000-0000-000000000002','Xin chào từ A')).id;

select ok((select value is not null from br04_state where key='friendship_one'),'A creates a pending friend request to B');

select ok(
  exists(
    select 1 from public.list_my_social_connections('sent',30,0) x
    where x.friendship_id=(select value from br04_state where key='friendship_one')
      and x.other_user_id='4b000000-0000-0000-0000-000000000002'
      and x.direction='outgoing'
  ),
  'A sees B in the sent-request list'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4b000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
end $$;

select is(
  public.get_direct_conversation('4b000000-0000-0000-0000-000000000002'),
  null::uuid,
  'unrelated actor C has no direct conversation with B'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4b000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
end $$;

select ok(
  exists(
    select 1 from public.list_my_social_connections('received',30,0) x
    where x.friendship_id=(select value from br04_state where key='friendship_one')
      and x.other_user_id='4b000000-0000-0000-0000-000000000001'
      and x.direction='incoming'
  ),
  'B sees the incoming request from A'
);

select is(
  (public.respond_to_friend_request((select value from br04_state where key='friendship_one'),true)).status::text,
  'accepted',
  'B accepts the friend request'
);

insert into br04_state(key,value)
select 'conversation_one',id from public.conversations
where friendship_id=(select value from br04_state where key='friendship_one');

select ok((select value is not null from br04_state where key='conversation_one'),'acceptance creates one direct conversation');

select is(
  (select count(*)::integer from public.conversation_members where conversation_id=(select value from br04_state where key='conversation_one')),
  2,
  'the direct conversation has exactly two members'
);

select is(
  public.get_direct_conversation('4b000000-0000-0000-0000-000000000001'),
  (select value from br04_state where key='conversation_one'),
  'B resolves the accepted direct conversation with A'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4b000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
end $$;

select ok(
  exists(
    select 1 from public.list_my_social_connections('friends',30,0) x
    where x.friendship_id=(select value from br04_state where key='friendship_one')
      and x.direction='mutual'
  ),
  'A sees the accepted mutual friendship'
);

insert into br04_state(key,value)
select 'message_one',(public.send_message(
  (select value from br04_state where key='conversation_one'),
  'Tin nhắn E2E từ A',
  '4b100000-0000-4000-8000-000000000001'
)).id;

select ok((select value is not null from br04_state where key='message_one'),'A sends the first chat message');

select is(
  (public.send_message(
    (select value from br04_state where key='conversation_one'),
    'Tin nhắn E2E từ A',
    '4b100000-0000-4000-8000-000000000001'
  )).id,
  (select value from br04_state where key='message_one'),
  'retrying the same client message id is idempotent'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4b000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
end $$;

select ok(
  exists(
    select 1 from public.list_conversation_messages((select value from br04_state where key='conversation_one'),40,null,null) x
    where x.id=(select value from br04_state where key='message_one') and not x.is_own
  ),
  'B reads A message as the other participant'
);

select ok(
  exists(
    select 1 from public.list_my_conversations(30,0) x
    where x.conversation_id=(select value from br04_state where key='conversation_one') and x.unread_count=1
  ),
  'B receives one unread message count'
);

select ok(
  public.mark_conversation_read(
    (select value from br04_state where key='conversation_one'),
    (select value from br04_state where key='message_one')
  ),
  'B marks the conversation as read'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4b000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
end $$;

select ok(
  exists(
    select 1 from public.list_conversation_messages((select value from br04_state where key='conversation_one'),40,null,null) x
    where x.id=(select value from br04_state where key='message_one') and x.is_read_by_other
  ),
  'A receives the read receipt from B'
);

insert into br04_state(key,value)
select 'report_one',public.create_report(
  null,
  null,
  (select value from br04_state where key='message_one'),
  'harassment',
  'BR04 transactional E2E',
  '{}'::jsonb
);

select ok((select value is not null from br04_state where key='report_one'),'A reports a visible message');

select throws_ok(
  $$select public.create_report(null,null,(select value from br04_state where key='message_one'),'harassment','duplicate','{}'::jsonb)$$,
  '54000',
  'report_rate_limited',
  'duplicate message report is rate limited'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4b000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
end $$;

select throws_ok(
  $$select * from public.list_conversation_messages((select value from br04_state where key='conversation_one'),40,null,null)$$,
  '42501',
  'conversation_not_available',
  'non-member C cannot read the A-B conversation'
);

select throws_ok(
  $$select public.send_message((select value from br04_state where key='conversation_one'),'Không được phép','4b100000-0000-4000-8000-000000000003')$$,
  '42501',
  'sender_not_conversation_member',
  'non-member C cannot send into the A-B conversation'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4b000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
end $$;

select ok(public.block_user('4b000000-0000-0000-0000-000000000001','br04_safety'),'B blocks A');

select ok(
  exists(
    select 1 from public.friendships
    where id=(select value from br04_state where key='friendship_one') and status='cancelled'
  ),
  'blocking cancels the accepted friendship'
);

select ok(
  exists(
    select 1 from public.get_conversation_detail((select value from br04_state where key='conversation_one')) x
    where x.blocked_by_viewer and not x.can_send
  ),
  'blocking immediately disables sending for the blocker'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4b000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
end $$;

select ok(
  not exists(select 1 from public.get_profile_viewer('br04_actor_b')),
  'the blocked actor cannot view the blocker profile'
);

select ok(
  not exists(select 1 from public.list_discovery_profiles('province',1,40,0) x where x.id='4b000000-0000-0000-0000-000000000002'),
  'the blocker disappears from the blocked actor discovery results'
);

select throws_ok(
  $$select public.send_message((select value from br04_state where key='conversation_one'),'Không thể gửi sau chặn','4b100000-0000-4000-8000-000000000004')$$,
  '42501',
  'accepted_friendship_required',
  'chat remains closed after blocking cancels the friendship'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4b000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
end $$;

select ok(public.unblock_user('4b000000-0000-0000-0000-000000000001'),'B unblocks A');

select is(
  public.get_direct_conversation('4b000000-0000-0000-0000-000000000001'),
  null::uuid,
  'unblocking does not restore the cancelled friendship or chat'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4b000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
end $$;

insert into br04_state(key,value)
select 'friendship_two',(public.send_friend_request('4b000000-0000-0000-0000-000000000002','Lời mời mới sau bỏ chặn')).id;

select ok(
  (select value from br04_state where key='friendship_two') is distinct from (select value from br04_state where key='friendship_one'),
  'A can create a new request after B unblocks A'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4b000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
end $$;

select is(
  (public.respond_to_friend_request((select value from br04_state where key='friendship_two'),false)).status::text,
  'declined',
  'B can decline the replacement request'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4b000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
end $$;

insert into br04_state(key,value)
select 'friendship_cancel',(public.send_friend_request('4b000000-0000-0000-0000-000000000003',null)).id;

select ok(
  public.cancel_friend_request((select value from br04_state where key='friendship_cancel')),
  'D cancels a pending request to C'
);

select ok(
  exists(
    select 1 from public.friendships
    where id=(select value from br04_state where key='friendship_cancel') and status='cancelled'
  ),
  'the cancelled request persists with the correct terminal status'
);

select * from finish();
rollback;
