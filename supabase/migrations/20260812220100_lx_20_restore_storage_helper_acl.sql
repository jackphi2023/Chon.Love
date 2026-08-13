-- LX-20 redefines private.can_view_media_internal for the Premium/Diamond private-photo
-- entitlement. Storage RLS evaluates this security-definer helper under anon/authenticated
-- callers, so preserve the established BR-06 / LX-14 EXECUTE contract without exposing
-- private schema/table USAGE or direct table grants.
grant execute on function private.can_view_media_internal(uuid,uuid) to anon,authenticated,service_role;
