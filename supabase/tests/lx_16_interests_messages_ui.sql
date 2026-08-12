begin;

select plan(18);

select has_column('public','conversation_members','archived_at','LX-16 stores per-member mailbox archive state');
select col_is_null('public','conversation_members','archived_at','Archive state is optional for active inbox conversations');
select ok(has_function_privilege('authenticated','public.set_conversation_archived(uuid,boolean)','execute'),'Authenticated conversation member can archive their mailbox row');
select ok(not has_function_privilege('anon','public.set_conversation_archived(uuid,boolean)','execute'),'Anonymous cannot mutate mailbox archive state');
select ok(has_function_privilege('authenticated','public.list_my_conversations(integer,integer)','execute'),'Authenticated member can read the Seeking mailbox read model');

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
('00000000-0000-0000-0000-000000000000','26000000-0000-0000-0000-000000000001','authenticated','authenticated','lx16-premium@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','26000000-0000-0000-0000-000000000002','authenticated','authenticated','lx16-free@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

update private.user_identity
set date_of_birth=case user_id
      when '26000000-0000-0000-0000-000000000001'::uuid then (current_date-interval '36 years')::date
      else (current_date-interval '29 years')::date
    end,
    age_verified_at=now(),
    age_verification_method='self_declared',
    terms_version=(select value_json#>>'{}' from private.app_config where key='terms_version_current'),
    terms_accepted_at=now(),
    community_rules_version=(select value_json#>>'{}' from private.app_config where key='community_rules_version_current'),
    community_rules_accepted_at=now(),
    account_status='active'
where user_id in (
  '26000000-0000-0000-0000-000000000001'::uuid,
  '26000000-0000-0000-0000-000000000002'::uuid
);

update public.profiles
set profile_status='active',
    discovery_enabled=true,
    province_id=(select id from public.administrative_areas where country_code='VN' and code='79'),
    username=case id
      when '26000000-0000-0000-0000-000000000001' then 'lx16_premium'
      else 'lx16_free' end,
    display_name=case id
      when '26000000-0000-0000-0000-000000000001' then 'LX16 Premium'
      else 'LX16 Free' end,
    headline=case id
      when '26000000-0000-0000-0000-000000000001' then 'Du lịch, kinh doanh và sự tử tế'
      else 'Kết nối chân thành tại Việt Nam' end,
    height_cm=case id
      when '26000000-0000-0000-0000-000000000001' then 162
      else 163 end,
    weight_kg=case id
      when '26000000-0000-0000-0000-000000000001' then 52
      else 51 end,
    last_active_at=now(),
    gender='male'::public.gender_identity,
    interested_in='female'::public.dating_interest
where id in (
  '26000000-0000-0000-0000-000000000001'::uuid,
  '26000000-0000-0000-0000-000000000002'::uuid
);

insert into private.luxy_memberships(user_id,tier,status,messaging_enabled,starts_at,expires_at,source)
values('26000000-0000-0000-0000-000000000001','premium','active',true,now()-interval '1 day',now()+interval '30 days','lx16_test');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"26000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select set_config('lx16.direct_id',public.get_luxy_profile_conversation('26000000-0000-0000-0000-000000000002')::text,true);
select ok(current_setting('lx16.direct_id')::uuid is not null,'Premium opens the LX-15 direct conversation used by LX-16 mailbox');
select lives_ok(
  $$select public.send_message(
      current_setting('lx16.direct_id')::uuid,
      'Tin nhắn LX-16 vẫn đọc được với Free',
      '26000000-0000-4000-8000-000000000101'
    )$$,
  'Premium sends a message through the unchanged LX-15 entitlement contract'
);
select lives_ok(
  $$select public.record_profile_view('26000000-0000-0000-0000-000000000002')$$,
  'Profile viewing still feeds the Interests viewed-me source'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"26000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is(
  (select count(*) from public.list_my_conversations(30,0) where conversation_id=current_setting('lx16.direct_id')::uuid),
  1::bigint,
  'Free recipient receives the direct conversation in the mailbox'
);
select is(
  (select can_send from public.list_my_conversations(30,0) where conversation_id=current_setting('lx16.direct_id')::uuid),
  false,
  'Free mailbox remains read-only rather than copying Seeking upgrade-to-read behavior'
);
select is(
  (select last_message_body from public.list_my_conversations(30,0) where conversation_id=current_setting('lx16.direct_id')::uuid),
  'Tin nhắn LX-16 vẫn đọc được với Free',
  'Free recipient sees the incoming text preview'
);
select is(
  (select headline from public.list_my_conversations(30,0) where conversation_id=current_setting('lx16.direct_id')::uuid),
  'Du lịch, kinh doanh và sự tử tế',
  'Mailbox exposes the non-sensitive public headline shown in Seeking rows'
);
select is(
  public.set_conversation_archived(current_setting('lx16.direct_id')::uuid,true),
  true,
  'Recipient can archive their own mailbox row'
);
select is(
  (select is_archived from public.list_my_conversations(30,0) where conversation_id=current_setting('lx16.direct_id')::uuid),
  true,
  'Archive state is returned by the mailbox read model'
);
select is(
  public.set_conversation_archived(current_setting('lx16.direct_id')::uuid,false),
  true,
  'Recipient can restore the conversation from archive'
);
select is(
  (select count(*) from public.list_luxy_interests('viewed_me',24,0) where id='26000000-0000-0000-0000-000000000001'),
  1::bigint,
  'Viewed Me includes a recent profile view'
);
select is(
  (select headline from public.list_luxy_interests('viewed_me',24,0) where id='26000000-0000-0000-0000-000000000001'),
  'Du lịch, kinh doanh và sự tử tế',
  'Interests read model exposes the public headline required by the Seeking row'
);
select is(
  (select height_cm::integer from public.list_luxy_interests('viewed_me',24,0) where id='26000000-0000-0000-0000-000000000001'),
  162,
  'Interests read model exposes public height'
);
select is(
  (select weight_kg::integer from public.list_luxy_interests('viewed_me',24,0) where id='26000000-0000-0000-0000-000000000001'),
  52,
  'Interests read model exposes public weight'
);
reset role;

update public.profile_views
set last_viewed_at=now()-interval '181 days'
where viewer_id='26000000-0000-0000-0000-000000000001'
  and viewed_id='26000000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"26000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is(
  (select count(*) from public.list_luxy_interests('viewed_me',24,0) where id='26000000-0000-0000-0000-000000000001'),
  0::bigint,
  'Viewed Me excludes views older than the Seeking 180-day window'
);
reset role;

select * from finish();
rollback;
