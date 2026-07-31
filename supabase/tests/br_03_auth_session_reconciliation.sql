begin;

select plan(4);

select ok(
  to_regclass('private.beta_auth_rotations') is null,
  'BR-03 leaves no password rotation table in the final schema'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_my_beta_auth_status'
  ),
  'BR-03 leaves no temporary Beta auth status RPC'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'complete_my_beta_password_rotation'
  ),
  'BR-03 leaves no temporary password rotation completion RPC'
);

select is(
  (
    select count(*)::integer
    from supabase_migrations.schema_migrations
    where version in ('20260731134111', '20260731134449', '20260731134617')
  ),
  3,
  'all BR-03 reconciliation migration records are present'
);

select * from finish();
rollback;
