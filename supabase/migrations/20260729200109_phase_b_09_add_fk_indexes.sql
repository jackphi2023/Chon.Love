create index if not exists gift_catalog_icon_media_idx on public.gift_catalog(icon_media_id) where icon_media_id is not null;
