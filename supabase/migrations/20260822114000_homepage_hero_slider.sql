-- Chon.Love responsive homepage hero slider.
-- Slider images take precedence over the existing YouTube hero in the client.
-- Keep the legacy update RPC intact for rolling-deploy compatibility; the new
-- publish RPC atomically updates videos, slider pairs and existing homepage art.

alter table public.homepage_settings
add column hero_slider_images jsonb not null default '[]'::jsonb;

alter table public.homepage_settings
add constraint homepage_settings_hero_slider_images_shape
check (
  jsonb_typeof(hero_slider_images) = 'array'
  and jsonb_array_length(hero_slider_images) <= 8
);

drop function public.get_public_homepage_settings();
create function public.get_public_homepage_settings()
returns table (
  hero_desktop_youtube_url text,
  hero_mobile_youtube_url text,
  hero_slider_images jsonb,
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
    s.hero_slider_images,
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

drop function public.admin_get_homepage_settings(uuid);
create function public.admin_get_homepage_settings(p_actor_user_id uuid)
returns table(
  hero_desktop_youtube_url text,
  hero_mobile_youtube_url text,
  hero_slider_images jsonb,
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
    s.hero_slider_images,
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

create function public.admin_publish_homepage_settings(
  p_actor_user_id uuid,
  p_hero_desktop_youtube_url text,
  p_hero_mobile_youtube_url text,
  p_hero_slider_images jsonb,
  p_section2_left_image_url text,
  p_section2_right_image_url text,
  p_section3_background_image_url text,
  p_section4_image_url text
)
returns table(
  hero_desktop_youtube_url text,
  hero_mobile_youtube_url text,
  hero_slider_images jsonb,
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
  v_slides jsonb := coalesce(p_hero_slider_images, '[]'::jsonb);
  v_slide jsonb;
  v_slide_id text;
  v_slide_desktop text;
  v_slide_mobile text;
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
  if jsonb_typeof(v_slides) <> 'array' or jsonb_array_length(v_slides) > 8 then
    raise exception using errcode = '22023', message = 'invalid_hero_slider_images';
  end if;

  for v_slide in select slide.value from jsonb_array_elements(v_slides) as slide(value)
  loop
    if jsonb_typeof(v_slide) <> 'object' then
      raise exception using errcode = '22023', message = 'invalid_hero_slide_object';
    end if;

    v_slide_id := nullif(btrim(coalesce(v_slide ->> 'id', '')), '');
    v_slide_desktop := nullif(btrim(coalesce(v_slide ->> 'desktop_url', '')), '');
    v_slide_mobile := nullif(btrim(coalesce(v_slide ->> 'mobile_url', '')), '');

    if v_slide_id is null or v_slide_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception using errcode = '22023', message = 'invalid_hero_slide_id';
    end if;
    if v_slide_desktop is null or v_slide_desktop !~* '^https://' then
      raise exception using errcode = '22023', message = 'invalid_hero_slide_desktop_url';
    end if;
    if v_slide_mobile is null or v_slide_mobile !~* '^https://' then
      raise exception using errcode = '22023', message = 'invalid_hero_slide_mobile_url';
    end if;
  end loop;

  if (
    select count(*) <> count(distinct slide.value ->> 'id')
    from jsonb_array_elements(v_slides) as slide(value)
  ) then
    raise exception using errcode = '22023', message = 'duplicate_hero_slide_id';
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
      hero_slider_images = v_slides,
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
    s.hero_slider_images,
    s.section2_left_image_url,
    s.section2_right_image_url,
    s.section3_background_image_url,
    s.section4_image_url,
    s.updated_at
  from public.homepage_settings s
  where s.id = 1;
end;
$$;

revoke all on function public.admin_publish_homepage_settings(uuid,text,text,jsonb,text,text,text,text) from public;
grant execute on function public.admin_publish_homepage_settings(uuid,text,text,jsonb,text,text,text,text) to authenticated;
