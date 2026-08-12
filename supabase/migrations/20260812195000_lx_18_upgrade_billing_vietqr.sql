-- LX-18 — Seeking-like Upgrade/Billing + web VietQR checkout.
-- Membership pricing/status stays authoritative in LX-17. This migration only snapshots
-- safe receiving-account data for a caller-owned membership order and exposes read APIs.
-- Membership checkout has its own product gate: BR-07 intentionally keeps legacy heart-topup
-- VietQR disabled, while the explicit LX-18 product decision enables manually reviewed membership checkout.

insert into private.app_config(key,value_json,value_type,description,is_public)
values(
  'luxy_membership_vietqr_web_enabled',
  'true'::jsonb,
  'boolean',
  'Enable web/PWA VietQR checkout for LX-17 Premium/Diamond membership orders. Activation still requires Finance Admin or Super Admin review.',
  false
)
on conflict(key) do update
set value_json=excluded.value_json,
    value_type=excluded.value_type,
    description=excluded.description,
    is_public=false,
    updated_at=now();

create table private.luxy_membership_checkout_snapshots (
  order_id uuid primary key references private.luxy_membership_orders(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  transfer_content text not null unique,
  bank_bin text not null,
  bank_code text not null,
  bank_name text not null,
  account_no text not null,
  account_name text not null,
  account_name_qr text not null,
  qr_template text not null default 'compact2',
  created_at timestamptz not null default now(),
  constraint luxy_membership_checkout_transfer_format
    check (transfer_content ~ '^LUXYLXM[0-9A-F]{12}$'),
  constraint luxy_membership_checkout_bank_bin_format
    check (bank_bin ~ '^[0-9]{6}$'),
  constraint luxy_membership_checkout_bank_code_format
    check (bank_code ~ '^[A-Z0-9]{2,12}$'),
  constraint luxy_membership_checkout_account_format
    check (account_no ~ '^[0-9A-Za-z]{6,19}$')
);

create index luxy_membership_checkout_user_created_idx
  on private.luxy_membership_checkout_snapshots(user_id,created_at desc,order_id);

alter table private.luxy_membership_checkout_snapshots enable row level security;
revoke all on table private.luxy_membership_checkout_snapshots from public,anon,authenticated;
grant all on table private.luxy_membership_checkout_snapshots to service_role;

create or replace function private.luxy_membership_checkout_image_url(
  p_snapshot private.luxy_membership_checkout_snapshots,
  p_amount_vnd bigint
)
returns text
language sql
stable
security definer
set search_path=''
as $$
  select format(
    'https://img.vietqr.io/image/%s-%s-%s.png?amount=%s&addInfo=%s&accountName=%s',
    p_snapshot.bank_code,
    p_snapshot.account_no,
    p_snapshot.qr_template,
    p_amount_vnd,
    p_snapshot.transfer_content,
    replace(p_snapshot.account_name_qr,' ','%20')
  )
$$;
revoke all on function private.luxy_membership_checkout_image_url(private.luxy_membership_checkout_snapshots,bigint) from public,anon,authenticated;
grant execute on function private.luxy_membership_checkout_image_url(private.luxy_membership_checkout_snapshots,bigint) to service_role;

create or replace function private.ensure_luxy_membership_checkout_snapshot(
  p_order private.luxy_membership_orders
)
returns private.luxy_membership_checkout_snapshots
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_snapshot private.luxy_membership_checkout_snapshots%rowtype;
  v_config jsonb;
begin
  select * into v_snapshot
  from private.luxy_membership_checkout_snapshots s
  where s.order_id=p_order.id;
  if found then return v_snapshot; end if;

  if coalesce(private.config_boolean('luxy_membership_vietqr_web_enabled'),false) is not true then
    raise exception using errcode='55000',message='membership_vietqr_disabled';
  end if;

  v_config:=private.vietqr_account_config();
  if v_config is null then
    raise exception using errcode='55000',message='vietqr_account_not_configured';
  end if;

  insert into private.luxy_membership_checkout_snapshots(
    order_id,user_id,transfer_content,bank_bin,bank_code,bank_name,account_no,
    account_name,account_name_qr,qr_template
  ) values (
    p_order.id,p_order.user_id,'LUXY'||p_order.order_code,
    v_config->>'bank_bin',upper(v_config->>'bank_code'),v_config->>'bank_name',
    v_config->>'account_no',v_config->>'account_name',v_config->>'account_name_qr',
    coalesce(v_config->>'template','compact2')
  )
  on conflict(order_id) do nothing;

  select * into strict v_snapshot
  from private.luxy_membership_checkout_snapshots s
  where s.order_id=p_order.id;
  return v_snapshot;
end;
$$;
revoke all on function private.ensure_luxy_membership_checkout_snapshot(private.luxy_membership_orders) from public,anon,authenticated;
grant execute on function private.ensure_luxy_membership_checkout_snapshot(private.luxy_membership_orders) to service_role;

create or replace function public.get_my_luxy_membership_checkout(p_order_id uuid)
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
  heart_credit_display bigint,
  bank_bin text,
  bank_code text,
  bank_name text,
  account_no text,
  account_name text,
  transfer_content text,
  qr_image_url text,
  submitted_at timestamptz,
  membership_expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_order private.luxy_membership_orders%rowtype;
  v_snapshot private.luxy_membership_checkout_snapshots%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode='28000',message='authentication_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode='42501',message='active_adult_account_required';
  end if;
  if p_order_id is null then
    raise exception using errcode='22023',message='membership_order_required';
  end if;

  select * into v_order
  from private.luxy_membership_orders o
  where o.id=p_order_id and o.user_id=v_user_id;
  if not found then
    raise exception using errcode='P0002',message='membership_order_not_found';
  end if;

  v_snapshot:=private.ensure_luxy_membership_checkout_snapshot(v_order);

  return query select
    v_order.id,
    v_order.order_code,
    v_order.status,
    v_order.requested_tier,
    v_order.period_count,
    v_order.monthly_price_vnd,
    v_order.discount_bps,
    v_order.amount_due_vnd,
    v_order.diamond_heart_credit_units,
    v_order.diamond_heart_credit_units/100,
    v_snapshot.bank_bin,
    v_snapshot.bank_code,
    v_snapshot.bank_name,
    v_snapshot.account_no,
    v_snapshot.account_name,
    v_snapshot.transfer_content,
    private.luxy_membership_checkout_image_url(v_snapshot,v_order.amount_due_vnd),
    v_order.submitted_at,
    v_order.membership_expires_at,
    v_order.created_at;
end;
$$;
revoke all on function public.get_my_luxy_membership_checkout(uuid) from public,anon;
grant execute on function public.get_my_luxy_membership_checkout(uuid) to authenticated,service_role;

create or replace function public.list_my_luxy_membership_orders(
  p_limit integer default 10,
  p_offset integer default 0
)
returns table(
  order_id uuid,
  order_code text,
  status text,
  tier public.luxy_membership_tier,
  period_count integer,
  amount_due_vnd bigint,
  heart_credit_units bigint,
  membership_expires_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode='28000',message='authentication_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode='42501',message='active_adult_account_required';
  end if;
  if p_limit not between 1 and 50 or p_offset<0 then
    raise exception using errcode='22023',message='invalid_pagination';
  end if;

  return query
  select o.id,o.order_code,o.status,o.requested_tier,o.period_count,o.amount_due_vnd,
    o.diamond_heart_credit_units,o.membership_expires_at,o.submitted_at,o.created_at
  from private.luxy_membership_orders o
  where o.user_id=v_user_id
  order by o.created_at desc,o.id desc
  limit p_limit offset p_offset;
end;
$$;
revoke all on function public.list_my_luxy_membership_orders(integer,integer) from public,anon;
grant execute on function public.list_my_luxy_membership_orders(integer,integer) to authenticated,service_role;

comment on function public.get_my_luxy_membership_checkout(uuid) is
  'LX-18: caller-owned Premium/Diamond order plus safe VietQR receiving-account snapshot. Does not approve or activate membership.';
comment on function public.list_my_luxy_membership_orders(integer,integer) is
  'LX-18: caller-owned membership billing history. Finance/Admin remains the only activation path.';