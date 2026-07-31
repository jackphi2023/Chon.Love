-- RLS policies may execute this boolean SECURITY DEFINER helper while the private schema and tables remain inaccessible through the Data API.
grant execute on function private.is_conversation_member(uuid,uuid) to authenticated;
