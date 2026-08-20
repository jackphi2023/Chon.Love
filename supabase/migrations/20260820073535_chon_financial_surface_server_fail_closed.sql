begin;

-- Chon.Love production release boundary: financial mutations stay fail-closed
-- until Admin reconciliation, payout operations and explicit production acceptance
-- are completed. Client feature flags are presentation only; server controls are
-- the security boundary.
insert into private.app_config(key,value_json,value_type,description,is_public)
values
  ('luxy_member_gifts_enabled','false'::jsonb,'boolean','Chon.Love: gifts disabled server-side until explicit finance production acceptance.',false),
  ('withdrawal_requests_enabled','false'::jsonb,'boolean','Chon.Love: withdrawal requests disabled until explicit finance production acceptance.',false),
  ('withdrawal_processing_enabled','false'::jsonb,'boolean','Chon.Love: withdrawal processing disabled until explicit finance production acceptance.',false),
  ('withdrawal_payout_enabled','false'::jsonb,'boolean','Chon.Love: withdrawal payout disabled until explicit finance production acceptance.',false),
  ('withdrawal_operational_review_enabled','false'::jsonb,'boolean','Chon.Love: withdrawal operational review disabled until explicit finance production acceptance.',false)
on conflict(key) do update
set value_json=excluded.value_json,
    value_type=excluded.value_type,
    description=excluded.description,
    is_public=false,
    updated_at=now();

-- request_withdrawal currently has no internal release-switch guard. Keep it
-- service-role-only so an authenticated browser cannot bypass the disabled UI.
revoke execute on function public.request_withdrawal(uuid,bigint,uuid) from public,anon,authenticated;
grant execute on function public.request_withdrawal(uuid,bigint,uuid) to service_role;

commit;
