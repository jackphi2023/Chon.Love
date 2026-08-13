begin;

-- WEB-R01 keeps the LX-19 engine preserved but launch-disabled. This contract
-- first proves the fail-closed release default, then explicitly enables gifts
-- inside this rolled-back test transaction to exercise the financial engine.
select plan(25);

select is((select count(*) from public.gift_catalog where is_active and deleted_at is null),20::bigint,'LX-19 preserves exactly 20 active gifts');
select is((select min(display_hearts) from public.gift_catalog where is_active and deleted_at is null),1,'Gift catalog starts at 1 heart');
select is((select max(display_hearts) from public.gift_catalog where is_active and deleted_at is null),20,'Gift catalog ends at 20 hearts');
select is(private.luxy_gift_hold_days(),7,'Gift reward hold remains exactly seven days');
select is(coalesce(private.config_boolean('luxy_member_gifts_enabled'),false),false,'WEB-R01 launch default keeps server-side gifts disabled');
select ok(has_function_privilege('authenticated','public.send_luxy_gift(uuid,uuid,integer,uuid,uuid,uuid)','execute'),'Authenticated app retains the gated Luxy gift RPC for deferred launch');
select ok(not has_function_privilege('authenticated','public.request_withdrawal(uuid,bigint,uuid)','execute'),'WEB-R01 keeps direct withdrawal requests unavailable to authenticated clients');
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
select ok(exists(select 1 from private.creator_earning_accounts where creator_id='29000000-0000-0000-0000-000000000003'),'Every member retains a compatibility earning account');

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
select set_config('request.jwt.claims','{"sub":"29000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select throws_ok(
  $$select * from public.send_luxy_gift(
    '29000000-0000-0000-0000-000000000003',
    (select id from public.gift_catalog where slug='crown'),1,
    '29000000-0000-4000-8000-000000000100',null,null
  )$$,
  '42501','premium_membership_required_for_gifting','Server-side launch flag blocks gifting even for Premium'
);
reset role;

update private.app_config set value_json='true'::jsonb,updated_at=now() where key='luxy_member_gifts_enabled';
select is(private.luxy_member_gifts_enabled(),true,'Test transaction can explicitly enable deferred gift engine');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"29000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select can_use_hearts from public.get_my_luxy_membership_snapshot()),false,'Free member cannot use heart gifting economy');
select throws_ok(
  $$select * from public.send_luxy_gift(
    '29000000-0000-0000-0000-000000000003',
    (select id from public.gift_catalog where slug='donut'),1,
    '29000000-0000-4000-8000-000000000101',null,null
  )$$,
  '42501','premium_membership_required_for_gifting','Free member cannot send a gift when engine is enabled'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"29000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select can_use_hearts from public.get_my_luxy_membership_snapshot()),true,'Premium member retains heart entitlement');
select set_config('lx19.crown_gift',(
  select gift_transaction_id::text
  from public.send_luxy_gift(
    '29000000-0000-0000-0000-000000000003',
    (select id from public.gift_catalog where slug='crown'),1,
    '29000000-0000-4000-8000-000000000102',null,null
  )
),true);
select is((select gross_heart_units from public.gift_transactions where id=current_setting('lx19.crown_gift')::uuid),2000::bigint,'Crown costs exactly 20 hearts');
select is((select creator_reward_units from public.gift_transactions where id=current_setting('lx19.crown_gift')::uuid),1400::bigint,'Recipient reward remains 70 percent');
select is((select platform_gross_units from public.gift_transactions where id=current_setting('lx19.crown_gift')::uuid),600::bigint,'Platform gross remains 30 percent');
select ok((select reward_available_at between now()+interval '6 days 23 hours' and now()+interval '7 days 1 hour' from public.list_my_luxy_gifts('sent',30,0) where gift_transaction_id=current_setting('lx19.crown_gift')::uuid),'Reward becomes available after seven days');
select is((select heart_balance_units from public.get_my_luxy_membership_snapshot()),48000::bigint,'Gift debit is atomic against sender balance');
select is((
  select gift_transaction_id
  from public.send_luxy_gift(
    '29000000-0000-0000-0000-000000000003',
    (select id from public.gift_catalog where slug='crown'),1,
    '29000000-0000-4000-8000-000000000102',null,null
  )
),current_setting('lx19.crown_gift')::uuid,'Gift idempotency returns original transaction');
reset role;
select is((select count(*) from public.fan_progress where creator_id='29000000-0000-0000-0000-000000000003' and fan_user_id='29000000-0000-0000-0000-000000000002'),0::bigint,'Gift does not recreate Fan relationship semantics');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"29000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((select reward_pending_units from public.get_my_luxy_gift_wallet()),1400::bigint,'Recipient wallet shows reward pending before seven days');
select is((select count(*) from public.list_my_received_gift_log(50,0)),1::bigint,'Recipient durable gift log records the gift');
reset role;

update private.creator_reward_positions set available_at=now()-interval '1 second'
where gift_transaction_id=current_setting('lx19.crown_gift')::uuid;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"29000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((select reward_available_units from public.get_my_luxy_gift_wallet()),1400::bigint,'Due seven-day reward becomes available in ledger');
reset role;

select * from finish();
rollback;
