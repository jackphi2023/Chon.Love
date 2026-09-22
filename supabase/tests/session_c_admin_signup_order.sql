begin;
select plan(2);
select ok(
  strpos(lower(pg_get_functiondef('public.admin_list_luxy_users(uuid,text,text,public.luxy_membership_tier,integer,integer)'::regprocedure)), 'order by u.created_at desc, p.id') > 0,
  'Admin Users orders globally by Auth signup time with stable ID tie-breaker before pagination'
);
select ok(
  not has_function_privilege('anon', 'public.admin_list_luxy_users(uuid,text,text,public.luxy_membership_tier,integer,integer)', 'EXECUTE'),
  'anonymous callers cannot list Admin users'
);
select * from finish();
rollback;
