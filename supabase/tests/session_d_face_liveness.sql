begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(7);

select extensions.ok(
  to_regclass('private.member_face_liveness_sessions') is not null,
  'Face Liveness session ledger exists in private schema'
);

select extensions.ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'private'
      and table_name = 'member_face_liveness_sessions'
      and column_name = 'reference_image_sha256'
  ),
  'Face Liveness proof stores a server-side ReferenceImage SHA-256 binding'
);

select extensions.ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'private'
      and t.relname = 'member_face_liveness_sessions'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%reference_image_sha256%^[0-9a-f]{64}$%'
  ),
  'ReferenceImage digest is constrained to lowercase SHA-256 hex'
);

select extensions.ok(
  not has_table_privilege('anon', 'private.member_face_liveness_sessions', 'SELECT')
  and not has_table_privilege('authenticated', 'private.member_face_liveness_sessions', 'SELECT'),
  'Member clients cannot read liveness audit rows or confidence scores directly'
);

select extensions.ok(
  not has_table_privilege('anon', 'private.member_face_liveness_sessions', 'INSERT')
  and not has_table_privilege('authenticated', 'private.member_face_liveness_sessions', 'INSERT'),
  'Member clients cannot mint their own liveness proof rows'
);

select extensions.ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'private'
      and tablename = 'member_face_liveness_sessions'
      and indexname = 'member_face_liveness_sessions_user_created_idx'
  ),
  'Liveness session lookup is indexed by member and newest session'
);

select extensions.ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'private'
      and tablename = 'member_face_liveness_sessions'
      and indexname = 'member_face_liveness_sessions_active_idx'
  ),
  'Active liveness session lookup has a partial index'
);

select * from extensions.finish();
rollback;
