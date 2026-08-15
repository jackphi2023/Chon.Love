update public.homepage_settings
set hero_desktop_youtube_url = 'https://www.youtube.com/watch?v=zWPQNc4tRxg',
    hero_mobile_youtube_url = 'https://www.youtube.com/shorts/rGiUkadX-xk',
    updated_at = now(),
    updated_by = null
where id = 1
  and hero_desktop_youtube_url is null
  and hero_mobile_youtube_url is null;
