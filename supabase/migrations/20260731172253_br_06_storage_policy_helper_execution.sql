begin;

-- Storage RLS policies execute as the requesting API role. The helper remains
-- SECURITY DEFINER and returns only a boolean authorization decision, but the
-- caller still needs EXECUTE permission for PostgreSQL to evaluate the policy.
-- BR-01 intentionally revoked broad private-schema and private-table access;
-- this migration restores only the single function capability required by
-- profile-media and Creator Activity signed-URL policy evaluation.
grant execute on function private.can_view_media_internal(uuid, uuid) to anon, authenticated;

commit;
