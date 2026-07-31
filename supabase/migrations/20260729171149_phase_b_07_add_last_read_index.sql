-- Cover the optional last-read foreign key reported by the Supabase Performance Advisor.
create index conversation_members_last_read_message_idx
  on public.conversation_members(last_read_message_id)
  where last_read_message_id is not null;
