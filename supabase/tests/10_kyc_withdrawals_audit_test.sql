begin;
select plan(66);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change_token_current,phone_change,phone_change_token,reauthentication_token) values
('00000000-0000-0000-0000-000000000000','4b000000-0000-0000-0000-000000000001','authenticated','authenticated','payout-sender@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','4b000000-0000-0000-0000-000000000002','authenticated','authenticated','payout-creator@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','4b000000-0000-0000-0000-000000000003','authenticated','authenticated','payout-noncreator@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','4b000000-0000-0000-0000-000000000004','authenticated','authenticated','payout-finance@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','4b000000-0000-0000-0000-000000000005','authenticated','authenticated','payout-moderator@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','4b000000-0000-0000-0000-000000000006','authenticated','authenticated','deletion-user@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','4b000000-0000-0000-0000-000000000007','authenticated','authenticated','payout-super@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

update private.user_identity set date_of_birth=(current_date-interval '30 years')::date,age_verified_at=now(),age_verification_method='self_declared',terms_version='2026-07',terms_accepted_at=now(),community_rules_version='2026-07',community_rules_accepted_at=now(),account_status='active'
where user_id::text like '4b000000-0000-0000-0000-00000000000%';
update public.profiles set profile_status='active',username='payout_'||right(id::text,1),display_name='Payout test',discovery_enabled=true,nearby_enabled=true
where id::text like '4b000000-0000-0000-0000-00000000000%';
insert into public.creator_profiles(user_id,creator_status,creator_bio,fan_threshold_units,payout_eligible,approved_at)
values('4b000000-0000-0000-0000-000000000002','approved','Payout Creator',1000,false,now());
insert into private.user_roles(user_id,role,granted_by) values
('4b000000-0000-0000-0000-000000000002','creator','4b000000-0000-0000-0000-000000000007'),
('4b000000-0000-0000-0000-000000000004','finance_admin','4b000000-0000-0000-0000-000000000007'),
('4b000000-0000-0000-0000-000000000005','moderator','4b000000-0000-0000-0000-000000000007'),
('4b000000-0000-0000-0000-000000000007','super_admin','4b000000-0000-0000-0000-000000000007');

select ok((select relrowsecurity from pg_class where oid='private.kyc_profiles'::regclass),'KYC profiles have RLS defense in depth');
select ok((select relrowsecurity from pg_class where oid='private.bank_accounts'::regclass),'bank accounts have RLS defense in depth');
select ok((select relrowsecurity from pg_class where oid='private.withdrawals'::regclass),'withdrawals have RLS defense in depth');
select ok((select relrowsecurity from pg_class where oid='private.admin_audit_logs'::regclass),'audit log has RLS defense in depth');
select ok(not has_schema_privilege('authenticated','private','usage'),'authenticated cannot use private schema');
select is((select count(*) from pg_policies where schemaname='storage' and tablename='objects' and cmd='SELECT' and coalesce(qual,'') like '%kyc-private%'),0::bigint,'KYC bucket has no client SELECT policy');
select is((select count(*) from pg_policies where schemaname='storage' and tablename='objects' and cmd='UPDATE'),0::bigint,'KYC flow does not enable Storage overwrite');
select is((select count(*) from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='payout_sync'),1::bigint,'Realtime publishes only payout invalidation metadata');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"4b000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
create temporary table prepared_kyc as select * from public.prepare_kyc_document_upload('image/jpeg',2048,'front',1200,800,repeat('c',64),'jpg');
select is((select storage_bucket from prepared_kyc),'kyc-private','KYC upload is prepared only in private bucket');
select ok((select storage_path like '4b000000-0000-0000-0000-000000000002/%/original.jpg' from prepared_kyc),'KYC path is immutable owner/media path');
select lives_ok($$insert into storage.objects(bucket_id,name,owner_id,metadata) select storage_bucket,storage_path,'4b000000-0000-0000-0000-000000000002','{"mimetype":"image/jpeg","size":2048}'::jsonb from prepared_kyc$$,'Creator uploads only the prepared KYC path');
create temporary table finalized_kyc as select * from public.finalize_kyc_document_upload((select media_id from prepared_kyc),'front');
select is((select status from finalized_kyc),'uploaded','finalized KYC document is registered server-side');
select is((select count(*) from storage.objects where bucket_id='kyc-private'),0::bigint,'Creator cannot directly list the uploaded KYC object');
reset role;

create temporary table submitted_kyc as select * from public.server_submit_kyc_profile(
  '4b000000-0000-0000-0000-000000000002','v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBB','national_id','v1.CCCCCCCCCCCCCCCC.DDDDDDDDDDDDDDDD','9Z8Y','VN',array[(select kyc_document_id from finalized_kyc)],'4b100000-0000-0000-0000-000000000001'
);
select is((select status from submitted_kyc),'pending','encrypted KYC submission enters pending review');
select is((select already_processed from public.server_submit_kyc_profile('4b000000-0000-0000-0000-000000000002','v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBB','national_id','v1.CCCCCCCCCCCCCCCC.DDDDDDDDDDDDDDDD','9Z8Y','VN',array[(select kyc_document_id from finalized_kyc)],'4b100000-0000-0000-0000-000000000001')),true,'KYC submission is idempotent');
select is((select count(*) from private.admin_audit_logs where action='kyc_submitted'),1::bigint,'KYC submission writes one redacted audit event');

create temporary table submitted_bank as select * from public.server_upsert_bank_account(
  '4b000000-0000-0000-0000-000000000002',null,'VCB','v1.EEEEEEEEEEEEEEEE.FFFFFFFFFFFFFFFF','1234','v1.GGGGGGGGGGGGGGGG.HHHHHHHHHHHHHHHH',true,'4b100000-0000-0000-0000-000000000002'
);
select is((select status from submitted_bank),'pending','encrypted bank account enters pending review');
select is((select account_number_last4 from submitted_bank),'1234','client contract returns only bank last four');
select is((select already_processed from public.server_upsert_bank_account('4b000000-0000-0000-0000-000000000002',null,'VCB','v1.EEEEEEEEEEEEEEEE.FFFFFFFFFFFFFFFF','1234','v1.GGGGGGGGGGGGGGGG.HHHHHHHHHHHHHHHH',true,'4b100000-0000-0000-0000-000000000002')),true,'bank submission is idempotent');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"4b000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select throws_ok($$select * from private.kyc_profiles$$,'42501',null,'another user cannot read private KYC');
select throws_ok($$select * from private.bank_accounts$$,'42501',null,'another user cannot read private bank accounts');
select throws_ok($$select public.request_withdrawal('00000000-0000-0000-0000-000000000000',1000,'4b200000-0000-0000-0000-000000000001')$$,'42501','approved_creator_required','non-Creator cannot request withdrawal');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"4b000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.request_withdrawal((select bank_account_id from submitted_bank),1000,'4b200000-0000-0000-0000-000000000002')$$,'42501','approved_kyc_required','Creator without approved KYC cannot withdraw');
reset role;

create temporary table approved_kyc as select * from public.admin_review_kyc('4b000000-0000-0000-0000-000000000004',(select kyc_profile_id from submitted_kyc),'approve',null,now()+interval '5 years','4b300000-0000-0000-0000-000000000001');
select is((select status from approved_kyc),'approved','finance admin approves KYC');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"4b000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.request_withdrawal((select bank_account_id from submitted_bank),1000,'4b200000-0000-0000-0000-000000000003')$$,'42501','verified_bank_account_required','unverified bank account cannot receive withdrawal');
reset role;

create temporary table verified_bank as select * from public.admin_review_bank_account('4b000000-0000-0000-0000-000000000004',(select bank_account_id from submitted_bank),'verify',null,'4b300000-0000-0000-0000-000000000002');
select is((select status from verified_bank),'verified','finance admin verifies bank account');
select is((select payout_eligible from verified_bank),true,'approved KYC and verified bank enable payout eligibility');

select * from public.record_verified_play_purchase('4b000000-0000-0000-0000-000000000001','myfan_hearts_020',repeat('d',64),'GPA.PAYOUT.20',encode(extensions.digest('4b000000-0000-0000-0000-000000000001','sha256'),'hex'),'VN',true,'4b400000-0000-0000-0000-000000000001',null);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"4b000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
create temporary table payout_gift as select * from public.send_gift('4b000000-0000-0000-0000-000000000002',(select id from public.gift_catalog where display_hearts=20),1,'4b400000-0000-0000-0000-000000000002',null,null);
reset role;
update private.creator_reward_positions set available_at=now()-interval '1 second' where gift_transaction_id=(select gift_transaction_id from payout_gift);
select is((select released_units from public.release_due_creator_rewards(10)),1400::bigint,'gift reward releases 1400 units to Creator');
select is((select available_units from private.creator_earning_accounts where creator_id='4b000000-0000-0000-0000-000000000002'),1400::bigint,'Creator has exact available reward balance');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"4b000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.request_withdrawal((select bank_account_id from submitted_bank),999,'4b500000-0000-0000-0000-000000000001')$$,'22023','withdrawal_below_minimum','withdrawal below configured minimum is rejected');
create temporary table withdrawal_one as select * from public.request_withdrawal((select bank_account_id from submitted_bank),1000,'4b500000-0000-0000-0000-000000000002');
select is((select amount_vnd from withdrawal_one),100000::bigint,'withdrawal snapshots integer VND conversion');
select is((select held_balance_units from withdrawal_one),1000::bigint,'withdrawal request moves available reward to held');
select is((select already_processed from public.request_withdrawal((select bank_account_id from submitted_bank),1000,'4b500000-0000-0000-0000-000000000002')),true,'withdrawal request is idempotent');
reset role;
select is((select available_units from private.creator_earning_accounts where creator_id='4b000000-0000-0000-0000-000000000002'),400::bigint,'available balance decreases after hold');
select is((select count(*) from private.creator_reward_ledger where entry_type='withdrawal_hold'),1::bigint,'withdrawal hold writes immutable reward ledger entry');

create temporary table rejected_withdrawal as select * from public.admin_decide_withdrawal('4b000000-0000-0000-0000-000000000004',(select withdrawal_id from withdrawal_one),'reject','manual_review_failed',null,'4b600000-0000-0000-0000-000000000001');
select is((select status from rejected_withdrawal),'rejected','finance admin rejects withdrawal');
select is((select available_units from private.creator_earning_accounts where creator_id='4b000000-0000-0000-0000-000000000002'),1400::bigint,'rejection releases held reward to available');
select is((select count(*) from private.creator_reward_ledger where entry_type='withdrawal_released'),1::bigint,'rejection writes release ledger entry');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"4b000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
create temporary table withdrawal_two as select * from public.request_withdrawal((select bank_account_id from submitted_bank),1000,'4b500000-0000-0000-0000-000000000003');
reset role;
select throws_ok($$select public.admin_decide_withdrawal('4b000000-0000-0000-0000-000000000005',(select withdrawal_id from withdrawal_two),'approve',null,null,'4b600000-0000-0000-0000-000000000002')$$,'42501','required_admin_role_missing','moderator cannot approve or pay withdrawal');
select is((select status from public.admin_decide_withdrawal('4b000000-0000-0000-0000-000000000004',(select withdrawal_id from withdrawal_two),'approve',null,null,'4b600000-0000-0000-0000-000000000003')),'approved','finance admin approves without marking paid');
select is((select status from public.admin_decide_withdrawal('4b000000-0000-0000-0000-000000000004',(select withdrawal_id from withdrawal_two),'processing',null,null,'4b600000-0000-0000-0000-000000000004')),'processing','approved withdrawal enters manual processing');
create temporary table paid_withdrawal as select * from public.admin_decide_withdrawal('4b000000-0000-0000-0000-000000000004',(select withdrawal_id from withdrawal_two),'paid',null,'BANK-REF-001','4b600000-0000-0000-0000-000000000005');
select is((select status from paid_withdrawal),'paid','finance admin marks manual transfer paid');
select is((select paid_balance_units from paid_withdrawal),1000::bigint,'paid action increases Creator paid total once');
select is((select already_processed from public.admin_decide_withdrawal('4b000000-0000-0000-0000-000000000004',(select withdrawal_id from withdrawal_two),'paid',null,'BANK-REF-001','4b600000-0000-0000-0000-000000000005')),true,'duplicate paid action is idempotent');
select is((select count(*) from private.creator_reward_ledger where entry_type='withdrawal_paid'),1::bigint,'double payout does not create another paid ledger entry');

create temporary table hold_one as select * from public.admin_create_account_hold('4b000000-0000-0000-0000-000000000004','4b000000-0000-0000-0000-000000000002','manual_review','withdrawal','risk_review',now()+interval '1 day','4b700000-0000-0000-0000-000000000001');
select is((select payout_eligible from public.creator_profiles where user_id='4b000000-0000-0000-0000-000000000002'),false,'active financial hold disables payout eligibility');
select lives_ok($$select public.admin_release_account_hold('4b000000-0000-0000-0000-000000000004',(select hold_id from hold_one),'review_complete','4b700000-0000-0000-0000-000000000002')$$,'finance admin releases account hold with audit');
select is((select payout_eligible from public.creator_profiles where user_id='4b000000-0000-0000-0000-000000000002'),true,'payout eligibility refreshes after hold release');

select is((select legal_name_ciphertext from public.server_get_kyc_review_payload('4b000000-0000-0000-0000-000000000004',(select kyc_profile_id from submitted_kyc),'4b800000-0000-0000-0000-000000000001')),'v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBB','sensitive KYC review is server-only and audited');
select is((select account_number_last4 from public.server_get_bank_review_payload('4b000000-0000-0000-0000-000000000004',(select bank_account_id from submitted_bank),'4b800000-0000-0000-0000-000000000002')),'1234','sensitive bank review returns expected server payload');
select is((select storage_bucket from public.server_authorize_kyc_document_access('4b000000-0000-0000-0000-000000000004',(select kyc_document_id from finalized_kyc),'4b800000-0000-0000-0000-000000000003')),'kyc-private','KYC signed URL authorization is audited and private');
select ok(not exists(select 1 from private.admin_audit_logs where before_json::text like '%AAAAAAAA%' or after_json::text like '%AAAAAAAA%' or before_json::text like '%EEEEEEEE%' or after_json::text like '%EEEEEEEE%'),'audit JSON never contains full encrypted identity or bank payloads');
select throws_ok($$update private.admin_audit_logs set reason='tamper' where action='kyc_submitted'$$,'42501','admin_audit_logs_are_immutable','admin audit log cannot be updated');
select throws_ok($$delete from private.admin_audit_logs where action='bank_account_submitted'$$,'42501','admin_audit_logs_are_immutable','admin audit log cannot be deleted');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"4b000000-0000-0000-0000-000000000006","role":"authenticated"}',true);
create temporary table deletion_one as select * from public.request_account_deletion('privacy request','4b900000-0000-0000-0000-000000000001');
select is((select status from deletion_one),'scheduled','account deletion is scheduled after grace period');
select is((select profile_status::text from public.profiles where id='4b000000-0000-0000-0000-000000000006'),'deactivated','deletion request immediately deactivates profile');
select ok((select not discovery_enabled and not nearby_enabled from public.profiles where id='4b000000-0000-0000-0000-000000000006'),'deletion request immediately disables discovery and Nearby');
select is((select status from public.get_my_account_deletion_status()),'scheduled','all clients read the same deletion lifecycle status');
select is((select status from public.cancel_account_deletion((select deletion_request_id from deletion_one),'4b900000-0000-0000-0000-000000000002')),'cancelled','user can cancel during grace period');
select is((select profile_status::text from public.profiles where id='4b000000-0000-0000-0000-000000000006'),'active','cancellation restores previous profile state');
create temporary table deletion_two as select * from public.request_account_deletion('final privacy request','4b900000-0000-0000-0000-000000000003');
reset role;
select is((select status from public.admin_process_account_deletion('4b000000-0000-0000-0000-000000000007',(select deletion_request_id from deletion_two),'start','grace_complete','4b900000-0000-0000-0000-000000000004')),'processing','super admin starts deletion after operational checks');
select is((select status from public.admin_process_account_deletion('4b000000-0000-0000-0000-000000000007',(select deletion_request_id from deletion_two),'complete','retention_applied','4b900000-0000-0000-0000-000000000005')),'completed','super admin completes anonymization lifecycle');
select is((select profile_status::text from public.profiles where id='4b000000-0000-0000-0000-000000000006'),'deleted','completed deletion anonymizes and marks profile deleted');
select is((select count(*) from auth.users where id='4b000000-0000-0000-0000-000000000006'),1::bigint,'financial retention design does not physically delete Auth row in database migration');
select is((select count(*) from private.creator_reward_ledger where creator_id='4b000000-0000-0000-0000-000000000002'),6::bigint,'Creator financial ledger remains after unrelated deletion lifecycle');
select is((select count(*) from private.admin_audit_logs where action like 'account_deletion_%'),5::bigint,'account deletion request, cancellation and processing are audited');

select * from finish();
rollback;
