-- SESSION B production parity repair.
-- Realtime Postgres Changes evaluates the same authenticated SELECT policy as
-- normal message reads. That policy calls private.is_active_adult(uuid), so the
-- authenticated role needs the narrow EXECUTE privilege on this helper.
--
-- Keep the private schema itself inaccessible to client roles; this grant does
-- not grant table access.

grant execute on function private.is_active_adult(uuid) to authenticated;
