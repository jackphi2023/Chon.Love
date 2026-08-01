#!/usr/bin/env bash
set -euo pipefail
DB_URL="${MYFAN_TEST_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
SENDER='4a000000-0000-0000-0000-000000000001'
CREATOR='4a000000-0000-0000-0000-000000000002'

psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change_token_current,phone_change,phone_change_token,reauthentication_token) values
('00000000-0000-0000-0000-000000000000','4a000000-0000-0000-0000-000000000001','authenticated','authenticated','concurrency-sender@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','4a000000-0000-0000-0000-000000000002','authenticated','authenticated','concurrency-creator@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');
update private.user_identity set
  date_of_birth=(current_date-interval '25 years')::date,
  age_verified_at=now(),
  age_verification_method='self_declared',
  terms_version=(select value_json#>>'{}' from private.app_config where key='terms_version_current'),
  terms_accepted_at=now(),
  community_rules_version=(select value_json#>>'{}' from private.app_config where key='community_rules_version_current'),
  community_rules_accepted_at=now(),
  account_status='active'
where user_id::text like '4a000000-0000-0000-0000-00000000000%';
update public.profiles set
  profile_status='active',
  username='concurrency_'||right(id::text,1),
  display_name='Concurrency test',
  province_id=1
where id::text like '4a000000-0000-0000-0000-00000000000%';
insert into public.creator_profiles(user_id,creator_status,fan_threshold_units,approved_at) values('4a000000-0000-0000-0000-000000000002','approved',1000,now());
select * from public.record_verified_play_purchase('4a000000-0000-0000-0000-000000000001','myfan_hearts_005',repeat('b',64),'GPA.CONCURRENCY',encode(extensions.digest('4a000000-0000-0000-0000-000000000001','sha256'),'hex'),'VN',true,'4a100000-0000-0000-0000-000000000001',null);
SQL

GIFT_ID=$(psql "$DB_URL" -Atc "select id from public.gift_catalog where display_hearts=5 and is_active order by sort_order limit 1")
run_gift() {
  local request_id="$1"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; select set_config('request.jwt.claims','{\"sub\":\"${SENDER}\",\"role\":\"authenticated\"}',true); select * from public.send_gift('${CREATOR}','${GIFT_ID}',1,'${request_id}',null,null); commit;" >/tmp/"${request_id}".out 2>/tmp/"${request_id}".err
}
set +e
run_gift '4a200000-0000-0000-0000-000000000001' & pid1=$!
run_gift '4a200000-0000-0000-0000-000000000002' & pid2=$!
wait "$pid1"; rc1=$?
wait "$pid2"; rc2=$?
set -e
if [[ $(( (rc1==0) + (rc2==0) )) -ne 1 ]]; then
  echo "Expected exactly one successful concurrent gift, got rc1=${rc1} rc2=${rc2}" >&2
  cat /tmp/4a200000-0000-0000-0000-000000000001.err /tmp/4a200000-0000-0000-0000-000000000002.err >&2 || true
  exit 1
fi
psql "$DB_URL" -v ON_ERROR_STOP=1 -Atc "select case when (select available_units from private.heart_accounts where user_id='${SENDER}')=0 and (select count(*) from public.gift_transactions where sender_id='${SENDER}')=1 and (select count(*) from private.heart_ledger where user_id='${SENDER}' and entry_type='gift_debit')=1 then 'ok' else 'fail' end" | grep -qx ok
echo "Session 9 concurrency invariant: PASS"
