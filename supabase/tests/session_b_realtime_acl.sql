begin;

select plan(1);

select ok(
  has_function_privilege('authenticated', 'private.is_active_adult(uuid)', 'EXECUTE'),
  'authenticated can execute private.is_active_adult for Realtime RLS evaluation'
);

select * from finish();
rollback;
