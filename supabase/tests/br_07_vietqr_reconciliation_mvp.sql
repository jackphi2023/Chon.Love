begin;

select plan(34);

select ok(to_regclass('private.vietqr_bank_transactions') is not null,'VietQR bank transaction inbox exists');
select ok(to_regclass('private.vietqr_reconciliation_events') is not null,'VietQR reconciliation event ledger exists');
select is((select value_json#>>'{}' from private.app_config where key='vietqr_reconciliation_enabled'),'false','reconciliation is disabled by default');
select is((select value_json#>>'{}' from private.app_config where key='vietqr_manual_settlement_enabled'),'false','manual settlement is disabled by default');
select is((select value_json#>>'{}' from private.app_config where key='vietqr_auto_settlement_enabled'),'false','automatic settlement remains disabled');
select is((select value_json#>>'{}' from private.app_config where key='vietqr_web_payments_enabled'),'false','VietQR heart ordering is disabled at the database boundary');
select ok(not has_function_privilege('authenticated','public.create_vietqr_heart_order(uuid,uuid)','EXECUTE'),'authenticated users cannot create VietQR heart orders');
select ok(not has_function_privilege('authenticated','public.list_vietqr_heart_products()','EXECUTE'),'authenticated users cannot list VietQR heart products');
select ok(not has_function_privilege('authenticated','public.mark_my_vietqr_transfer_submitted(uuid)','EXECUTE'),'authenticated users cannot submit VietQR transfers');
select ok(not has_function_privilege('service_role','public.record_verified_vietqr_payment(uuid,text,bigint,uuid)','EXECUTE'),'service role cannot bypass reconciliation to credit hearts directly');
select ok(has_function_privilege('service_role','public.admin_import_vietqr_bank_transaction(uuid,text,text,bigint,text,timestamptz,text,uuid)','EXECUTE'),'service role can call the audited import RPC');
select ok(has_function_privilege('service_role','public.admin_list_vietqr_reconciliation_queue(uuid,text,integer,integer)','EXECUTE'),'service role can call the finance queue RPC');
select ok(has_function_privilege('service_role','public.admin_decide_vietqr_reconciliation(uuid,uuid,text,uuid,text,uuid)','EXECUTE'),'service role can call the audited decision RPC');
select ok(not has_function_privilege('authenticated','public.admin_import_vietqr_bank_transaction(uuid,text,text,bigint,text,timestamptz,text,uuid)','EXECUTE'),'authenticated clients cannot call the import RPC');
select ok(not has_schema_privilege('authenticated','private','USAGE'),'authenticated clients retain no private schema usage');
select ok(not exists(select 1 from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema='private'),'client roles retain no private table grants');
select is(private.normalize_vietqr_transfer_content(' MBVCB. MYFAN-MFQ aa aa aa aa aa aa '),'MBVCBMYFANMFQAAAAAAAAAAAA','bank transfer content normalization is deterministic');

create temporary table br07_state(key text primary key,value uuid not null) on commit drop;

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
  confirmation_token,recovery_token,email_change_token_new,email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
('00000000-0000-0000-0000-000000000000','7b000000-0000-0000-0000-000000000001','authenticated','authenticated','br07-buyer@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','7b000000-0000-0000-0000-000000000002','authenticated','authenticated','br07-finance@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','7b000000-0000-0000-0000-000000000003','authenticated','authenticated','br07-user@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

update private.user_identity set
  date_of_birth=(current_date-interval '30 years')::date,
  age_verified_at=now(),age_verification_method='self_declared',
  terms_version=(select value_json#>>'{}' from private.app_config where key='terms_version_current'),terms_accepted_at=now(),
  community_rules_version=(select value_json#>>'{}' from private.app_config where key='community_rules_version_current'),community_rules_accepted_at=now(),
  account_status='active'
where user_id::text like '7b000000-0000-0000-0000-00000000000%';

update public.profiles set profile_status='active',province_id=1,username=case id
  when '7b000000-0000-0000-0000-000000000001' then 'br07_buyer'
  when '7b000000-0000-0000-0000-000000000002' then 'br07_finance'
  else 'br07_user' end,
  display_name=case id
  when '7b000000-0000-0000-0000-000000000001' then 'BR07 Buyer'
  when '7b000000-0000-0000-0000-000000000002' then 'BR07 Finance'
  else 'BR07 User' end
where id::text like '7b000000-0000-0000-0000-00000000000%';

insert into private.user_roles(user_id,role,granted_by)
values('7b000000-0000-0000-0000-000000000002','finance_admin','7b000000-0000-0000-0000-000000000002');

insert into private.vietqr_payment_orders(
  id,user_id,product_id,request_id,order_code,transfer_content,display_hearts,heart_units,amount_vnd,
  bank_bin,bank_code,bank_name,account_no,account_name,account_name_qr,qr_template,status,expires_at
)
select
  '7b100000-0000-4000-8000-000000000001','7b000000-0000-0000-0000-000000000001',hp.id,
  '7b200000-0000-4000-8000-000000000001','MFQAAAAAAAAAAAA','MYFANMFQAAAAAAAAAAAA',hp.display_hearts,hp.heart_units,
  hp.display_hearts::bigint*50000,'970436','VCB','Vietcombank','0011004000713','Tieu Vo Dinh Phi','TIEU VO DINH PHI',
  'compact2','awaiting_confirmation',now()+interval '30 minutes'
from public.heart_products hp where hp.is_active order by hp.display_hearts limit 1;

insert into private.vietqr_payment_orders(
  id,user_id,product_id,request_id,order_code,transfer_content,display_hearts,heart_units,amount_vnd,
  bank_bin,bank_code,bank_name,account_no,account_name,account_name_qr,qr_template,status,expires_at
)
select
  '7b100000-0000-4000-8000-000000000002','7b000000-0000-0000-0000-000000000001',hp.id,
  '7b200000-0000-4000-8000-000000000002','MFQBBBBBBBBBBBB','MYFANMFQBBBBBBBBBBBB',hp.display_hearts,hp.heart_units,
  hp.display_hearts::bigint*50000,'970436','VCB','Vietcombank','0011004000713','Tieu Vo Dinh Phi','TIEU VO DINH PHI',
  'compact2','awaiting_confirmation',now()+interval '30 minutes'
from public.heart_products hp where hp.is_active order by hp.display_hearts limit 1;

update private.app_config set value_json='true'::jsonb where key='vietqr_reconciliation_enabled';

select throws_ok(
  $$select * from public.admin_import_vietqr_bank_transaction(
    '7b000000-0000-0000-0000-000000000003','manual_csv','TX-UNAUTHORIZED',250000,
    'MYFANMFQAAAAAAAAAAAA',now(),repeat('a',64),'7b300000-0000-4000-8000-000000000001')$$,
  '42501','required_admin_role_missing','only finance_admin or super_admin can import reconciliation rows'
);

insert into br07_state(key,value)
select 'matched',transaction_id from public.admin_import_vietqr_bank_transaction(
  '7b000000-0000-0000-0000-000000000002','manual_csv','TX-MATCHED-001',
  (select amount_vnd from private.vietqr_payment_orders where id='7b100000-0000-4000-8000-000000000001'),
  'VCB credit MYFAN-MFQ-AAAAAAAAAAAA',now()-interval '1 minute',repeat('b',64),'7b300000-0000-4000-8000-000000000002'
);

select is((select status::text from private.vietqr_bank_transactions where id=(select value from br07_state where key='matched')),'matched','exact token and amount are classified as matched');
select ok(exists(select 1 from public.admin_list_vietqr_reconciliation_queue('7b000000-0000-0000-0000-000000000002','matched',20,0) where transaction_id=(select value from br07_state where key='matched')),'finance queue returns the matched transaction');
select ok((select already_imported from public.admin_import_vietqr_bank_transaction(
  '7b000000-0000-0000-0000-000000000002','manual_csv','TX-MATCHED-001',
  (select amount_vnd from private.vietqr_payment_orders where id='7b100000-0000-4000-8000-000000000001'),
  'MYFANMFQAAAAAAAAAAAA',now()-interval '1 minute',repeat('b',64),'7b300000-0000-4000-8000-000000000003'
)),'duplicate provider transaction references are idempotent');

insert into br07_state(key,value)
select 'mismatch',transaction_id from public.admin_import_vietqr_bank_transaction(
  '7b000000-0000-0000-0000-000000000002','manual_csv','TX-MISMATCH-001',123456,
  'MYFANMFQBBBBBBBBBBBB',now()-interval '2 minutes',repeat('c',64),'7b300000-0000-4000-8000-000000000004'
);
select is((select status::text from private.vietqr_bank_transactions where id=(select value from br07_state where key='mismatch')),'needs_review','amount mismatch is routed to manual review');

insert into br07_state(key,value)
select 'unmatched',transaction_id from public.admin_import_vietqr_bank_transaction(
  '7b000000-0000-0000-0000-000000000002','manual_csv','TX-UNMATCHED-001',99999,
  'TRANSFER WITHOUT MYFAN ORDER TOKEN',now()-interval '3 minutes',repeat('d',64),'7b300000-0000-4000-8000-000000000005'
);
select is((select status::text from private.vietqr_bank_transactions where id=(select value from br07_state where key='unmatched')),'unmatched','missing order token is routed to unmatched');

select throws_ok(
  format($q$select * from public.admin_decide_vietqr_reconciliation(
    '7b000000-0000-0000-0000-000000000002','%s','settle',null,null,'7b400000-0000-4000-8000-000000000001')$q$,
    (select value from br07_state where key='matched')),
  '55000','vietqr_manual_settlement_disabled','manual settlement fails closed while disabled'
);

update private.app_config set value_json='true'::jsonb where key='vietqr_manual_settlement_enabled';

select is((select status from public.admin_decide_vietqr_reconciliation(
  '7b000000-0000-0000-0000-000000000002',(select value from br07_state where key='matched'),'settle',null,null,
  '7b400000-0000-4000-8000-000000000002')),'settled','finance admin can settle an exact reviewed match after explicit enablement');
select is((select status::text from private.vietqr_payment_orders where id='7b100000-0000-4000-8000-000000000001'),'paid','settlement marks the matched VietQR order paid');
select is((select available_units from private.heart_accounts where user_id='7b000000-0000-0000-0000-000000000001'),
  (select heart_units from private.vietqr_payment_orders where id='7b100000-0000-4000-8000-000000000001'),'settlement credits the exact heart units once');
select ok((select already_processed from public.admin_decide_vietqr_reconciliation(
  '7b000000-0000-0000-0000-000000000002',(select value from br07_state where key='matched'),'settle',null,null,
  '7b400000-0000-4000-8000-000000000002')),'repeating the same finance request is idempotent');
select is((select count(*)::integer from private.heart_ledger where reference_type='vietqr_payment' and reference_id='7b100000-0000-4000-8000-000000000001'),1,'idempotent retry does not duplicate the heart ledger credit');

select is((select status from public.admin_decide_vietqr_reconciliation(
  '7b000000-0000-0000-0000-000000000002',(select value from br07_state where key='unmatched'),'ignore',null,'non_myfan_transfer',
  '7b400000-0000-4000-8000-000000000003')),'ignored','unmatched transfer can be explicitly ignored with an audit reason');
select is((select status from public.admin_decide_vietqr_reconciliation(
  '7b000000-0000-0000-0000-000000000002',(select value from br07_state where key='mismatch'),'reject',null,'amount_mismatch',
  '7b400000-0000-4000-8000-000000000004')),'rejected','mismatched transfer can be explicitly rejected with an audit reason');
select is((select count(*)::integer from private.heart_ledger where user_id='7b000000-0000-0000-0000-000000000001'),1,'ignored and rejected rows never credit hearts');

select throws_ok(
  format('update private.vietqr_reconciliation_events set metadata_json=''{}''::jsonb where transaction_id=''%s''',
    (select value from br07_state where key='matched')),
  '42501','vietqr_reconciliation_events_are_immutable','reconciliation events cannot be updated'
);
select throws_ok(
  format('delete from private.vietqr_reconciliation_events where transaction_id=''%s''',
    (select value from br07_state where key='matched')),
  '42501','vietqr_reconciliation_events_are_immutable','reconciliation events cannot be deleted'
);

select * from finish();
rollback;
