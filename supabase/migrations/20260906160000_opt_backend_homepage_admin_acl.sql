-- SESSION B security hardening.
-- Homepage admin RPCs already bind p_actor_user_id to auth.uid() and require
-- super_admin. Remove the redundant anonymous/PUBLIC EXECUTE path while
-- preserving authenticated Admin and service-role callers.
revoke execute on function public.admin_get_homepage_settings(uuid) from public, anon;
grant execute on function public.admin_get_homepage_settings(uuid) to authenticated, service_role;

revoke execute on function public.admin_update_homepage_settings(uuid,text,text,text,text,text,text) from public, anon;
grant execute on function public.admin_update_homepage_settings(uuid,text,text,text,text,text,text) to authenticated, service_role;

revoke execute on function public.admin_publish_homepage_settings(uuid,text,text,jsonb,text,text,text,text) from public, anon;
grant execute on function public.admin_publish_homepage_settings(uuid,text,text,jsonb,text,text,text,text) to authenticated, service_role;
