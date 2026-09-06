begin;

-- SESSION B production safety gate.
-- OPT-12/OPT-13 install guarded request/review RPC contracts, but execution
-- remains disabled until the dedicated finance E2E release gate is accepted.
insert into private.app_config(key,value_json,value_type,description,is_public)
values
  ('withdrawal_requests_enabled','false'::jsonb,'boolean','SESSION B: withdrawal requests remain disabled until finance E2E approval.',false),
  ('kyc_operational_review_enabled','false'::jsonb,'boolean','SESSION B: KYC operational review remains disabled until finance E2E approval.',false),
  ('bank_account_operational_review_enabled','false'::jsonb,'boolean','SESSION B: bank operational review remains disabled until finance E2E approval.',false),
  ('withdrawal_operational_review_enabled','false'::jsonb,'boolean','SESSION B: withdrawal operational review remains disabled until finance E2E approval.',false),
  ('withdrawal_processing_enabled','false'::jsonb,'boolean','SESSION B: withdrawal processing remains disabled until finance E2E approval.',false),
  ('withdrawal_payout_enabled','false'::jsonb,'boolean','SESSION B: payout execution remains disabled until finance E2E approval.',false),
  ('vietqr_reconciliation_enabled','false'::jsonb,'boolean','SESSION B: VietQR reconciliation remains disabled until finance E2E approval.',false)
on conflict(key) do update
set value_json='false'::jsonb,
    value_type='boolean',
    description=excluded.description,
    is_public=false,
    updated_at=now();

do $$
declare
  v_key text;
begin
  foreach v_key in array array[
    'withdrawal_requests_enabled',
    'kyc_operational_review_enabled',
    'bank_account_operational_review_enabled',
    'withdrawal_operational_review_enabled',
    'withdrawal_processing_enabled',
    'withdrawal_payout_enabled',
    'vietqr_reconciliation_enabled'
  ]
  loop
    if coalesce((select (value_json #>> '{}')::boolean from private.app_config where key=v_key), true) then
      raise exception 'financial safety switch must remain disabled: %',v_key;
    end if;
  end loop;
end $$;

commit;
