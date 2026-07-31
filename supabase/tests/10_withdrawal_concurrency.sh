#!/usr/bin/env bash
set -euo pipefail
DB_URL="${MYFAN_TEST_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
SENDER='4c000000-0000-0000-0000-000000000001'
CREATOR='4c000000-0000-0000-0000-000000000002'
BANK='4c100000-0000-0000-0000-000000000001'

psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change_token_current,phone_change,phone_change_token,reauthentication_token) values
('00000000-0000-0000-0000-000000000000','${SENDER}','authenticated','authenticated','withdrawal-concurrency-sender@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','${CREATOR}','authenticated','authenticated','withdrawal-concurrency-creator@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');
update private.user_identity set date_of_birth=(current_date-interval '30 years')::date,age_verified_at=now(),age_verification_method='self_declared',terms_version='2026-07',terms_accepted_at=now(),community_rules_version='2026-07',community_rules_accepted_at=now(),account_status='active' where user_id in ('${SENDER}','${CREATOR}');
update public.profiles set profile_status='active',username='wdc_'||right(id::text,1),display_name='Withdrawal concurrency' where id in ('${SENDER}','${CREATOR}');
insert into public.creator_profiles(user_id,creator_status,fan_threshold_units,payout_eligible,approved_at) values('${CREATOR}','approved',1000,true,now());
insert into private.kyc_profiles(user_id,legal_name_ciphertext,document_type,document_number_ciphertext,document_number_last4,country_code,status,submission_request_id,submitted_at,reviewed_at,reviewed_by,expires_at)
values('${CREATOR}','v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBB','national_id','v1.CCCCCCCCCCCCCCCC.DDDDDDDDDDDDDDDD','1234','VN','approved','4c100000-0000-0000-0000-000000000002',now(),now(),'${CREATOR}',now()+interval '5 years');
insert into private.bank_accounts(id,user_id,bank_code,account_number_ciphertext,account_number_last4,account_holder_ciphertext,status,is_default,submission_request_id,verified_at,verified_by)
values('${BANK}','${CREATOR}','VCB','v1.EEEEEEEEEEEEEEEE.FFFFFFFFFFFFFFFF','1234','v1.GGGGGGGGGGGGGGGG.HHHHHHHHHHHHHHHH','verified',true,'4c100000-0000-0000-0000-000000000003',now(),'${CREATOR}');
select * from public.record_verified_play_purchase('${SENDER}','myfan_hearts_020',repeat('e',64),'GPA.WITHDRAWAL.CONCURRENCY',encode(extensions.digest('${SENDER}','sha256'),'hex'),'VN',true,'4c200000-0000-0000-0000-000000000001',null);
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"${SENDER}","role":"authenticated"}',true);
select * from public.send_gift('${CREATOR}',(select id from public.gift_catalog where display_hearts=20),1,'4c200000-0000-0000-0000-000000000002',null,null);
commit;
update private.creator_reward_positions set available_at=now()-interval '1 second' where creator_id='${CREATOR}';
select * from public.release_due_creator_rewards(10);
SQL

run_withdrawal() {
  local request_id="$1"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; select set_config('request.jwt.claims','{\"sub\":\"${CREATOR}\",\"role\":\"authenticated\"}',true); select * from public.request_withdrawal('${BANK}',1000,'${request_id}'); commit;" >/tmp/"${request_id}".out 2>/tmp/"${request_id}".err
}
set +e
run_withdrawal '4c300000-0000-0000-0000-000000000001' & pid1=$!
run_withdrawal '4c300000-0000-0000-0000-000000000002' & pid2=$!
wait "$pid1"; rc1=$?
wait "$pid2"; rc2=$?
set -e
if [[ $(( (rc1==0) + (rc2==0) )) -ne 1 ]]; then
  echo "Expected exactly one successful concurrent withdrawal, got rc1=${rc1} rc2=${rc2}" >&2
  cat /tmp/4c300000-0000-0000-0000-000000000001.err /tmp/4c300000-0000-0000-0000-000000000002.err >&2 || true
  exit 1
fi
psql "$DB_URL" -v ON_ERROR_STOP=1 -Atc "select case when
  (select count(*) from private.withdrawals where creator_id='${CREATOR}')=1
  and (select available_units from private.creator_earning_accounts where creator_id='${CREATOR}')=400
  and (select held_units from private.creator_earning_accounts where creator_id='${CREATOR}')=1000
  and (select count(*) from private.creator_reward_ledger where creator_id='${CREATOR}' and entry_type='withdrawal_hold')=1
  then 'ok' else 'fail' end" | grep -qx ok
echo "Session 10 withdrawal concurrency invariant: PASS"
