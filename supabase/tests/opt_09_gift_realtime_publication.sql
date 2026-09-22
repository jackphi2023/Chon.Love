begin;

select plan(2);

select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'gift_transactions'
  ),
  'gift_transactions is published for OPT-09 history invalidation'
);

select ok(
  exists (select 1 from pg_publication where pubname = 'supabase_realtime'),
  'supabase_realtime publication exists'
);

select * from finish();
rollback;
