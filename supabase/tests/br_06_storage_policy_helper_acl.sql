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
  has_function_privilege('authenticated', 'private.can_view_media_internal(uuid,uuid)', 'EXECUTE')
  and to_regprocedure('private.is_active_adult(uuid)') is not null
  and has_function_privilege('authenticated', 'private.is_active_adult(uuid)', 'EXECUTE'),
  'authenticated media and Realtime message requests can evaluate their RLS helpers'
);

select ok(
  not has_schema_privilege('anon', 'private', 'USAGE')
  and not has_schema_privilege('authenticated', 'private', 'USAGE')
  and not has_function_privilege('anon', 'private.is_active_adult(uuid)', 'EXECUTE'),
  'client roles retain no broad private schema usage and anon cannot execute the active-adult helper'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where grantee in ('anon', 'authenticated')
      and table_schema = 'private'
  )
  and exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='messages'
      and policyname='messages_select_members'
      and cmd='SELECT'
      and qual like '%private.is_active_adult%'
  ),
  'client roles retain no direct private table grants and message RLS keeps the active-adult guard'
);

select * from finish();
rollback;
