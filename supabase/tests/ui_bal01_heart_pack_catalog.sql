begin;

do $$
declare
  v_active integer[];
  v_server integer[];
  v_amounts bigint[];
begin
  select array_agg(display_hearts order by sort_order, display_hearts)
  into v_active
  from public.heart_products
  where is_active;

  if v_active is distinct from array[10,50,100,200,500,1000] then
    raise exception 'UI-BAL01 active heart catalog mismatch: %', v_active;
  end if;

  select
    array_agg(display_hearts order by sort_order, display_hearts),
    array_agg(amount_vnd order by sort_order, display_hearts)
  into v_server, v_amounts
  from public.list_vietqr_heart_products();

  if v_server is distinct from array[10,50,100,200,500,1000] then
    raise exception 'UI-BAL01 VietQR catalog mismatch: %', v_server;
  end if;

  if array_length(v_amounts, 1) <> 6 or exists (
    select 1
    from public.list_vietqr_heart_products()
    where amount_vnd <= 0
  ) then
    raise exception 'UI-BAL01 server-priced amounts must be present and positive';
  end if;

  if exists (
    select 1
    from public.list_vietqr_heart_products()
    where display_hearts in (5,20)
  ) then
    raise exception 'UI-BAL01 retired 5/20 packs must not remain active';
  end if;
end $$;

rollback;
