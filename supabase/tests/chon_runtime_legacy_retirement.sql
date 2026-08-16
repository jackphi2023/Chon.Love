begin;
select plan(8);

select ok(
  not has_function_privilege('anon','public.get_creator_activity_access(text)','EXECUTE'),
  'anon cannot execute retired Creator Activity read RPC'
);
select ok(
  not has_function_privilege('authenticated','public.get_creator_activity_access(text)','EXECUTE'),
  'authenticated cannot execute retired Creator Activity read RPC'
);
select ok(
  not has_function_privilege('authenticated','public.create_creator_activity_post(text,text,uuid,text,uuid)','EXECUTE'),
  'authenticated cannot execute retired Creator Activity write RPC'
);
select ok(
  has_function_privilege('service_role','public.get_creator_activity_access(text)','EXECUTE'),
  'service role retains controlled recovery access to historical Activity RPC'
);
select ok(
  not has_function_privilege('anon','public.admin_get_homepage_settings(uuid)','EXECUTE'),
  'anon cannot execute admin homepage read RPC'
);
select ok(
  has_function_privilege('authenticated','public.admin_get_homepage_settings(uuid)','EXECUTE'),
  'authenticated Admin flow can still invoke admin homepage RPC subject to function authorization'
);
select ok(
  not has_function_privilege('anon','public.admin_update_homepage_settings(uuid,text,text,text,text,text,text)','EXECUTE'),
  'anon cannot execute admin homepage mutation RPC'
);
select ok(
  not has_function_privilege('anon','public.is_super_admin()','EXECUTE'),
  'anon cannot execute admin role helper'
);

select * from finish();
rollback;
