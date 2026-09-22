-- OPT-09: the gift history UI listens to Postgres Changes for both sender_id
-- and creator_id. Keep publication setup idempotent for local reset and hosted
-- parity; do not alter the financial ledger or enable any settlement behavior.
do $$
begin
  if to_regclass('public.gift_transactions') is null then
    raise exception 'gift_transactions must exist before OPT-09 realtime publication';
  end if;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'gift_transactions'
     ) then
    alter publication supabase_realtime add table public.gift_transactions;
  end if;
end;
$$;

comment on table public.gift_transactions is
  'Canonical gift ledger; OPT-09 publishes inserts/updates for recipient and sender history invalidation. Financial execution remains fail-closed.';
