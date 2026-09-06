-- OPT-10: Realtime Postgres Changes must be able to evaluate the same authenticated
-- SELECT policy as normal message reads. The policy calls private.is_active_adult(),
-- so authenticated needs EXECUTE on that SECURITY DEFINER boolean helper.
--
-- Keep the private schema itself inaccessible to client roles; this grant is only the
-- narrow function privilege required for RLS policy evaluation.
grant execute on function private.is_active_adult(uuid) to authenticated;
