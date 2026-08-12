begin;

select plan(30);

select is((select count(*) from public.gift_catalog where is_active and deleted_at is null),20::bigint,'LX-19 reuses exactly the existing 20 active gifts');
select is((select min(display_hearts) from public.gift_catalog where is_active and deleted_at is null),1,'Existing gift catalog starts at 1 heart');
select is((select max(display_hearts) from public.gift_catalog where is_active and deleted_at is null),20,'Existing gift catalog ends at 20 hearts');
select is((select string_agg(display_hearts::text,',' order by sort_order) from public.gift_catalog where is_active and deleted_at is null),'1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20','Existing gift prices remain sequential 1 to 20 hearts');
select is((select name_vi from public.gift_catalog where slug='donut'),'Donut','Existing Donut gift is preserved');
select is((select name_vi from public.gift_catalog where slug='crown'),'Vương miện','Existing Crown gift is preserved');
select is(private.luxy_gift_hold_days(),7,'New Luxy gift reward hold is exactly seven days');
select is(private.config_integer('creator_reward_hold_days'),7::bigint,'Compatibility reward hold is aligned to seven days');
select ok(has_function_privilege('authenticated','public.send_luxy_gift(uuid,uuid,integer,uuid,uuid,uuid)','execute'),'Authenticated app may call the gated Luxy gift RPC');
select ok(not has_schema_privilege('authenticated','private','USAGE'),'Authenticated clients still cannot use the private accounting schema');

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
  confirmation_token,recovery_token,email_change_token_new,email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
('00000000-0000-0000-0000-000000000000','29000000-0000-0000-0000-000000000001','authenticated','authenticated','lx19-free@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','29000000-0000-0000-0000-000000000002','authenticated','authenticated','lx19-premium@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','29000000-0000-0000-0000-000000000003','authenticated','authenticated','lx19-recipient@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

update private.user_identity set
  date_of_birth=(current_date-interval '32 years')::date,
  age_verified_at=now(),age_verification_method='self_declared',
  terms_version=(select value_json#>>'{}' from private.app_config where key='terms_version_current'),terms_accepted_at=now(),
  community_rules_version=(select value_json#>>'{}' from private.app_config where key='community_rules_version_current'),community_rules_accepted_at=now(),
  account_status='active'
where user_id::text like '29000000-0000-0000-0000-00000000000%';

update public.profiles set
  profile_status='active',discovery_enabled=true,
  province_id=(select id from public.administrative_areas where country_code='VN' and code='79'),
  username=case id
    when '29000000-0000-0000-0000-000000000001' then 'lx19_free'
    when '29000000-0000-0000-0000-000000000002' then 'lx19_premium'
    else 'lx19_recipient' end,
  display_name=case id
    when '29000000-0000-0000-0000-000000000001' then 'LX19 Free'
    when '29000000-0000-0000-0000-000000000002' then 'LX19 Premium'
    else 'LX19 Recipient' end,
  gender='male'::public.gender_identity,interested_in='female'::public.dating_interest,last_active_at=now()
where id::text like '29000000-0000-0000-0000-00000000000%';

insert into private.luxy_memberships(user_id,tier,status,messaging_enabled,starts_at,expires_at,source)
values('29000000-0000-0000-0000-000000000002','premium','active',true,now()-interval '1 minute',now()+interval '30 days','lx19_test');

select ok(not exists(select 1 from public.creator_profiles where user_id='29000000-0000-0000-0000-000000000003'),'Gift recipient does not need a legacy Creator profile');
select ok(exists(select 1 from private.creator_earning_accounts where creator_id='29000000-0000-0000-0000-000000000003'),'Every member has a compatibility recipient earning account');

insert into private.play_purchases(
  id,user_id,product_id,google_product_id,purchase_token_hash,purchase_state,heart_units,is_test_purchase,verified_at,idempotency_key,purchase_provider
) values(
  '29000000-0000-4000-8000-000000000010','29000000-0000-0000-0000-000000000002',
  (select id from public.heart_products where google_product_id='myfan_hearts_500'),
  'myfan_hearts_500',repeat('a',64),'purchased',50000,true,now(),'29000000-0000-4000-8000-000000000011','google_play'
);
insert into private.heart_lots(purchase_id,user_id,original_units,available_units)
values('29000000-0000-4000-8000-000000000010','29000000-0000-0000-0000-000000000002',50000,50000);
update private.heart_accounts set available_units=50000,lifetime_purchased_units=50000,version=version+1
where user_id='29000000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"29000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select can_use_hearts from public.get_my_luxy_membership_snapshot()),false,'Free member cannot use heart gifting economy');
select is((select can_gift from public.get_my_luxy_gift_wallet()),false,'Free member gift wallet is server-gated');
select throws_ok(
  $$select * from public.send_luxy_gift(
    '29000000-0000-0000-0000-000000000003',
    (select id from public.gift_catalog where slug='donut'),1,
    '29000000-0000-4000-8000-000000000101',null,null
  )$$,
  '42501','premium_membership_required_for_gifting','Free member cannot send a gift'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"29000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select can_use_hearts from public.get_my_luxy_membership_snapshot()),true,'Premium member can use heart gifting economy');
select is((select heart_balance_units from public.get_my_luxy_membership_snapshot()),50000::bigint,'Premium snapshot exposes the paid member heart balance');
select set_config('lx19.crown_gift',(
  select gift_transaction_id::text
  from public.send_luxy_gift(
    '29000000-0000-0000-0000-000000000003',
    (select id from public.gift_catalog where slug='crown'),1,
    '29000000-0000-4000-8000-000000000102',null,null
  )
),true);
select is((select gross_heart_units from public.gift_transactions where id=current_setting('lx19.crown_gift')::uuid),2000::bigint,'Existing Crown costs exactly 20 hearts');
select is((select creator_reward_units from public.gift_transactions where id=current_setting('lx19.crown_gift')::uuid),1400::bigint,'Recipient reward snapshots the existing 70 percent share');
select ok((select reward_available_at between now()+interval '6 days 23 hours' and now()+interval '7 days 1 hour' from public.list_my_luxy_gifts('sent',30,0) where gift_transaction_id=current_setting('lx19.crown_gift')::uuid),'Crown reward becomes available after seven days');
select is((select heart_balance_units from public.get_my_luxy_membership_snapshot()),48000::bigint,'Gift debit is atomic against sender balance');

select is((
  select gift_transaction_id
  from public.send_luxy_gift(
    '29000000-0000-0000-0000-000000000003',
    (select id from public.gift_catalog where slug='crown'),1,
    '29000000-0000-4000-8000-000000000102',null,null
  )
),current_setting('lx19.crown_gift')::uuid,'Gift idempotency returns the original transaction');
select is((select heart_balance_units from public.get_my_luxy_membership_snapshot()),48000::bigint,'Idempotent gift retry does not double-debit hearts');

select set_config('lx19.conversation_id',public.get_luxy_profile_conversation('29000000-0000-0000-0000-000000000003')::text,true);
select set_config('lx19.chat_gift',(
  select gift_transaction_id::text
  from public.send_luxy_gift(
    '29000000-0000-0000-0000-000000000003',
    (select id from public.gift_catalog where slug='donut'),1,
    '29000000-0000-4000-8000-000000000103',current_setting('lx19.conversation_id')::uuid,
    '29000000-0000-4000-8000-000000000104'
  )
),true);
select is((select message_type::text from public.messages where gift_transaction_id=current_setting('lx19.chat_gift')::uuid),'gift','Chat gift creates a real gift message in the direct conversation');
select is((select count(*) from public.fan_progress where creator_id='29000000-0000-0000-0000-000000000003' and fan_user_id='29000000-0000-0000-0000-000000000002'),0::bigint,'Luxy gifts do not recreate legacy Fan relationship semantics');
select is((select count(*) from public.list_my_luxy_gifts('sent',30,0)),2::bigint,'Sender history returns both contextual gifts');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"29000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((select reward_pending_units from public.get_my_luxy_gift_wallet()),1470::bigint,'Recipient wallet shows 14.7 hearts pending before seven days');
select is((select count(*) from public.list_my_luxy_gifts('received',30,0)),2::bigint,'Recipient history returns both gifts');
reset role;

update private.creator_reward_positions set available_at=now()-interval '1 second'
where gift_transaction_id=current_setting('lx19.crown_gift')::uuid;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"29000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((select reward_available_units from public.get_my_luxy_gift_wallet()),1400::bigint,'Due seven-day reward becomes available to withdraw');
select is((select reward_pending_units from public.get_my_luxy_gift_wallet()),70::bigint,'Only the newer Donut reward remains pending');
reset role;

select * from finish();
rollback;
