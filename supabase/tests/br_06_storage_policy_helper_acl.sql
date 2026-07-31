begin;

select plan(5);

select ok(
  to_regprocedure('private.can_view_media_internal(uuid,uuid)') is not null,
  'Storage media authorization helper exists'
);

select ok(
  has_function_privilege('anon', 'private.can_view_media_internal(uuid,uuid)', 'EXECUTE'),
  'anonymous public Activity requests can evaluate the Storage policy helper'
);

select ok(
  has_function_privilege('authenticated', 'private.can_view_media_internal(uuid,uuid)', 'EXECUTE'),
  'authenticated media requests can evaluate the Storage policy helper'
);

select ok(
  not has_schema_privilege('anon', 'private', 'USAGE')
  and not has_schema_privilege('authenticated', 'private', 'USAGE'),
  'client roles retain no broad private schema usage'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where grantee in ('anon', 'authenticated')
      and table_schema = 'private'
  ),
  'client roles retain no direct private table grants'
);

select * from finish();
rollback;
