alter table public.gift_catalog
  add column if not exists icon_emoji text;

do $$
begin
  if (select count(*) from public.gift_catalog) <> 20 then
    raise exception 'session_19_requires_exactly_20_catalog_rows';
  end if;
end;
$$;

with ordered as (
  select id, row_number() over (order by sort_order, id)::integer as position
  from public.gift_catalog
)
update public.gift_catalog as gift
set slug = 'session19_' || lpad(ordered.position::text, 2, '0')
from ordered
where gift.id = ordered.id;

with ordered as (
  select id, row_number() over (order by sort_order, id)::integer as position
  from public.gift_catalog
), catalog(position, slug, name_vi, name_en, icon_emoji) as (
  values
    (1, 'donut', 'Donut', 'Donut', '🍩'),
    (2, 'chocolate', 'Sô-cô-la', 'Chocolate', '🍫'),
    (3, 'cake', 'Bánh kem', 'Cake', '🍰'),
    (4, 'cherry_blossom', 'Hoa anh đào', 'Cherry Blossom', '🌸'),
    (5, 'rose', 'Hoa hồng', 'Rose', '🌹'),
    (6, 'coffee', 'Cà phê', 'Coffee', '☕'),
    (7, 'teddy_bear', 'Gấu bông', 'Teddy Bear', '🧸'),
    (8, 'heart', 'Trái tim', 'Heart', '❤️'),
    (9, 'bouquet', 'Bó hoa', 'Bouquet', '💐'),
    (10, 'lipstick', 'Son môi', 'Lipstick', '💄'),
    (11, 'cocktail', 'Cocktail', 'Cocktail', '🍸'),
    (12, 'dress', 'Váy', 'Dress', '👗'),
    (13, 'birthday_cake', 'Quà sinh nhật', 'Birthday Gift', '🎂'),
    (14, 'champagne', 'Champagne', 'Champagne', '🍾'),
    (15, 'handbag', 'Túi xách', 'Handbag', '👜'),
    (16, 'unicorn', 'Kỳ lân', 'Unicorn', '🦄'),
    (17, 'diamond', 'Kim cương', 'Diamond', '💎'),
    (18, 'ring', 'Nhẫn', 'Ring', '💍'),
    (19, 'supercar', 'Siêu xe', 'Supercar', '🚗'),
    (20, 'crown', 'Vương miện', 'Crown', '👑')
)
update public.gift_catalog as gift
set slug = catalog.slug,
    name_vi = catalog.name_vi,
    name_en = catalog.name_en,
    icon_emoji = catalog.icon_emoji,
    display_hearts = catalog.position,
    heart_price_units = catalog.position::bigint * 100,
    sort_order = catalog.position,
    is_active = true,
    deleted_at = null,
    updated_at = now()
from ordered
join catalog using (position)
where gift.id = ordered.id;

alter table public.gift_catalog
  alter column icon_emoji set not null;

alter table public.gift_catalog
  drop constraint if exists gift_catalog_icon_emoji_length;
alter table public.gift_catalog
  add constraint gift_catalog_icon_emoji_length
  check (char_length(btrim(icon_emoji)) between 1 and 16);

alter table public.gift_catalog
  drop constraint if exists gift_catalog_v1_heart_range;
alter table public.gift_catalog
  add constraint gift_catalog_v1_heart_range
  check (display_hearts between 1 and 20);

alter table public.gift_catalog
  drop constraint if exists gift_catalog_v1_sort_range;
alter table public.gift_catalog
  add constraint gift_catalog_v1_sort_range
  check (sort_order between 1 and 20);

create unique index if not exists gift_catalog_active_display_hearts_key
  on public.gift_catalog(display_hearts)
  where is_active and deleted_at is null;

create unique index if not exists gift_catalog_active_sort_order_key
  on public.gift_catalog(sort_order)
  where is_active and deleted_at is null;

comment on column public.gift_catalog.icon_emoji is
  'Admin-configurable safe fallback icon for gift catalog surfaces when no approved icon_media_id exists.';
