begin;

-- OPT-13: release the existing BR-08 payout control plane so OPT-12 user requests
-- can move through KYC/bank review and the maker-checker withdrawal lifecycle.
-- These switches do not grant browser users any admin RPC privileges: payout-admin
-- remains the service-role boundary and every operational RPC verifies finance_admin
-- or super_admin before reading PII or mutating payout state.
insert into private.app_config(key,value_json,value_type,description,is_public)
values
  ('kyc_operational_review_enabled','true'::jsonb,'boolean','OPT-13: allow finance administrators to review payout KYC cases.',false),
  ('bank_account_operational_review_enabled','true'::jsonb,'boolean','OPT-13: allow finance administrators to verify payout bank accounts submitted by members.',false),
  ('withdrawal_operational_review_enabled','true'::jsonb,'boolean','OPT-13: allow finance administrators to claim and decide withdrawal requests.',false),
  ('withdrawal_processing_enabled','true'::jsonb,'boolean','OPT-13: allow a second finance operator to start approved withdrawal processing.',false),
  ('withdrawal_payout_enabled','true'::jsonb,'boolean','OPT-13: allow a second finance operator to record verified manual payout with evidence.',false)
on conflict(key) do update
set value_json=excluded.value_json,
    value_type=excluded.value_type,
    description=excluded.description,
    is_public=false,
    updated_at=now();

-- Reassert the least-privilege boundary explicitly at the release migration.
revoke execute on function public.admin_list_kyc_operational_queue(uuid,text,integer,integer) from public,anon,authenticated;
revoke execute on function public.admin_list_bank_operational_queue(uuid,text,integer,integer) from public,anon,authenticated;
revoke execute on function public.admin_list_withdrawal_operational_queue(uuid,text,integer,integer) from public,anon,authenticated;
revoke execute on function public.admin_start_kyc_review(uuid,uuid,uuid) from public,anon,authenticated;
revoke execute on function public.admin_start_bank_review(uuid,uuid,uuid) from public,anon,authenticated;
revoke execute on function public.admin_start_withdrawal_review(uuid,uuid,uuid) from public,anon,authenticated;
revoke execute on function public.admin_review_kyc(uuid,uuid,text,text,timestamptz,uuid) from public,anon,authenticated;
revoke execute on function public.admin_review_bank_account(uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke execute on function public.admin_operate_withdrawal(uuid,uuid,text,text,text,text,uuid) from public,anon,authenticated;

grant execute on function public.admin_list_kyc_operational_queue(uuid,text,integer,integer) to service_role;
grant execute on function public.admin_list_bank_operational_queue(uuid,text,integer,integer) to service_role;
grant execute on function public.admin_list_withdrawal_operational_queue(uuid,text,integer,integer) to service_role;
grant execute on function public.admin_start_kyc_review(uuid,uuid,uuid) to service_role;
grant execute on function public.admin_start_bank_review(uuid,uuid,uuid) to service_role;
grant execute on function public.admin_start_withdrawal_review(uuid,uuid,uuid) to service_role;
grant execute on function public.admin_review_kyc(uuid,uuid,text,text,timestamptz,uuid) to service_role;
grant execute on function public.admin_review_bank_account(uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.admin_operate_withdrawal(uuid,uuid,text,text,text,text,uuid) to service_role;

commit;
