-- Chon.Love Web V1 runtime cleanup.
-- Keep historical MyFan/Luxy tables and rows intact, but remove client EXECUTE
-- access to Creator Activity RPCs that are no longer part of the product.
-- Also remove anonymous execution from admin/helper RPCs that only signed-in
-- admin flows need.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(array[
        'archive_creator_activity_post',
        'create_creator_activity_post',
        'delete_creator_activity_post',
        'get_creator_activity_access',
        'get_creator_post_media_access',
        'list_creator_activity',
        'list_creator_activity_album',
        'list_creator_activity_moderation_queue',
        'list_public_activity_highlights',
        'list_public_featured_creators',
        'moderate_creator_activity_post',
        'prepare_creator_activity_preview',
        'report_creator_activity',
        'set_my_creator_activity_visibility'
      ]::text[])
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.signature);
    execute format('grant execute on function %s to service_role', r.signature);
  end loop;
end;
$$;

-- These functions are still used by authenticated Admin flows, but an anonymous
-- browser must never be allowed to invoke them.
revoke execute on function public.admin_get_homepage_settings(uuid) from public, anon;
grant execute on function public.admin_get_homepage_settings(uuid) to authenticated, service_role;

revoke execute on function public.admin_update_homepage_settings(uuid,text,text,text,text,text,text) from public, anon;
grant execute on function public.admin_update_homepage_settings(uuid,text,text,text,text,text,text) to authenticated, service_role;

revoke execute on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated, service_role;
