create type private.vietqr_payment_state as enum (
  'pending',
  'awaiting_confirmation',
  'paid',
  'expired',
  'cancelled',
  'rejected'
);

alter table private.play_purchases
  add column purchase_provider text not null default 'google_play',
  add column provider_order_id text,
  add column provider_transaction_ref text;

alter table private.play_purchases
  add constraint play_purchases_provider_check
    check (purchase_provider in ('google_play','vietqr')),
  add constraint play_purchases_provider_order_length
    check (provider_order_id is null or char_length(provider_order_id) between 3 and 80),
  add constraint play_purchases_provider_transaction_length
    check (provider_transaction_ref is null or char_length(provider_transaction_ref) between 3 and 160);

create unique index play_purchases_provider_order_unique_idx
  on private.play_purchases(purchase_provider,provider_order_id)
  where provider_order_id is not null;

create unique index play_purchases_provider_transaction_unique_idx
  on private.play_purchases(purchase_provider,provider_transaction_ref)
  where provider_transaction_ref is not null;

create table private.vietqr_payment_orders (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  product_id uuid not null references public.heart_products(id) on delete restrict,
  request_id uuid not null,
  credit_idempotency_key uuid not null default extensions.gen_random_uuid(),
  order_code text not null unique,
  transfer_content text not null unique,
  display_hearts integer not null,
  heart_units bigint not null,
  amount_vnd bigint not null,
  bank_bin text not null,
  bank_code text not null,
  bank_name text not null,
  account_no text not null,
  account_name text not null,
  account_name_qr text not null,
  qr_template text not null default 'compact2',
  status private.vietqr_payment_state not null default 'pending',
  linked_purchase_id uuid unique references private.play_purchases(id) on delete restrict,
  bank_transaction_ref text unique,
  submitted_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  rejected_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vietqr_orders_request_unique unique(user_id,request_id),
  constraint vietqr_orders_credit_idempotency_unique unique(credit_idempotency_key),
  constraint vietqr_orders_order_code_format check (order_code ~ '^MFQ[0-9A-F]{12}$'),
  constraint vietqr_orders_transfer_content_format check (transfer_content ~ '^MYFANMFQ[0-9A-F]{12}$'),
  constraint vietqr_orders_hearts_positive check (display_hearts > 0 and heart_units > 0),
  constraint vietqr_orders_units_match check (heart_units = display_hearts::bigint * 100),
  constraint vietqr_orders_amount_match check (amount_vnd = display_hearts::bigint * 50000),
  constraint vietqr_orders_bank_bin_format check (bank_bin ~ '^[0-9]{6}$'),
  constraint vietqr_orders_bank_code_format check (bank_code ~ '^[A-Z0-9]{2,12}$'),
  constraint vietqr_orders_account_format check (account_no ~ '^[0-9A-Za-z]{6,19}$'),
  constraint vietqr_orders_expiry_after_create check (expires_at > created_at),
  constraint vietqr_orders_state_timestamps check (
    (status='pending' and submitted_at is null and paid_at is null and cancelled_at is null and rejected_at is null)
    or (status='awaiting_confirmation' and submitted_at is not null and paid_at is null and cancelled_at is null and rejected_at is null)
    or (status='paid' and paid_at is not null and linked_purchase_id is not null and bank_transaction_ref is not null and cancelled_at is null and rejected_at is null)
    or (status='expired' and paid_at is null and cancelled_at is null and rejected_at is null)
    or (status='cancelled' and cancelled_at is not null and paid_at is null and rejected_at is null)
    or (status='rejected' and rejected_at is not null and paid_at is null and cancelled_at is null)
  )
);

create index vietqr_orders_user_created_idx
  on private.vietqr_payment_orders(user_id,created_at desc,id);

create index vietqr_orders_status_expiry_idx
  on private.vietqr_payment_orders(status,expires_at,id)
  where status in ('pending','awaiting_confirmation');

create trigger vietqr_orders_set_updated_at
before update on private.vietqr_payment_orders
for each row execute function private.set_updated_at();

alter table private.vietqr_payment_orders enable row level security;
revoke all on table private.vietqr_payment_orders from public,anon,authenticated;

insert into private.app_config(key,value_json,value_type,description,is_public)
values
  ('vietqr_web_payments_enabled','true'::jsonb,'boolean','Enable authenticated mobile-web VietQR heart purchase orders.',false),
  ('vietqr_order_expiry_minutes','30'::jsonb,'integer','Minutes before an unpaid VietQR order expires.',false),
  ('vietqr_receiving_account','{"bank_bin":"970436","bank_code":"VCB","bank_name":"Vietcombank","account_no":"0011004000713","account_name":"Tieu Vo Dinh Phi","account_name_qr":"TIEU VO DINH PHI","template":"compact2"}'::jsonb,'json','Receiving account used to snapshot VietQR payment orders.',false)
on conflict(key) do update
set value_json=excluded.value_json,
    value_type=excluded.value_type,
    description=excluded.description,
    is_public=excluded.is_public,
    updated_at=now();

create or replace function private.vietqr_account_config()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select c.value_json
  from private.app_config c
  where c.key='vietqr_receiving_account'
    and c.value_type='json'::private.config_value_type
$$;
revoke all on function private.vietqr_account_config() from public,anon,authenticated;

create or replace function private.vietqr_expiry_minutes()
returns integer
language sql
stable
security definer
set search_path=''
as $$
  select least(greatest(coalesce(private.config_integer('vietqr_order_expiry_minutes'),30),5),1440)::integer
$$;
revoke all on function private.vietqr_expiry_minutes() from public,anon,authenticated;

create or replace function private.expire_my_vietqr_orders(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  update private.vietqr_payment_orders
  set status='expired'
  where user_id=p_user_id
    and status in ('pending','awaiting_confirmation')
    and expires_at<=now();
end $$;
revoke all on function private.expire_my_vietqr_orders(uuid) from public,anon,authenticated;

create or replace function private.vietqr_image_url(p_order private.vietqr_payment_orders)
returns text
language sql
stable
security definer
set search_path=''
as $$
  select format(
    'https://img.vietqr.io/image/%s-%s-%s.png?amount=%s&addInfo=%s&accountName=%s',
    p_order.bank_code,
    p_order.account_no,
    p_order.qr_template,
    p_order.amount_vnd,
    p_order.transfer_content,
    replace(p_order.account_name_qr,' ','%20')
  )
$$;
revoke all on function private.vietqr_image_url(private.vietqr_payment_orders) from public,anon,authenticated;

create or replace function public.list_vietqr_heart_products()
returns table(
  product_id uuid,
  google_product_id text,
  display_hearts integer,
  heart_units bigint,
  amount_vnd bigint,
  sort_order integer
)
language sql
stable
security definer
set search_path=''
as $$
  select hp.id,hp.google_product_id,hp.display_hearts,hp.heart_units,hp.display_hearts::bigint*50000,hp.sort_order
  from public.heart_products hp
  where hp.is_active
  order by hp.sort_order,hp.id
$$;
revoke all on function public.list_vietqr_heart_products() from public,anon;
grant execute on function public.list_vietqr_heart_products() to authenticated,service_role;

create or replace function public.create_vietqr_heart_order(
  p_product_id uuid,
  p_request_id uuid
)
returns table(
  order_id uuid,
  order_code text,
  status text,
  product_id uuid,
  display_hearts integer,
  heart_units bigint,
  amount_vnd bigint,
  bank_bin text,
  bank_code text,
  bank_name text,
  account_no text,
  account_name text,
  transfer_content text,
  qr_image_url text,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_product public.heart_products%rowtype;
  v_order private.vietqr_payment_orders%rowtype;
  v_config jsonb;
  v_seed text;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;
  if p_product_id is null or p_request_id is null then
    raise exception using errcode='22023',message='product_and_request_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode='42501',message='active_adult_account_required';
  end if;

  perform private.expire_my_vietqr_orders(v_user_id);
  select * into v_order
  from private.vietqr_payment_orders
  where user_id=v_user_id and request_id=p_request_id;
  if found then
    return query select v_order.id,v_order.order_code,v_order.status::text,v_order.product_id,v_order.display_hearts,v_order.heart_units,v_order.amount_vnd,
      v_order.bank_bin,v_order.bank_code,v_order.bank_name,v_order.account_no,v_order.account_name,v_order.transfer_content,
      private.vietqr_image_url(v_order),v_order.expires_at,v_order.created_at;
    return;
  end if;

  select * into v_product from public.heart_products where id=p_product_id and is_active;
  if not found then
    raise exception using errcode='22023',message='heart_product_not_active';
  end if;

  v_config:=private.vietqr_account_config();
  if v_config is null then
    raise exception using errcode='55000',message='vietqr_account_not_configured';
  end if;

  v_seed:=upper(substr(replace(extensions.gen_random_uuid()::text,'-',''),1,12));
  insert into private.vietqr_payment_orders(
    user_id,product_id,request_id,order_code,transfer_content,display_hearts,heart_units,amount_vnd,
    bank_bin,bank_code,bank_name,account_no,account_name,account_name_qr,qr_template,expires_at
  ) values(
    v_user_id,v_product.id,p_request_id,'MFQ'||v_seed,'MYFANMFQ'||v_seed,v_product.display_hearts,v_product.heart_units,v_product.display_hearts::bigint*50000,
    v_config->>'bank_bin',v_config->>'bank_code',v_config->>'bank_name',v_config->>'account_no',v_config->>'account_name',v_config->>'account_name_qr',coalesce(v_config->>'template','compact2'),
    now()+make_interval(mins=>private.vietqr_expiry_minutes())
  ) returning * into v_order;

  return query select v_order.id,v_order.order_code,v_order.status::text,v_order.product_id,v_order.display_hearts,v_order.heart_units,v_order.amount_vnd,
    v_order.bank_bin,v_order.bank_code,v_order.bank_name,v_order.account_no,v_order.account_name,v_order.transfer_content,
    private.vietqr_image_url(v_order),v_order.expires_at,v_order.created_at;
end $$;
revoke all on function public.create_vietqr_heart_order(uuid,uuid) from public,anon;
grant execute on function public.create_vietqr_heart_order(uuid,uuid) to authenticated,service_role;

create or replace function public.get_my_vietqr_heart_order(p_order_id uuid)
returns table(
  order_id uuid,
  order_code text,
  status text,
  product_id uuid,
  display_hearts integer,
  heart_units bigint,
  amount_vnd bigint,
  bank_bin text,
  bank_code text,
  bank_name text,
  account_no text,
  account_name text,
  transfer_content text,
  qr_image_url text,
  expires_at timestamptz,
  submitted_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_order private.vietqr_payment_orders%rowtype;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  perform private.expire_my_vietqr_orders(v_user_id);
  select * into v_order from private.vietqr_payment_orders where id=p_order_id and user_id=v_user_id;
  if not found then raise exception using errcode='P0002',message='vietqr_order_not_found'; end if;
  return query select v_order.id,v_order.order_code,v_order.status::text,v_order.product_id,v_order.display_hearts,v_order.heart_units,v_order.amount_vnd,
    v_order.bank_bin,v_order.bank_code,v_order.bank_name,v_order.account_no,v_order.account_name,v_order.transfer_content,
    private.vietqr_image_url(v_order),v_order.expires_at,v_order.submitted_at,v_order.paid_at,v_order.created_at;
end $$;
revoke all on function public.get_my_vietqr_heart_order(uuid) from public,anon;
grant execute on function public.get_my_vietqr_heart_order(uuid) to authenticated,service_role;

create or replace function public.mark_my_vietqr_transfer_submitted(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_status private.vietqr_payment_state;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  perform private.expire_my_vietqr_orders(v_user_id);
  update private.vietqr_payment_orders
  set status='awaiting_confirmation',submitted_at=coalesce(submitted_at,now())
  where id=p_order_id and user_id=v_user_id and status='pending'
  returning status into v_status;
  if found then return v_status::text; end if;
  select status into v_status from private.vietqr_payment_orders where id=p_order_id and user_id=v_user_id;
  if not found then raise exception using errcode='P0002',message='vietqr_order_not_found'; end if;
  return v_status::text;
end $$;
revoke all on function public.mark_my_vietqr_transfer_submitted(uuid) from public,anon;
grant execute on function public.mark_my_vietqr_transfer_submitted(uuid) to authenticated,service_role;

create or replace function public.cancel_my_vietqr_heart_order(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_status private.vietqr_payment_state;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  perform private.expire_my_vietqr_orders(v_user_id);
  update private.vietqr_payment_orders
  set status='cancelled',cancelled_at=now()
  where id=p_order_id and user_id=v_user_id and status in ('pending','awaiting_confirmation')
  returning status into v_status;
  if found then return v_status::text; end if;
  select status into v_status from private.vietqr_payment_orders where id=p_order_id and user_id=v_user_id;
  if not found then raise exception using errcode='P0002',message='vietqr_order_not_found'; end if;
  return v_status::text;
end $$;
revoke all on function public.cancel_my_vietqr_heart_order(uuid) from public,anon;
grant execute on function public.cancel_my_vietqr_heart_order(uuid) to authenticated,service_role;

create or replace function public.record_verified_vietqr_payment(
  p_order_id uuid,
  p_bank_transaction_ref text,
  p_paid_amount_vnd bigint,
  p_verification_id uuid
)
returns table(
  order_id uuid,
  purchase_id uuid,
  heart_units bigint,
  balance_after_units bigint,
  status text,
  already_recorded boolean
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_order private.vietqr_payment_orders%rowtype;
  v_product public.heart_products%rowtype;
  v_purchase_id uuid;
  v_account private.heart_accounts%rowtype;
  v_ref text:=upper(btrim(p_bank_transaction_ref));
  v_token_hash text;
begin
  if p_order_id is null or p_verification_id is null then raise exception using errcode='22023',message='order_and_verification_required'; end if;
  if v_ref is null or char_length(v_ref) not between 3 and 160 then raise exception using errcode='22023',message='invalid_bank_transaction_ref'; end if;
  perform pg_advisory_xact_lock(hashtextextended('vietqr:'||p_order_id::text,0));
  select * into v_order from private.vietqr_payment_orders where id=p_order_id for update;
  if not found then raise exception using errcode='P0002',message='vietqr_order_not_found'; end if;
  if v_order.status='paid' then
    select * into v_account from private.heart_accounts where user_id=v_order.user_id;
    return query select v_order.id,v_order.linked_purchase_id,v_order.heart_units,v_account.available_units,v_order.status::text,true;
    return;
  end if;
  if v_order.status not in ('pending','awaiting_confirmation','expired') then raise exception using errcode='22023',message='vietqr_order_not_settleable'; end if;
  if p_paid_amount_vnd<>v_order.amount_vnd then raise exception using errcode='22023',message='vietqr_amount_mismatch'; end if;
  if exists(select 1 from private.vietqr_payment_orders o where o.bank_transaction_ref=v_ref and o.id<>v_order.id) then raise exception using errcode='23505',message='bank_transaction_already_used'; end if;
  select * into v_product from public.heart_products where id=v_order.product_id;
  if not found then raise exception using errcode='P0002',message='heart_product_not_found'; end if;

  perform private.ensure_economy_accounts(v_order.user_id);
  select * into v_account from private.heart_accounts where user_id=v_order.user_id for update;
  v_token_hash:=encode(extensions.digest('vietqr:'||v_order.id::text||':'||v_ref,'sha256'),'hex');

  insert into private.play_purchases(
    user_id,product_id,google_product_id,purchase_token_hash,google_order_id,purchase_state,heart_units,currency_code,gross_amount_micros,country_code,
    obfuscated_external_account_id,is_test_purchase,verified_at,acknowledged_at,consumed_at,idempotency_key,purchase_provider,provider_order_id,provider_transaction_ref
  ) values(
    v_order.user_id,v_product.id,v_product.google_product_id,v_token_hash,null,'consumed',v_order.heart_units,'VND',v_order.amount_vnd*1000000,'VN',
    null,false,now(),now(),now(),v_order.credit_idempotency_key,'vietqr',v_order.transfer_content,v_ref
  ) returning id into v_purchase_id;

  insert into private.heart_lots(purchase_id,user_id,original_units,available_units)
  values(v_purchase_id,v_order.user_id,v_order.heart_units,v_order.heart_units);

  update private.heart_accounts
  set available_units=available_units+v_order.heart_units,
      lifetime_purchased_units=lifetime_purchased_units+v_order.heart_units,
      version=version+1
  where user_id=v_order.user_id
  returning * into v_account;

  insert into private.heart_ledger(user_id,entry_type,amount_units,balance_after_units,reference_type,reference_id,idempotency_key,metadata_json)
  values(v_order.user_id,'purchase_credit',v_order.heart_units,v_account.available_units,'vietqr_payment',v_order.id,v_order.credit_idempotency_key,
    jsonb_build_object('provider','vietqr','order_code',v_order.order_code,'amount_vnd',v_order.amount_vnd,'bank_transaction_ref',v_ref,'verification_id',p_verification_id));

  update public.economy_sync
  set heart_account_version=v_account.version,updated_at=now()
  where user_id=v_order.user_id;

  update private.vietqr_payment_orders
  set status='paid',linked_purchase_id=v_purchase_id,bank_transaction_ref=v_ref,paid_at=now()
  where id=v_order.id;

  return query select v_order.id,v_purchase_id,v_order.heart_units,v_account.available_units,'paid'::text,false;
end $$;
revoke all on function public.record_verified_vietqr_payment(uuid,text,bigint,uuid) from public,anon,authenticated;
grant execute on function public.record_verified_vietqr_payment(uuid,text,bigint,uuid) to service_role;

comment on table private.vietqr_payment_orders is 'Authenticated mobile-web VietQR orders. Bank transfer confirmation must be reconciled server-side before heart credit.';
comment on function public.record_verified_vietqr_payment(uuid,text,bigint,uuid) is 'Service-role-only VietQR settlement. Credits a normal FIFO heart lot and immutable ledger entry after exact-amount bank reconciliation.';
