-- LX-14 keeps the established BR-06 Storage policy execution contract.
-- Client roles still have no USAGE on the private schema and no direct private-table grants,
-- but Storage/RLS evaluation requires EXECUTE on the security-definer media helper.

grant execute on function private.can_view_media_internal(uuid, uuid) to anon, authenticated, service_role;
