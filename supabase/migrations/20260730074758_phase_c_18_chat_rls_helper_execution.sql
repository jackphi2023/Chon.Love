-- The messages SELECT policy invokes this private helper as the authenticated role.
-- The private schema remains outside the exposed API schemas, so this grant enables policy evaluation only.
grant execute on function private.is_message_hidden_for_user(uuid, uuid) to authenticated;
