create index if not exists conversations_message_retention_updated_by_idx
  on public.conversations(message_retention_updated_by)
  where message_retention_updated_by is not null;
