-- UI-BAL01: Chon.Love web balance exposes one canonical six-pack heart catalog.
-- Pricing remains server-owned by list_vietqr_heart_products/create_vietqr_heart_order.

update public.heart_products
set is_active = false,
    updated_at = now()
where is_active = true;

insert into public.heart_products (
  google_product_id,
  heart_units,
  display_hearts,
  is_active,
  sort_order
)
values
  ('myfan_hearts_10',   1000,   10,   true, 10),
  ('myfan_hearts_50',   5000,   50,   true, 20),
  ('myfan_hearts_100',  10000,  100,  true, 30),
  ('myfan_hearts_200',  20000,  200,  true, 40),
  ('myfan_hearts_500',  50000,  500,  true, 50),
  ('myfan_hearts_1000', 100000, 1000, true, 60)
on conflict (google_product_id) do update
set heart_units = excluded.heart_units,
    display_hearts = excluded.display_hearts,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order,
    updated_at = now();
