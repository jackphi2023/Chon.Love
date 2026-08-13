begin;

-- WEB-R01 release boundary: preserve the LX-19 implementation while keeping all
-- gift / wallet payout mutations fail-closed for the initial Luxy Web V1 launch.
-- The UI feature flags are not a security boundary, so the server-side switches
-- must also default to OFF until the operational Admin flow is explicitly enabled.

insert into private.app_config(key,value_json,value_type,description,is_public)
values
  ('luxy_member_gifts_enabled','false'::jsonb,'boolean','WEB-R01: Luxy gifts stay disabled for initial Web V1 until ADM-R03 validates operational controls.',false),
  ('withdrawal_requests_enabled','false'::jsonb,'boolean','WEB-R01: withdrawal requests stay disabled for initial Web V1.',false)
on conflict(key) do update
set value_json=excluded.value_json,
    value_type=excluded.value_type,
    description=excluded.description,
    is_public=false,
    updated_at=now();

-- LX-19 generalized request_withdrawal from Creator-only to member recipients and
-- accidentally restored direct authenticated EXECUTE. Restore the BR-08 launch
-- boundary: only server/service-role may invoke it until a later reviewed release
-- intentionally grants the client surface again.
revoke execute on function public.request_withdrawal(uuid,bigint,uuid) from public,anon,authenticated;
grant execute on function public.request_withdrawal(uuid,bigint,uuid) to service_role;

commit;
