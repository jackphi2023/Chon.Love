-- LX-17 follow-up: make PL/pgSQL output-column precedence explicit.
-- RETURNS TABLE exposes order_id/order_code/status/... as PL/pgSQL variables; use_column
-- prevents those output variables from making table column references ambiguous in runtime plans.

create or replace function public.create_luxy_membership_order(
  p_tier public.luxy_membership_tier,
  p_period_count integer,
  p_request_id uuid,
  p_source text default 'membership'
)
returns table(
  order_id uuid,
  order_code text,
  status text,
  tier public.luxy_membership_tier,
  period_count integer,
  monthly_price_vnd bigint,
  discount_bps integer,
  amount_due_vnd bigint,
  heart_credit_units bigint,
  created_at timestamptz
)
language plpgsql volatile security definer set search_path=''
as $$
#variable_conflict use_column
declare
  v_user_id uuid:=auth.uid();
  v_source text:=lower(btrim(coalesce(p_source,'')));
  v_order private.luxy_membership_orders%rowtype;
  v_monthly bigint;
  v_discount integer;
  v_amount bigint;
  v_heart bigint;
  v_seed text;
begin
  if v_user_id is null then
    raise exception using errcode='28000',message='authentication_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode='42501',message='active_adult_account_required';
  end if;
  if p_tier not in ('premium','diamond') then
    raise exception using errcode='22023',message='paid_membership_tier_required';
  end if;
  if p_period_count not in (1,3) then
    raise exception using errcode='22023',message='membership_period_count_must_be_1_or_3';
  end if;
  if p_request_id is null then
    raise exception using errcode='22023',message='request_id_required';
  end if;
  if v_source='' or v_source!~'^[a-z][a-z0-9_]{1,63}$' then
    raise exception using errcode='22023',message='invalid_membership_source';
  end if;

  select o.*
  into v_order
  from private.luxy_membership_orders as o
  where o.user_id=v_user_id and o.request_id=p_request_id;

  if found then
    return query
    select
      v_order.id,
      v_order.order_code,
      v_order.status,
      v_order.requested_tier,
      v_order.period_count,
      v_order.monthly_price_vnd,
      v_order.discount_bps,
      v_order.amount_due_vnd,
      v_order.diamond_heart_credit_units,
      v_order.created_at;
    return;
  end if;

  v_monthly:=private.luxy_membership_monthly_price_vnd(p_tier);
  v_discount:=private.luxy_membership_discount_bps(p_period_count);
  v_amount:=private.luxy_membership_amount_due_vnd(p_tier,p_period_count);
  v_heart:=private.luxy_membership_heart_credit_units(p_tier,v_amount);
  v_seed:=upper(substr(replace(extensions.gen_random_uuid()::text,'-',''),1,12));

  insert into private.luxy_membership_orders(
    user_id,request_id,requested_tier,period_count,monthly_price_vnd,discount_bps,
    amount_due_vnd,diamond_heart_credit_units,order_code,source
  ) values (
    v_user_id,p_request_id,p_tier,p_period_count,v_monthly,v_discount,
    v_amount,v_heart,'LXM'||v_seed,v_source
  )
  returning private.luxy_membership_orders.* into v_order;

  return query
  select
    v_order.id,
    v_order.order_code,
    v_order.status,
    v_order.requested_tier,
    v_order.period_count,
    v_order.monthly_price_vnd,
    v_order.discount_bps,
    v_order.amount_due_vnd,
    v_order.diamond_heart_credit_units,
    v_order.created_at;
end;
$$;

revoke all on function public.create_luxy_membership_order(public.luxy_membership_tier,integer,uuid,text) from public,anon;
grant execute on function public.create_luxy_membership_order(public.luxy_membership_tier,integer,uuid,text) to authenticated,service_role;
