-- Chon.Love homepage Admin publishing hardening.
-- 1) Bind Admin RPC actor parameters to the authenticated caller.
-- 2) Require homepage Storage objects to live under the authenticated Admin's UUID folder.

create or replace function public.admin_get_homepage_settings(p_actor_user_id uuid)
returns table(
  hero_desktop_youtube_url text,
  hero_mobile_youtube_url text,
  section2_left_image_url text,
  section2_right_image_url text,
  section3_background_image_url text,
  section4_image_url text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_actor_user_id is null or p_actor_user_id is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'homepage_admin_actor_mismatch';
  end if;
  perform private.actor_role_for(p_actor_user_id, array['super_admin']::private.user_role[]);

  return query
  select
    s.hero_desktop_youtube_url,
    s.hero_mobile_youtube_url,
    s.section2_left_image_url,
    s.section2_right_image_url,
    s.section3_background_image_url,
    s.section4_image_url,
    s.updated_at
  from public.homepage_settings s
  where s.id = 1;
end;
$$;

create or replace function public.admin_update_homepage_settings(
  p_actor_user_id uuid,
  p_hero_desktop_youtube_url text,
  p_hero_mobile_youtube_url text,
  p_section2_left_image_url text,
  p_section2_right_image_url text,
  p_section3_background_image_url text,
  p_section4_image_url text
)
returns table(
  hero_desktop_youtube_url text,
  hero_mobile_youtube_url text,
  section2_left_image_url text,
  section2_right_image_url text,
  section3_background_image_url text,
  section4_image_url text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_desktop text := nullif(btrim(coalesce(p_hero_desktop_youtube_url, '')), '');
  v_mobile text := nullif(btrim(coalesce(p_hero_mobile_youtube_url, '')), '');
  v_s2_left text := nullif(btrim(coalesce(p_section2_left_image_url, '')), '');
  v_s2_right text := nullif(btrim(coalesce(p_section2_right_image_url, '')), '');
  v_s3 text := nullif(btrim(coalesce(p_section3_background_image_url, '')), '');
  v_s4 text := nullif(btrim(coalesce(p_section4_image_url, '')), '');
begin
  if p_actor_user_id is null or p_actor_user_id is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'homepage_admin_actor_mismatch';
  end if;
  perform private.actor_role_for(p_actor_user_id, array['super_admin']::private.user_role[]);

  if v_desktop is not null and v_desktop !~* '^https://(www\.)?(youtube\.com|youtu\.be)/' then
    raise exception using errcode = '22023', message = 'invalid_desktop_youtube_url';
  end if;
  if v_mobile is not null and v_mobile !~* '^https://(www\.)?(youtube\.com|youtu\.be)/' then
    raise exception using errcode = '22023', message = 'invalid_mobile_youtube_url';
  end if;
  if v_s2_left is not null and v_s2_left !~* '^https://' then
    raise exception using errcode = '22023', message = 'invalid_section2_left_image_url';
  end if;
  if v_s2_right is not null and v_s2_right !~* '^https://' then
    raise exception using errcode = '22023', message = 'invalid_section2_right_image_url';
  end if;
  if v_s3 is not null and v_s3 !~* '^https://' then
    raise exception using errcode = '22023', message = 'invalid_section3_background_image_url';
  end if;
  if v_s4 is not null and v_s4 !~* '^https://' then
    raise exception using errcode = '22023', message = 'invalid_section4_image_url';
  end if;

  update public.homepage_settings
  set hero_desktop_youtube_url = v_desktop,
      hero_mobile_youtube_url = v_mobile,
      section2_left_image_url = v_s2_left,
      section2_right_image_url = v_s2_right,
      section3_background_image_url = v_s3,
      section4_image_url = v_s4,
      updated_at = now(),
      updated_by = auth.uid()
  where id = 1;

  return query
  select
    s.hero_desktop_youtube_url,
    s.hero_mobile_youtube_url,
    s.section2_left_image_url,
    s.section2_right_image_url,
    s.section3_background_image_url,
    s.section4_image_url,
    s.updated_at
  from public.homepage_settings s
  where s.id = 1;
end;
$$;

-- Match the ownership/folder pattern used by Chon.Love's working authenticated
-- media buckets. New homepage uploads are immutable and namespaced by auth.uid().
drop policy if exists homepage_public_admin_insert on storage.objects;
create policy homepage_public_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'homepage-public'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select public.is_super_admin())
);

drop policy if exists homepage_public_admin_update on storage.objects;
create policy homepage_public_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'homepage-public'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select public.is_super_admin())
)
with check (
  bucket_id = 'homepage-public'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select public.is_super_admin())
);

drop policy if exists homepage_public_admin_delete on storage.objects;
create policy homepage_public_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'homepage-public'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select public.is_super_admin())
);
