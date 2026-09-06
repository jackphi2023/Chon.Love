begin;

select plan(5);

select ok(
  to_regprocedure('private.is_active_adult(uuid)') is not null,
  'Realtime message RLS active-adult helper exists'
);

select ok(
  has_function_privilege('authenticated', 'private.is_active_adult(uuid)', 'EXECUTE'),
  'authenticated Realtime message changes can evaluate the active-adult RLS helper'
);

select ok(
  not has_function_privilege('anon', 'private.is_active_adult(uuid)', 'EXECUTE'),
  'anonymous clients cannot execute the active-adult helper'
);

select ok(
  not has_schema_privilege('authenticated', 'private', 'USAGE')
  and not has_schema_privilege('anon', 'private', 'USAGE'),
  'client roles retain no broad private schema usage'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='messages'
      and policyname='messages_select_members'
      and cmd='SELECT'
      and qual like '%private.is_active_adult%'
  ),
  'messages SELECT policy remains guarded by the active-adult helper'
);

select * from finish();
rollback;
