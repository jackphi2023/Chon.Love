-- LX-14 must preserve the BR-06 Storage policy execution contract.
-- The helper is SECURITY DEFINER and exposes only a boolean authorization decision.
-- Client roles still have no USAGE on the private schema and no private-table grants.

grant execute on function private.can_view_media_internal(uuid, uuid) to anon, authenticated;
