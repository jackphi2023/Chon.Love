-- Fix ordinary-member cross-user profile media delivery without broadening
-- public.media_assets SELECT access or changing private-photo entitlement rules.
--
-- The previous storage.objects policy queried public.media_assets directly.
-- Because media_assets RLS only exposes the owner's rows, an authenticated viewer
-- could not see another member's media row and the EXISTS failed before
-- private.can_view_media_internal() could authorize an approved avatar/public photo.

create or replace function private.can_view_profile_media_storage_object(
  p_bucket text,
  p_name text,
  p_viewer uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.media_assets m
    where m.storage_bucket = p_bucket
      and m.storage_path = p_name
      and private.can_view_media_internal(m.id, p_viewer)
  );
$function$;

revoke all on function private.can_view_profile_media_storage_object(text, text, uuid) from public;
grant execute on function private.can_view_profile_media_storage_object(text, text, uuid)
  to authenticated, service_role;

drop policy if exists profile_media_select_authorized on storage.objects;
create policy profile_media_select_authorized
on storage.objects
for select
to authenticated
using (
  bucket_id = any(array['pending-media'::text, 'profile-media'::text])
  and private.can_view_profile_media_storage_object(bucket_id, name, auth.uid())
);
