create table if not exists public.homepage_settings (
  id smallint primary key default 1 check (id = 1),
  hero_desktop_youtube_url text,
  hero_mobile_youtube_url text,
  section2_left_image_url text,
  section2_right_image_url text,
  section3_background_image_url text,
  section4_image_url text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.homepage_settings enable row level security;
revoke all on table public.homepage_settings from anon, authenticated;

insert into public.homepage_settings (id)
values (1)
on conflict (id) do nothing;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'super_admin'::private.user_role
      and ur.revoked_at is null
  );
$$;

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;

create or replace function public.get_public_homepage_settings()
returns table (
  hero_desktop_youtube_url text,
  hero_mobile_youtube_url text,
  section2_left_image_url text,
  section2_right_image_url text,
  section3_background_image_url text,
  section4_image_url text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.get_public_homepage_settings() from public;
grant execute on function public.get_public_homepage_settings() to anon, authenticated;

create or replace function public.admin_get_homepage_settings(p_actor_user_id uuid)
returns table (
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

revoke all on function public.admin_get_homepage_settings(uuid) from public;
grant execute on function public.admin_get_homepage_settings(uuid) to authenticated;

create or replace function public.admin_update_homepage_settings(
  p_actor_user_id uuid,
  p_hero_desktop_youtube_url text,
  p_hero_mobile_youtube_url text,
  p_section2_left_image_url text,
  p_section2_right_image_url text,
  p_section3_background_image_url text,
  p_section4_image_url text
)
returns table (
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
      updated_by = p_actor_user_id
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

revoke all on function public.admin_update_homepage_settings(uuid,text,text,text,text,text,text) from public;
grant execute on function public.admin_update_homepage_settings(uuid,text,text,text,text,text,text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'homepage-public',
  'homepage-public',
  true,
  8388608,
  array['image/jpeg','image/png','image/webp','image/avif']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists homepage_public_admin_insert on storage.objects;
create policy homepage_public_admin_insert
on storage.objects for insert
to authenticated
with check (bucket_id = 'homepage-public' and public.is_super_admin());

drop policy if exists homepage_public_admin_update on storage.objects;
create policy homepage_public_admin_update
on storage.objects for update
to authenticated
using (bucket_id = 'homepage-public' and public.is_super_admin())
with check (bucket_id = 'homepage-public' and public.is_super_admin());

drop policy if exists homepage_public_admin_delete on storage.objects;
create policy homepage_public_admin_delete
on storage.objects for delete
to authenticated
using (bucket_id = 'homepage-public' and public.is_super_admin());
