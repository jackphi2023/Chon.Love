begin;

select plan(47);

select ok(to_regclass('private.payout_operation_events') is not null,'payout operation event ledger exists');
select ok(exists(select 1 from information_schema.columns where table_schema='private' and table_name='withdrawals' and column_name='approved_by'),'withdrawals track the approving operator');
select ok(exists(select 1 from information_schema.columns where table_schema='private' and table_name='withdrawals' and column_name='processing_started_by'),'withdrawals track the processing operator');
select ok(exists(select 1 from information_schema.columns where table_schema='private' and table_name='withdrawals' and column_name='payment_evidence_sha256'),'withdrawals require payout evidence hash');

select is((select value_json#>>'{}' from private.app_config where key='kyc_operational_review_enabled'),'true','OPT-13 enables payout KYC review');
select is((select value_json#>>'{}' from private.app_config where key='bank_account_operational_review_enabled'),'true','OPT-13 enables bank review');
select is((select value_json#>>'{}' from private.app_config where key='withdrawal_requests_enabled'),'true','OPT-12 enables guarded user withdrawal requests');
select is((select value_json#>>'{}' from private.app_config where key='withdrawal_operational_review_enabled'),'true','OPT-13 enables withdrawal review');
select is((select value_json#>>'{}' from private.app_config where key='withdrawal_processing_enabled'),'true','OPT-13 enables maker-checker processing');
select is((select value_json#>>'{}' from private.app_config where key='withdrawal_payout_enabled'),'true','OPT-13 enables evidence-backed payout recording');

select ok(not has_function_privilege('authenticated','public.prepare_kyc_document_upload(text,bigint,text,integer,integer,text,text)','EXECUTE'),'authenticated users still cannot use legacy KYC document upload RPCs');
select ok(not has_function_privilege('authenticated','public.finalize_kyc_document_upload(uuid,text)','EXECUTE'),'authenticated users still cannot finalize legacy KYC document uploads');
select ok(has_function_privilege('authenticated','public.request_withdrawal(uuid,bigint,uuid)','EXECUTE'),'authenticated users can request withdrawals after OPT-12 release');
select ok(not has_function_privilege('service_role','public.admin_decide_withdrawal(uuid,uuid,text,text,text,uuid)','EXECUTE'),'legacy single-control withdrawal decision is revoked');
select ok(has_function_privilege('service_role','public.admin_operate_withdrawal(uuid,uuid,text,text,text,text,uuid)','EXECUTE'),'service role can call the audited operational withdrawal RPC');
select ok(not has_function_privilege('authenticated','public.admin_operate_withdrawal(uuid,uuid,text,text,text,text,uuid)','EXECUTE'),'authenticated clients cannot call the operational withdrawal RPC');
select ok(not has_schema_privilege('authenticated','private','USAGE'),'authenticated clients retain no private schema usage');
select ok(not exists(select 1 from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema='private'),'client roles retain no private table grants');

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
  confirmation_token,recovery_token,email_change_token_new,email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
('00000000-0000-0000-0000-000000000000','8c000000-0000-0000-0000-000000000001','authenticated','authenticated','br08-creator@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','8c000000-0000-0000-0000-000000000002','authenticated','authenticated','br08-reviewer-one@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','8c000000-0000-0000-0000-000000000003','authenticated','authenticated','br08-reviewer-two@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','8c000000-0000-0000-0000-000000000004','authenticated','authenticated','br08-outsider@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

update private.user_identity set
  date_of_birth=(current_date-interval '30 years')::date,
  age_verified_at=now(),age_verification_method='self_declared',
  terms_version=(select value_json#>>'{}' from private.app_config where key='terms_version_current'),terms_accepted_at=now(),
  community_rules_version=(select value_json#>>'{}' from private.app_config where key='community_rules_version_current'),community_rules_accepted_at=now(),
  account_status='active'
where user_id::text like '8c000000-0000-0000-0000-00000000000%';

update public.profiles set profile_status='active',province_id=1,
  username=case id
    when '8c000000-0000-0000-0000-000000000001' then 'br08_creator'
    when '8c000000-0000-0000-0000-000000000002' then 'br08_reviewer_one'
    when '8c000000-0000-0000-0000-000000000003' then 'br08_reviewer_two'
    else 'br08_outsider' end,
  display_name=case id
    when '8c000000-0000-0000-0000-000000000001' then 'BR08 Creator'
    when '8c000000-0000-0000-0000-000000000002' then 'BR08 Reviewer One'
    when '8c000000-0000-0000-0000-000000000003' then 'BR08 Reviewer Two'
    else 'BR08 Outsider' end
where id::text like '8c000000-0000-0000-0000-00000000000%';

update public.profiles set is_creator=true where id='8c000000-0000-0000-0000-000000000001';
insert into public.creator_profiles(user_id,creator_status,creator_bio,fan_threshold_units,approved_at)
values('8c000000-0000-0000-0000-000000000001','approved','BR08 payout fixture',1000,now());

insert into private.user_roles(user_id,role,granted_by) values
('8c000000-0000-0000-0000-000000000002','finance_admin','8c000000-0000-0000-0000-000000000002'),
('8c000000-0000-0000-0000-000000000003','finance_admin','8c000000-0000-0000-0000-000000000003');

insert into private.kyc_profiles(
  id,user_id,legal_name_ciphertext,document_type,document_number_ciphertext,document_number_last4,country_code,status,
  submission_request_id,submitted_at
) values(
  '8c100000-0000-4000-8000-000000000001','8c000000-0000-0000-0000-000000000001',
  'v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBB','national_id','v1.CCCCCCCCCCCCCCCC.DDDDDDDDDDDDDDDD','1234','VN','pending',
  '8c110000-0000-4000-8000-000000000001',now()-interval '2 hours'
);

insert into private.bank_accounts(
  id,user_id,bank_code,account_number_ciphertext,account_number_last4,account_holder_ciphertext,status,is_default,submission_request_id
) values(
  '8c200000-0000-4000-8000-000000000001','8c000000-0000-0000-0000-000000000001','VCB',
  'v1.EEEEEEEEEEEEEEEE.FFFFFFFFFFFFFFFF','1234','v1.GGGGGGGGGGGGGGGG.HHHHHHHHHHHHHHHH','pending',true,
  '8c210000-0000-4000-8000-000000000001'
);

insert into private.creator_earning_accounts(creator_id,held_units,available_units,paid_units)
values('8c000000-0000-0000-0000-000000000001',1000,0,0)
on conflict(creator_id) do update set held_units=1000,available_units=0,paid_units=0,is_frozen=false;

insert into private.withdrawals(
  id,creator_id,bank_account_id,requested_reward_units,amount_vnd,heart_vnd_rate_snapshot,heart_units_per_heart_snapshot,
  bank_code_snapshot,bank_account_last4_snapshot,bank_account_holder_ciphertext_snapshot,status,idempotency_key
) values(
  '8c300000-0000-4000-8000-000000000001','8c000000-0000-0000-0000-000000000001','8c200000-0000-4000-8000-000000000001',
  1000,500000,50000,100,'VCB','1234','v1.GGGGGGGGGGGGGGGG.HHHHHHHHHHHHHHHH','pending','8c310000-0000-4000-8000-000000000001'
);

select throws_ok(
  $$select * from public.admin_list_kyc_operational_queue('8c000000-0000-0000-0000-000000000004',null,20,0)$$,
  '42501','required_admin_role_missing','only finance_admin or super_admin can list KYC cases'
);

-- Prove the emergency switches still fail closed even though OPT-13 intentionally releases them.
update private.app_config set value_json='false'::jsonb
where key in ('kyc_operational_review_enabled','withdrawal_operational_review_enabled');
select throws_ok(
  $$select * from public.admin_start_kyc_review('8c000000-0000-0000-0000-000000000002','8c100000-0000-4000-8000-000000000001','8c400000-0000-4000-8000-000000000001')$$,
  '55000','kyc_operational_review_enabled_disabled','KYC review fails closed when its emergency switch is disabled'
);
select throws_ok(
  $$select * from public.admin_start_withdrawal_review('8c000000-0000-0000-0000-000000000002','8c300000-0000-4000-8000-000000000001','8c400000-0000-4000-8000-000000000002')$$,
  '55000','withdrawal_operational_review_enabled_disabled','withdrawal review fails closed when its emergency switch is disabled'
);

update private.app_config set value_json='true'::jsonb
where key in ('kyc_operational_review_enabled','bank_account_operational_review_enabled','withdrawal_operational_review_enabled');

select ok(exists(select 1 from public.admin_list_kyc_operational_queue('8c000000-0000-0000-0000-000000000002','pending',20,0) where kyc_profile_id='8c100000-0000-4000-8000-000000000001'),'KYC queue returns the pending fixture');
select ok(exists(select 1 from public.admin_list_bank_operational_queue('8c000000-0000-0000-0000-000000000002','pending',20,0) where bank_account_id='8c200000-0000-4000-8000-000000000001'),'bank queue returns the pending fixture');
select ok(exists(select 1 from public.admin_list_withdrawal_operational_queue('8c000000-0000-0000-0000-000000000002','pending',20,0) where withdrawal_id='8c300000-0000-4000-8000-000000000001'),'withdrawal queue returns the pending fixture');

select is((select assigned_to from public.admin_start_kyc_review(
  '8c000000-0000-0000-0000-000000000002','8c100000-0000-4000-8000-000000000001','8c400000-0000-4000-8000-000000000003')),
  '8c000000-0000-0000-0000-000000000002'::uuid,'reviewer one claims the KYC case');
select is((select assigned_to from public.admin_start_bank_review(
  '8c000000-0000-0000-0000-000000000002','8c200000-0000-4000-8000-000000000001','8c400000-0000-4000-8000-000000000004')),
  '8c000000-0000-0000-0000-000000000002'::uuid,'reviewer one claims the bank case');
select is((select status from public.admin_start_withdrawal_review(
  '8c000000-0000-0000-0000-000000000002','8c300000-0000-4000-8000-000000000001','8c400000-0000-4000-8000-000000000005')),
  'under_review','withdrawal enters under_review when claimed');

select throws_ok(
  $$select * from public.server_get_kyc_review_payload('8c000000-0000-0000-0000-000000000003','8c100000-0000-4000-8000-000000000001','8c400000-0000-4000-8000-000000000006')$$,
  '42501','kyc_review_assignment_required','a different finance operator cannot view assigned KYC PII'
);
select is((select status from public.server_get_kyc_review_payload(
  '8c000000-0000-0000-0000-000000000002','8c100000-0000-4000-8000-000000000001','8c400000-0000-4000-8000-000000000007')),
  'pending','assigned reviewer can access the encrypted KYC payload through the audited server RPC');
select is((select status from public.server_get_bank_review_payload(
  '8c000000-0000-0000-0000-000000000002','8c200000-0000-4000-8000-000000000001','8c400000-0000-4000-8000-000000000008')),
  'pending','assigned reviewer can access the encrypted bank payload through the audited server RPC');

select is((select status from public.admin_review_kyc(
  '8c000000-0000-0000-0000-000000000002','8c100000-0000-4000-8000-000000000001','approve',null,now()+interval '1 year',
  '8c400000-0000-4000-8000-000000000009')),
  'approved','assigned reviewer approves the KYC case');
select is((select status from public.admin_review_bank_account(
  '8c000000-0000-0000-0000-000000000002','8c200000-0000-4000-8000-000000000001','verify',null,
  '8c400000-0000-4000-8000-000000000010')),
  'verified','assigned reviewer verifies the bank account');
select ok((select payout_eligible from public.creator_profiles where user_id='8c000000-0000-0000-0000-000000000001'),'approved KYC and verified bank account make the Creator payout eligible');

select is((select status from public.admin_operate_withdrawal(
  '8c000000-0000-0000-0000-000000000002','8c300000-0000-4000-8000-000000000001','approve',null,null,null,
  '8c500000-0000-4000-8000-000000000001')),
  'approved','assigned reviewer approves the withdrawal');

update private.app_config set value_json='false'::jsonb where key='withdrawal_processing_enabled';
select throws_ok(
  $$select * from public.admin_operate_withdrawal('8c000000-0000-0000-0000-000000000003','8c300000-0000-4000-8000-000000000001','start_processing',null,null,null,'8c500000-0000-4000-8000-000000000002')$$,
  '55000','withdrawal_processing_enabled_disabled','processing fails closed when its emergency switch is disabled'
);

update private.app_config set value_json='true'::jsonb where key='withdrawal_processing_enabled';
select throws_ok(
  $$select * from public.admin_operate_withdrawal('8c000000-0000-0000-0000-000000000002','8c300000-0000-4000-8000-000000000001','start_processing',null,null,null,'8c500000-0000-4000-8000-000000000003')$$,
  '42501','withdrawal_dual_control_required','the approving operator cannot start payout processing'
);
select is((select status from public.admin_operate_withdrawal(
  '8c000000-0000-0000-0000-000000000003','8c300000-0000-4000-8000-000000000001','start_processing',null,null,null,
  '8c500000-0000-4000-8000-000000000004')),
  'processing','a second finance operator starts payout processing');

update private.app_config set value_json='false'::jsonb where key='withdrawal_payout_enabled';
select throws_ok(
  $$select * from public.admin_operate_withdrawal('8c000000-0000-0000-0000-000000000003','8c300000-0000-4000-8000-000000000001','mark_paid',null,'BANK-REF-001',repeat('a',64),'8c500000-0000-4000-8000-000000000005')$$,
  '55000','withdrawal_payout_enabled_disabled','payout recording fails closed when its emergency switch is disabled'
);
update private.app_config set value_json='true'::jsonb where key='withdrawal_payout_enabled';
select throws_ok(
  $$select * from public.admin_operate_withdrawal('8c000000-0000-0000-0000-000000000003','8c300000-0000-4000-8000-000000000001','mark_paid',null,'BANK-REF-001',null,'8c500000-0000-4000-8000-000000000006')$$,
  '22023','payment_evidence_sha256_required','marking paid requires payment evidence hash'
);
select is((select status from public.admin_operate_withdrawal(
  '8c000000-0000-0000-0000-000000000003','8c300000-0000-4000-8000-000000000001','mark_paid',null,'BANK-REF-001',repeat('a',64),
  '8c500000-0000-4000-8000-000000000007')),
  'paid','second finance operator records verified manual payout');
select is((select approved_by from private.withdrawals where id='8c300000-0000-4000-8000-000000000001'),
  '8c000000-0000-0000-0000-000000000002'::uuid,'withdrawal retains the maker identity');
select is((select payment_recorded_by from private.withdrawals where id='8c300000-0000-4000-8000-000000000001'),
  '8c000000-0000-0000-0000-000000000003'::uuid,'withdrawal records a distinct checker identity');
select is((select paid_units from private.creator_earning_accounts where creator_id='8c000000-0000-0000-0000-000000000001'),1000::bigint,'paid reward units move from held to paid once');
select ok((select already_processed from public.admin_operate_withdrawal(
  '8c000000-0000-0000-0000-000000000003','8c300000-0000-4000-8000-000000000001','mark_paid',null,'BANK-REF-001',repeat('a',64),
  '8c500000-0000-4000-8000-000000000007')),'repeating the payout request is idempotent');
select is((select count(*)::integer from private.creator_reward_ledger where reference_type='withdrawal' and reference_id='8c300000-0000-4000-8000-000000000001' and entry_type='withdrawal_paid'),1,'idempotent payout retry does not duplicate reward ledger entries');

select throws_ok(
  $$update private.payout_operation_events set metadata_json='{}'::jsonb where entity_id='8c300000-0000-4000-8000-000000000001'$$,
  '42501','payout_operation_events_are_immutable','payout operation events cannot be updated'
);
select throws_ok(
  $$delete from private.payout_operation_events where entity_id='8c300000-0000-4000-8000-000000000001'$$,
  '42501','payout_operation_events_are_immutable','payout operation events cannot be deleted'
);

select * from finish();
rollback;
