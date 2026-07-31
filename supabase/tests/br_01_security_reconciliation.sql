begin;

select plan(15);

select ok(
  exists (
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'creator_posts'
      and p.polname = 'creator_posts_deny_direct_client_access'
  ),
  'creator_posts has explicit direct-client deny policy'
);

select ok(
  exists (
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'creator_post_media'
      and p.polname = 'creator_post_media_deny_direct_client_access'
  ),
  'creator_post_media has explicit direct-client deny policy'
);

select ok(
  exists (
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private' and c.relname = 'creator_post_unlocks'
      and p.polname = 'creator_post_unlocks_deny_direct_client_access'
  ),
  'creator_post_unlocks has explicit direct-client deny policy'
);

select ok(
  exists (
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private' and c.relname = 'creator_post_unlock_events'
      and p.polname = 'creator_post_unlock_events_deny_direct_client_access'
  ),
  'creator_post_unlock_events has explicit direct-client deny policy'
);

select ok(
  exists (
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private' and c.relname = 'message_user_hides'
      and p.polname = 'message_user_hides_deny_direct_client_access'
  ),
  'message_user_hides has explicit direct-client deny policy'
);

select ok(
  exists (
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private' and c.relname = 'vietqr_payment_orders'
      and p.polname = 'vietqr_payment_orders_deny_direct_client_access'
  ),
  'vietqr_payment_orders has explicit direct-client deny policy'
);

select ok(
  not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'creator_posts'
      and grantee in ('anon', 'authenticated')
  ),
  'creator_posts has no direct app-role grants'
);

select ok(
  not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'creator_post_media'
      and grantee in ('anon', 'authenticated')
  ),
  'creator_post_media has no direct app-role grants'
);

select ok(
  not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'private' and table_name = 'creator_post_unlocks'
      and grantee in ('anon', 'authenticated')
  ),
  'creator_post_unlocks has no direct app-role grants'
);

select ok(
  not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'private' and table_name = 'creator_post_unlock_events'
      and grantee in ('anon', 'authenticated')
  ),
  'creator_post_unlock_events has no direct app-role grants'
);

select ok(
  not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'private' and table_name = 'message_user_hides'
      and grantee in ('anon', 'authenticated')
  ),
  'message_user_hides has no direct app-role grants'
);

select ok(
  not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'private' and table_name = 'vietqr_payment_orders'
      and grantee in ('anon', 'authenticated')
  ),
  'vietqr_payment_orders has no direct app-role grants'
);

select ok(
  not exists (select 1 from pg_extension where extname = 'pg_net'),
  'temporary pg_net transport extension is absent'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and (
        p.proname ilike '%seed%'
        or p.proname ilike '%beta%'
        or p.proname ilike '%transport%'
        or p.proname ilike '%reset%'
      )
  ),
  'no temporary seed/reset helper function remains in product schemas'
);

select ok(
  exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260731114823'
      and name = 'br_01_explicit_rpc_only_deny_policies'
  ),
  'BR-01 migration is recorded in the migration ledger'
);

select * from finish();
rollback;
