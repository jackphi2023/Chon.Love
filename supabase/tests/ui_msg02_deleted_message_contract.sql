begin;

select plan(21);

select has_column(
  'public',
  'conversations',
  'message_retention_purged_at',
  'UI-MSG02 stores a conversation-level physical purge marker'
);
select ok(
  not has_function_privilege('authenticated','private.purge_expired_conversation_messages()','execute'),
  'Authenticated clients cannot invoke the physical retention purge job directly'
);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
('00000000-0000-0000-0000-000000000000','29000000-0000-0000-0000-000000000001','authenticated','authenticated','msg02-premium@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','29000000-0000-0000-0000-000000000002','authenticated','authenticated','msg02-free@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

update private.user_identity
set date_of_birth=(current_date-interval '31 years')::date,
    age_verified_at=now(),
    age_verification_method='self_declared',
    terms_version=(select value_json#>>'{}' from private.app_config where key='terms_version_current'),
    terms_accepted_at=now(),
    community_rules_version=(select value_json#>>'{}' from private.app_config where key='community_rules_version_current'),
    community_rules_accepted_at=now(),
    account_status='active'
where user_id in (
  '29000000-0000-0000-0000-000000000001'::uuid,
  '29000000-0000-0000-0000-000000000002'::uuid
);

update public.profiles
set profile_status='active',
    discovery_enabled=true,
    province_id=(select id from public.administrative_areas where country_code='VN' and code='79'),
    username=case id
      when '29000000-0000-0000-0000-000000000001' then 'msg02_premium'
      else 'msg02_counterpart' end,
    display_name=case id
      when '29000000-0000-0000-0000-000000000001' then 'MSG02 Premium'
      else 'MSG02 Counterpart' end,
    headline=case id
      when '29000000-0000-0000-0000-000000000001' then 'Premium retention fixture'
      else 'Counterpart metadata must survive purge' end,
    last_active_at=now(),
    gender='male'::public.gender_identity,
    interested_in='female'::public.dating_interest
where id in (
  '29000000-0000-0000-0000-000000000001'::uuid,
  '29000000-0000-0000-0000-000000000002'::uuid
);

insert into public.media_assets(
  id,owner_id,storage_bucket,storage_path,media_type,mime_type,file_size_bytes,width,height,
  visibility,moderation_status,uploaded_at,approved_at,approved_by
) values (
  '29000000-0000-4000-8000-000000000010',
  '29000000-0000-0000-0000-000000000002',
  'profile-media',
  '29000000-0000-0000-0000-000000000002/29000000-0000-4000-8000-000000000010/avatar.webp',
  'image',
  'image/webp',
  1024,
  320,
  420,
  'avatar',
  'approved',
  now()-interval '2 days',
  now()-interval '2 days',
  '29000000-0000-0000-0000-000000000002'
);

update public.profiles
set avatar_media_id='29000000-0000-4000-8000-000000000010'
where id='29000000-0000-0000-0000-000000000002';

insert into private.luxy_memberships(user_id,tier,status,messaging_enabled,starts_at,expires_at,source)
values(
  '29000000-0000-0000-0000-000000000001',
  'premium',
  'active',
  true,
  now()-interval '1 day',
  now()+interval '30 days',
  'ui_msg02_test'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"29000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select set_config(
  'ui_msg02.conversation_id',
  public.get_luxy_profile_conversation('29000000-0000-0000-0000-000000000002')::text,
  true
);
select ok(
  current_setting('ui_msg02.conversation_id')::uuid is not null,
  'Premium member opens the direct conversation used by UI-MSG02'
);
select lives_ok(
  $$select public.send_message(
      current_setting('ui_msg02.conversation_id')::uuid,
      'Tin nhắn cũ phải bị xoá vật lý sau 7 ngày',
      '29000000-0000-4000-8000-000000000101'
    )$$,
  'Premium sends the message that will later expire'
);
reset role;

update public.messages
set sent_at=now()-interval '8 days'
where conversation_id=current_setting('ui_msg02.conversation_id')::uuid;
update public.conversations
set auto_delete_messages_after_days=7,
    last_message_at=now()-interval '8 days',
    message_retention_updated_at=now()-interval '8 days',
    message_retention_updated_by='29000000-0000-0000-0000-000000000001'
where id=current_setting('ui_msg02.conversation_id')::uuid;

select is(
  (select count(*) from public.messages where conversation_id=current_setting('ui_msg02.conversation_id')::uuid),
  1::bigint,
  'Expired fixture message exists before the retention job runs'
);

select set_config(
  'ui_msg02.deleted_count',
  private.purge_expired_conversation_messages()::text,
  true
);
select is(
  current_setting('ui_msg02.deleted_count')::bigint,
  1::bigint,
  'Physical retention job reports exactly one deleted message'
);
select is(
  (select count(*) from public.messages where conversation_id=current_setting('ui_msg02.conversation_id')::uuid),
  0::bigint,
  'Expired message is physically removed from public.messages'
);
select is(
  (select count(*) from public.conversations where id=current_setting('ui_msg02.conversation_id')::uuid),
  1::bigint,
  'Conversation row survives physical message deletion'
);
select is(
  (select count(*) from public.conversation_members where conversation_id=current_setting('ui_msg02.conversation_id')::uuid),
  2::bigint,
  'Both conversation memberships survive physical message deletion'
);
select is(
  (select count(*) from public.profiles where id='29000000-0000-0000-0000-000000000002'),
  1::bigint,
  'Counterpart profile survives physical message deletion'
);
select is(
  (select avatar_media_id from public.profiles where id='29000000-0000-0000-0000-000000000002'),
  '29000000-0000-4000-8000-000000000010'::uuid,
  'Counterpart avatar reference survives physical message deletion'
);
select ok(
  (select message_retention_purged_at is not null from public.conversations where id=current_setting('ui_msg02.conversation_id')::uuid),
  'Conversation records a purge marker only after physical deletion occurred'
);
select is(
  (select last_message_at from public.conversations where id=current_setting('ui_msg02.conversation_id')::uuid),
  null::timestamptz,
  'Conversation last_message_at becomes null when every message was physically purged'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"29000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is(
  (select count(*) from public.list_my_conversations(30,0) where conversation_id=current_setting('ui_msg02.conversation_id')::uuid),
  1::bigint,
  'Mailbox still returns the conversation after all messages are physically deleted'
);
select is(
  (select other_user_id from public.list_my_conversations(30,0) where conversation_id=current_setting('ui_msg02.conversation_id')::uuid),
  '29000000-0000-0000-0000-000000000002'::uuid,
  'Mailbox preserves the counterpart identity after purge'
);
select is(
  (select avatar_media_id from public.list_my_conversations(30,0) where conversation_id=current_setting('ui_msg02.conversation_id')::uuid),
  '29000000-0000-4000-8000-000000000010'::uuid,
  'Mailbox preserves the counterpart avatar metadata after purge'
);
select ok(
  (select retention_purged_at is not null from public.list_my_conversations(30,0) where conversation_id=current_setting('ui_msg02.conversation_id')::uuid),
  'Mailbox exposes the physical purge marker needed for the deleted-message placeholder'
);
select is(
  (select last_message_id from public.list_my_conversations(30,0) where conversation_id=current_setting('ui_msg02.conversation_id')::uuid),
  null::uuid,
  'Mailbox does not invent a message tombstone after physical deletion'
);
select ok(
  (select purged_at is not null from public.get_conversation_retention(current_setting('ui_msg02.conversation_id')::uuid)),
  'Conversation retention RPC exposes the server-backed purge marker'
);
select lives_ok(
  $$select * from public.set_conversation_auto_delete(current_setting('ui_msg02.conversation_id')::uuid,false)$$,
  'Conversation member can disable retention after a purge'
);
select ok(
  (select purged_at is not null from public.get_conversation_retention(current_setting('ui_msg02.conversation_id')::uuid)),
  'Disabling retention preserves historical purge metadata and never rewrites the conversation as brand new'
);
reset role;

select * from finish();
rollback;
