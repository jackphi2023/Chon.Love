-- MyFan local-only fake seed data.
-- These TEST-* administrative codes are not official Vietnamese administrative codes
-- and must never be promoted as production reference data.

insert into public.administrative_areas (
  id,
  code,
  name_vi,
  name_en,
  area_type,
  country_code,
  sort_order,
  is_active
)
values
  (
    '11000000-0000-0000-0000-000000000001',
    'TEST-VN-PROVINCE-A',
    'Tỉnh kiểm thử A',
    'Test Province A',
    'province',
    'VN',
    10,
    true
  ),
  (
    '11000000-0000-0000-0000-000000000002',
    'TEST-VN-PROVINCE-B',
    'Tỉnh kiểm thử B',
    'Test Province B',
    'province',
    'VN',
    20,
    true
  ),
  (
    '11000000-0000-0000-0000-000000000003',
    'TEST-VN-MUNICIPALITY-C',
    'Thành phố kiểm thử C',
    'Test Municipality C',
    'municipality',
    'VN',
    30,
    true
  )
on conflict (country_code, code) do update
set
  name_vi = excluded.name_vi,
  name_en = excluded.name_en,
  area_type = excluded.area_type,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;
