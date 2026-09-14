begin;

select plan(3);

select like(
  lower(pg_get_functiondef('public.admin_list_member_photo_verifications(uuid,integer,integer)'::regprocedure)),
  '%order by mc.created_at desc, mc.id desc%',
  'photo verification queue is newest-first with stable id tie-breaker'
);

select ok(
  has_function_privilege('service_role', 'public.admin_list_member_photo_verifications(uuid,integer,integer)', 'EXECUTE'),
  'service_role can execute photo verification queue RPC'
);

select ok(
  not has_function_privilege('authenticated', 'public.admin_list_member_photo_verifications(uuid,integer,integer)', 'EXECUTE'),
  'authenticated clients cannot execute Admin photo verification queue RPC directly'
);

select * from finish();
rollback;
