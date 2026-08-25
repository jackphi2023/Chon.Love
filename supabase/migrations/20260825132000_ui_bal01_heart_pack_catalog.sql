-- UI-BAL01: Chon.Love web balance exposes one canonical six-pack heart catalog.
-- Pricing remains server-owned by list_vietqr_heart_products/create_vietqr_heart_order.
-- Existing provider SKUs are retained exactly so the UI catalog change cannot orphan
-- historical Google Play/VietQR product references. Only the new 1,000-heart pack
-- introduces a new provider SKU.

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
  ('myfan_hearts_010',  1000,   10,   true, 10),
  ('myfan_hearts_050',  5000,   50,   true, 20),
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

do $$
declare
  v_active integer[];
  v_provider_ids text[];
begin
  select array_agg(display_hearts order by sort_order, display_hearts),
         array_agg(google_product_id order by sort_order, display_hearts)
  into v_active, v_provider_ids
  from public.heart_products
  where is_active;

  if v_active is distinct from array[10,50,100,200,500,1000] then
    raise exception 'UI-BAL01 active heart catalog invariant failed: %', v_active;
  end if;

  if v_provider_ids is distinct from array[
    'myfan_hearts_010',
    'myfan_hearts_050',
    'myfan_hearts_100',
    'myfan_hearts_200',
    'myfan_hearts_500',
    'myfan_hearts_1000'
  ] then
    raise exception 'UI-BAL01 provider SKU invariant failed: %', v_provider_ids;
  end if;

  if exists (
    select 1
    from public.heart_products
    where is_active
      and heart_units <> display_hearts * 100
  ) then
    raise exception 'UI-BAL01 active heart unit invariant failed';
  end if;
end $$;
