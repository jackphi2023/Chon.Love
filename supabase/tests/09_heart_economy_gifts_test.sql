begin;
select plan(65);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change_token_current,phone_change,phone_change_token,reauthentication_token) values
('00000000-0000-0000-0000-000000000000','49000000-0000-0000-0000-000000000001','authenticated','authenticated','economy-sender@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','49000000-0000-0000-0000-000000000002','authenticated','authenticated','economy-creator@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','49000000-0000-0000-0000-000000000003','authenticated','authenticated','economy-other@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

update private.user_identity
set date_of_birth=(current_date-interval '25 years')::date,age_verified_at=now(),age_verification_method='self_declared',
    terms_version='2026-07',terms_accepted_at=now(),community_rules_version='2026-07',community_rules_accepted_at=now(),account_status='active'
where user_id::text like '49000000-0000-0000-0000-00000000000%';
update public.profiles set profile_status='active',username='economy_'||right(id::text,1),display_name='Economy test' where id::text like '49000000-0000-0000-0000-00000000000%';
insert into public.creator_profiles(user_id,creator_status,creator_bio,fan_threshold_units,payout_eligible,approved_at)
values('49000000-0000-0000-0000-000000000002','approved','Approved creator',1000,true,now()),
      ('49000000-0000-0000-0000-000000000003','pending','Pending creator',1000,false,null);

select is((select count(*) from public.heart_products),7::bigint,'seven heart products are seeded');
select is((select count(*) from public.gift_catalog),20::bigint,'twenty gifts are seeded');
select is((select array_agg(display_hearts order by display_hearts) from public.heart_products),array[5,10,20,50,100,200,500],'heart product display values match specification');
select is((select array_agg(display_hearts order by display_hearts) from public.gift_catalog),array[1,2,3,5,7,10,12,15,20,25,30,35,40,50,60,70,75,80,90,100],'gift prices match specification');
select ok(not exists(select 1 from public.heart_products where heart_units<>display_hearts::bigint*100),'all heart products use 100 units per heart');
select ok(not exists(select 1 from public.gift_catalog where heart_price_units<>display_hearts::bigint*100),'all gifts use 100 units per heart');
select ok(not exists(select 1 from information_schema.columns where table_schema in ('public','private') and table_name in ('heart_products','gift_catalog','play_purchases','heart_accounts','heart_lots','heart_ledger','gift_transactions','gift_funding_allocations','creator_earning_accounts','creator_reward_positions','creator_reward_ledger','fan_progress','fan_memberships','purchase_reversal_events','creator_reward_liabilities') and data_type in ('real','double precision','numeric')),'financial storage uses integer types, not floating point or numeric');
select ok((select relrowsecurity from pg_class where oid='public.gift_transactions'::regclass),'gift transactions have RLS');
select ok((select relrowsecurity from pg_class where oid='private.heart_ledger'::regclass),'heart ledger has RLS defense in depth');
select ok(not has_schema_privilege('authenticated','private','usage'),'authenticated has no private schema usage');
select is((select count(*) from pg_policies where schemaname='storage' and tablename='objects' and cmd='UPDATE'),0::bigint,'Session 9 does not weaken Storage overwrite policy');

create temporary table purchase_500 as
select * from public.record_verified_play_purchase(
  '49000000-0000-0000-0000-000000000001','myfan_hearts_500',repeat('a',64),'GPA.TEST.500',
  encode(extensions.digest('49000000-0000-0000-0000-000000000001','sha256'),'hex'),'VN',true,
  '49100000-0000-0000-0000-000000000001',null
);
select is((select heart_units from purchase_500),50000::bigint,'verified 500-heart purchase credits 50000 units');
select is((select balance_after_units from purchase_500),50000::bigint,'purchase balance is 50000 units');
select is((select count(*) from private.heart_ledger where entry_type='purchase_credit'),1::bigint,'purchase writes one immutable heart ledger entry');
select is((select original_units from private.heart_lots where purchase_id=(select purchase_id from purchase_500)),50000::bigint,'purchase creates a funding lot');
select is((select already_recorded from public.record_verified_play_purchase('49000000-0000-0000-0000-000000000001','myfan_hearts_500',repeat('a',64),'GPA.TEST.500',encode(extensions.digest('49000000-0000-0000-0000-000000000001','sha256'),'hex'),'VN',true,'49100000-0000-0000-0000-000000000001',null)),true,'duplicate purchase verification is idempotent');
select is((select count(*) from private.play_purchases),1::bigint,'duplicate purchase does not create another row');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"49000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
create temporary table gift_one as select * from public.send_gift(
  '49000000-0000-0000-0000-000000000002',(select id from public.gift_catalog where display_hearts=1),1,
  '49200000-0000-0000-0000-000000000001',null,null
);
select is((select gross_heart_units from gift_one),100::bigint,'one-heart gift debits 100 units');
select is((select creator_reward_units from gift_one),70::bigint,'one-heart gift gives Creator 70 units');
select is((select platform_gross_units from gift_one),30::bigint,'one-heart gift gives platform 30 units');
select is((select sender_balance_units from gift_one),49900::bigint,'sender balance is debited atomically');
select ok((select reward_available_at between now()+interval '13 days 23 hours' and now()+interval '14 days 1 hour' from gift_one),'reward hold uses configured 14 days');
select is((select fan_status from gift_one),'none','100 eligible units does not reach 1000-unit Fan threshold');
select is((select already_processed from public.send_gift('49000000-0000-0000-0000-000000000002',(select id from public.gift_catalog where display_hearts=1),1,'49200000-0000-0000-0000-000000000001',null,null)),true,'duplicate gift request is idempotent');
select is((select count(*) from public.gift_transactions),1::bigint,'duplicate gift request creates one transaction');
select throws_ok($$select public.send_gift('49000000-0000-0000-0000-000000000001',(select id from public.gift_catalog where display_hearts=1),1,'49200000-0000-0000-0000-000000000002',null,null)$$,'22023','cannot_gift_self','self gifting is denied');
select throws_ok($$select public.send_gift('49000000-0000-0000-0000-000000000003',(select id from public.gift_catalog where display_hearts=1),1,'49200000-0000-0000-0000-000000000003',null,null)$$,'42501','approved_creator_required','pending Creator cannot receive a gift');
reset role;

insert into public.user_blocks(blocker_id,blocked_id) values('49000000-0000-0000-0000-000000000002','49000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"49000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.send_gift('49000000-0000-0000-0000-000000000002',(select id from public.gift_catalog where display_hearts=1),1,'49200000-0000-0000-0000-000000000004',null,null)$$,'42501','gifting_blocked','blocked users cannot gift');
reset role;
delete from public.user_blocks where blocker_id='49000000-0000-0000-0000-000000000002' and blocked_id='49000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"49000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
create temporary table gift_ten as select * from public.send_gift(
  '49000000-0000-0000-0000-000000000002',(select id from public.gift_catalog where display_hearts=10),1,
  '49200000-0000-0000-0000-000000000005',null,null
);
select is((select fan_eligible_units from gift_ten),1100::bigint,'Fan progress accumulates eligible gift units');
select is((select fan_status from gift_ten),'active','Fan membership activates at threshold');
select is((select count(*) from public.fan_memberships where creator_id='49000000-0000-0000-0000-000000000002' and fan_user_id='49000000-0000-0000-0000-000000000001' and status='active'),1::bigint,'authoritative Fan membership is created');
create temporary table gift_hundred as select * from public.send_gift(
  '49000000-0000-0000-0000-000000000002',(select id from public.gift_catalog where display_hearts=100),1,
  '49200000-0000-0000-0000-000000000006',null,null
);
select is((select creator_reward_units from gift_hundred),7000::bigint,'100-heart gift gives Creator 7000 units');
select is((select platform_gross_units from gift_hundred),3000::bigint,'100-heart gift gives platform 3000 units');
select is((select pending_units from private.creator_earning_accounts where creator_id='49000000-0000-0000-0000-000000000002'),7770::bigint,'Creator pending account equals exact integer rewards');
select is((select count(*) from private.creator_reward_ledger where entry_type='gift_reward_pending'),3::bigint,'each gift writes one Creator reward ledger entry');
select is((select count(*) from private.gift_funding_allocations),3::bigint,'gift spending is attributed to purchase lots');
select is((select available_units from private.heart_accounts where user_id='49000000-0000-0000-0000-000000000001'),38900::bigint,'balance conserves purchase minus gifts');
select is((select lifetime_spent_units from private.heart_accounts where user_id='49000000-0000-0000-0000-000000000001'),11100::bigint,'lifetime spent tracks all completed gifts');
reset role;

update public.gift_catalog set heart_price_units=200,display_hearts=2 where id=(select gift_id from public.gift_transactions where id=(select gift_transaction_id from gift_one));
select is((select unit_heart_units from public.gift_transactions where id=(select gift_transaction_id from gift_one)),100::bigint,'catalog price change does not mutate transaction snapshot');
select is((select gift_name_vi_snapshot from public.gift_transactions where id=(select gift_transaction_id from gift_one)),'Thích','gift name snapshot is immutable from catalog edits');
select throws_ok($$update private.heart_ledger set amount_units=999 where entry_type='gift_debit'$$,'42501','heart_ledger_is_immutable','heart ledger cannot be updated');
select throws_ok($$delete from private.creator_reward_ledger$$,'42501','creator_reward_ledger_is_immutable','Creator reward ledger cannot be deleted');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"49000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok($$insert into private.heart_ledger(user_id,entry_type,amount_units,balance_after_units,reference_type,idempotency_key) values('49000000-0000-0000-0000-000000000001','purchase_credit',100,100,'client_credit','49300000-0000-0000-0000-000000000001')$$,'42501',null,'client cannot credit hearts directly');
select throws_ok($$insert into private.creator_reward_ledger(creator_id,entry_type,amount_units,reference_type,idempotency_key) values('49000000-0000-0000-0000-000000000002','gift_reward_pending',70,'client_credit','49300000-0000-0000-0000-000000000002')$$,'42501',null,'client cannot credit Creator earnings directly');
select throws_ok($$insert into public.gift_transactions(sender_id,creator_id,gift_id,gift_slug_snapshot,gift_name_vi_snapshot,gift_name_en_snapshot,quantity,unit_heart_units,gross_heart_units,creator_share_bps,platform_share_bps,creator_reward_units,platform_gross_units,idempotency_key) values('49000000-0000-0000-0000-000000000001','49000000-0000-0000-0000-000000000002',(select id from public.gift_catalog limit 1),'fake','Fake','Fake',1,100,100,7000,3000,70,30,'49300000-0000-0000-0000-000000000003')$$,'42501',null,'client cannot insert gift transactions directly');
reset role;

select lives_ok($$update private.creator_reward_positions set available_at=now()-interval '1 second' where gift_transaction_id=(select gift_transaction_id from gift_one)$$,'test makes one reward due');
select is((select released_positions from public.release_due_creator_rewards(10)),1,'due reward release processes one position');
select is((select available_units from private.creator_earning_accounts where creator_id='49000000-0000-0000-0000-000000000002'),70::bigint,'release moves reward into available balance');
select is((select pending_units from private.creator_earning_accounts where creator_id='49000000-0000-0000-0000-000000000002'),7700::bigint,'release removes reward from pending balance');

create temporary table reversal as select * from public.reverse_play_purchase(repeat('a',64),'refund','49400000-0000-0000-0000-000000000001','google_refund');
select is((select purchase_state from reversal),'refunded','purchase becomes refunded without deleting history');
select is((select unspent_debited_units from reversal),38900::bigint,'refund debits all unspent units from purchase lot');
select is((select spent_reversed_units from reversal),11100::bigint,'refund reverses all spent units attributed to purchase');
select is((select creator_reward_reversed_units from reversal),7770::bigint,'refund reverses exact Creator reward attribution');
select is((select available_units from private.heart_accounts where user_id='49000000-0000-0000-0000-000000000001'),0::bigint,'refund leaves no purchased hearts available');
select is((select status::text from public.fan_memberships where creator_id='49000000-0000-0000-0000-000000000002' and fan_user_id='49000000-0000-0000-0000-000000000001'),'revoked','refund revokes Fan membership when eligible support falls below threshold');
select is((select count(*) from private.play_purchases),1::bigint,'refund preserves purchase row');
select is((select count(*) from private.purchase_reversal_events),1::bigint,'refund creates immutable reversal event');
select is((select already_processed from public.reverse_play_purchase(repeat('a',64),'refund','49400000-0000-0000-0000-000000000001','google_refund')),true,'refund retry is idempotent');
select is((select count(*) from private.purchase_reversal_events),1::bigint,'refund retry creates no duplicate event');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"49000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.send_gift('49000000-0000-0000-0000-000000000002',(select id from public.gift_catalog where display_hearts=2 order by sort_order limit 1),1,'49500000-0000-0000-0000-000000000001',null,null)$$,'22003','insufficient_heart_balance','user cannot gift beyond available balance');
reset role;
select ok(not exists(select 1 from public.gift_transactions where creator_reward_units+platform_gross_units<>gross_heart_units),'all completed and reversed gifts preserve integer split');
select ok(not exists(select 1 from private.heart_accounts where available_units<0 or held_units<0),'heart account balances never become negative');
select is((select count(*) from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename in ('gift_transactions','fan_progress','fan_memberships','economy_sync')),4::bigint,'Realtime publishes only safe economy metadata tables');
select ok(position('for update' in lower(pg_get_functiondef('public.send_gift(uuid,uuid,integer,uuid,uuid,uuid)'::regprocedure)))>0,'send_gift includes row locking');
select ok(position('pg_advisory_xact_lock' in lower(pg_get_functiondef('public.send_gift(uuid,uuid,integer,uuid,uuid,uuid)'::regprocedure)))>0,'send_gift includes idempotency advisory locking');

select * from finish();
rollback;
