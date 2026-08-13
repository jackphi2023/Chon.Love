-- LX-17: Luxy Premium / Diamond membership engine.
--
-- Product contract (2026-08-12):
-- - Premium: 1,000,000 VND/month.
-- - Diamond: 5,000,000 VND/month.
-- - Purchase terms: 1 period or 3 periods; 3 periods receive 20% off the total.
-- - Payment does not grant entitlements until a finance_admin/super_admin confirms exact payment.
-- - Effective entitlements expire automatically at expires_at because all entitlement helpers are time-aware.
-- - Diamond receives an in-app heart credit equal to 80% of the confirmed membership payment.
-- - Premium may hide online presence. Diamond may hide online presence and hide from Search/member listing.
-- - Search visibility priority: Diamond > Premium > Free, then the requested Seeking-derived sort.
-- - Paid membership badges are presentation signals for all paid members, independent of gender.

insert into private.app_config(key,value_json,value_type,description,is_public)
values
  ('luxy_premium_monthly_vnd','1000000'::jsonb,'integer','LX-17 Premium monthly price in VND.',false),
  ('luxy_diamond_monthly_vnd','5000000'::jsonb,'integer','LX-17 Diamond monthly price in VND.',false),
  ('luxy_three_period_discount_bps','2000'::jsonb,'integer','LX-17 three-period discount in basis points (20%).',false),
  ('luxy_diamond_heart_credit_bps','8000'::jsonb,'integer','LX-17 Diamond membership payment converted to hearts in basis points (80%).',false)
on conflict(key) do update
set value_json=excluded.value_json,
    value_type=excluded.value_type,
    description=excluded.description,
    is_public=excluded.is_public,
    updated_at=now();

create or replace function private.luxy_membership_monthly_price_vnd(p_tier public.luxy_membership_tier)
returns bigint
language plpgsql stable security definer set search_path=''
as $$
begin
  if p_tier='premium' then return coalesce(private.config_integer('luxy_premium_monthly_vnd'),1000000)::bigint; end if;
  if p_tier='diamond' then return coalesce(private.config_integer('luxy_diamond_monthly_vnd'),5000000)::bigint; end if;
  raise exception using errcode='22023',message='paid_membership_tier_required';
end;
$$;

create or replace function private.luxy_membership_discount_bps(p_period_count integer)
returns integer
language plpgsql stable security definer set search_path=''
as $$
begin
  if p_period_count=1 then return 0; end if;
  if p_period_count=3 then return least(greatest(coalesce(private.config_integer('luxy_three_period_discount_bps'),2000),0),9000); end if;
  raise exception using errcode='22023',message='membership_period_count_must_be_1_or_3';
end;
$$;

create or replace function private.luxy_membership_amount_due_vnd(p_tier public.luxy_membership_tier,p_period_count integer)
returns bigint
language sql stable security definer set search_path=''
as $$
  select (private.luxy_membership_monthly_price_vnd(p_tier)*p_period_count::bigint*(10000-private.luxy_membership_discount_bps(p_period_count))::bigint)/10000::bigint
$$;

create or replace function private.luxy_membership_heart_credit_units(p_tier public.luxy_membership_tier,p_amount_due_vnd bigint)
returns bigint
language plpgsql stable security definer set search_path=''
as $$
declare
  v_credit_bps integer;
  v_rate bigint;
  v_credit_vnd bigint;
begin
  if p_tier<>'diamond' then return 0; end if;
  if p_amount_due_vnd is null or p_amount_due_vnd<=0 then raise exception using errcode='22023',message='invalid_membership_amount'; end if;
  v_credit_bps:=least(greatest(coalesce(private.config_integer('luxy_diamond_heart_credit_bps'),8000),0),10000);
  v_rate:=greatest(coalesce(private.config_integer('heart_vnd_rate'),50000),1)::bigint;
  v_credit_vnd:=(p_amount_due_vnd*v_credit_bps::bigint)/10000::bigint;
  if mod(v_credit_vnd,v_rate)<>0 then raise exception using errcode='22023',message='diamond_heart_credit_not_whole_heart'; end if;
  return (v_credit_vnd/v_rate)*100::bigint;
end;
$$;

revoke all on function private.luxy_membership_monthly_price_vnd(public.luxy_membership_tier) from public,anon,authenticated;
revoke all on function private.luxy_membership_discount_bps(integer) from public,anon,authenticated;
revoke all on function private.luxy_membership_amount_due_vnd(public.luxy_membership_tier,integer) from public,anon,authenticated;
revoke all on function private.luxy_membership_heart_credit_units(public.luxy_membership_tier,bigint) from public,anon,authenticated;
grant execute on function private.luxy_membership_monthly_price_vnd(public.luxy_membership_tier) to service_role;
grant execute on function private.luxy_membership_discount_bps(integer) to service_role;
grant execute on function private.luxy_membership_amount_due_vnd(public.luxy_membership_tier,integer) to service_role;
grant execute on function private.luxy_membership_heart_credit_units(public.luxy_membership_tier,bigint) to service_role;

create table private.luxy_membership_privacy (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hide_online boolean not null default false,
  hide_from_listing boolean not null default false,
  updated_at timestamptz not null default now()
);
revoke all on table private.luxy_membership_privacy from public,anon,authenticated;
grant all on table private.luxy_membership_privacy to service_role;

create or replace function private.luxy_visibility_priority(p_user_id uuid)
returns integer language sql stable security definer set search_path=''
as $$
  select case private.get_active_luxy_membership_tier(p_user_id) when 'diamond' then 2 when 'premium' then 1 else 0 end
$$;
create or replace function private.luxy_online_hidden(p_user_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select case when private.get_active_luxy_membership_tier(p_user_id) in ('premium','diamond')
    then coalesce((select s.hide_online from private.luxy_membership_privacy s where s.user_id=p_user_id),false) else false end
$$;
create or replace function private.luxy_listing_hidden(p_user_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select case when private.get_active_luxy_membership_tier(p_user_id)='diamond'
    then coalesce((select s.hide_from_listing from private.luxy_membership_privacy s where s.user_id=p_user_id),false) else false end
$$;
revoke all on function private.luxy_visibility_priority(uuid) from public,anon,authenticated;
revoke all on function private.luxy_online_hidden(uuid) from public,anon,authenticated;
revoke all on function private.luxy_listing_hidden(uuid) from public,anon,authenticated;
grant execute on function private.luxy_visibility_priority(uuid) to service_role;
grant execute on function private.luxy_online_hidden(uuid) to service_role;
grant execute on function private.luxy_listing_hidden(uuid) to service_role;

create table private.luxy_membership_orders (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  request_id uuid not null,
  requested_tier public.luxy_membership_tier not null,
  period_count integer not null,
  monthly_price_vnd bigint not null,
  discount_bps integer not null,
  amount_due_vnd bigint not null,
  diamond_heart_credit_units bigint not null default 0,
  credit_idempotency_key uuid not null default extensions.gen_random_uuid(),
  order_code text not null unique,
  status text not null default 'awaiting_payment',
  source text not null default 'membership',
  bank_transaction_ref text unique,
  paid_amount_vnd bigint,
  verification_id uuid,
  reviewed_by uuid references auth.users(id) on delete restrict,
  linked_heart_purchase_id uuid unique references private.play_purchases(id) on delete restrict,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  activated_at timestamptz,
  membership_expires_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint luxy_membership_orders_request_unique unique(user_id,request_id),
  constraint luxy_membership_orders_credit_unique unique(credit_idempotency_key),
  constraint luxy_membership_orders_paid_tier check(requested_tier in ('premium','diamond')),
  constraint luxy_membership_orders_period_check check(period_count in (1,3)),
  constraint luxy_membership_orders_monthly_positive check(monthly_price_vnd>0),
  constraint luxy_membership_orders_discount_check check(discount_bps between 0 and 9000),
  constraint luxy_membership_orders_amount_positive check(amount_due_vnd>0),
  constraint luxy_membership_orders_heart_nonnegative check(diamond_heart_credit_units>=0),
  constraint luxy_membership_orders_heart_tier_check check(requested_tier='diamond' or diamond_heart_credit_units=0),
  constraint luxy_membership_orders_code_check check(order_code ~ '^LXM[0-9A-F]{12}$'),
  constraint luxy_membership_orders_status_check check(status in ('awaiting_payment','awaiting_confirmation','approved','rejected','cancelled')),
  constraint luxy_membership_orders_source_check check(source ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint luxy_membership_orders_paid_amount check(paid_amount_vnd is null or paid_amount_vnd>0),
  constraint luxy_membership_orders_bank_ref check(bank_transaction_ref is null or char_length(bank_transaction_ref) between 3 and 160),
  constraint luxy_membership_orders_rejection_reason check(rejection_reason is null or rejection_reason ~ '^[a-z][a-z0-9_]{1,63}$')
);
create index luxy_membership_orders_user_created_idx on private.luxy_membership_orders(user_id,created_at desc,id);
create index luxy_membership_orders_queue_idx on private.luxy_membership_orders(status,submitted_at,created_at,id) where status='awaiting_confirmation';
create trigger luxy_membership_orders_set_updated_at before update on private.luxy_membership_orders for each row execute function private.set_updated_at();
revoke all on table private.luxy_membership_orders from public,anon,authenticated;
grant all on table private.luxy_membership_orders to service_role;

alter table private.play_purchases drop constraint play_purchases_provider_check;
alter table private.play_purchases add constraint play_purchases_provider_check check (purchase_provider in ('google_play','vietqr','luxy_membership'));
insert into public.heart_products(google_product_id,heart_units,display_hearts,is_active,sort_order)
values('luxy.membership.diamond.credit',100,1,false,9999)
on conflict(google_product_id) do update set is_active=false,updated_at=now();

create or replace function public.get_luxy_membership_plan_options()
returns table(tier public.luxy_membership_tier,period_count integer,monthly_price_vnd bigint,discount_bps integer,amount_due_vnd bigint,heart_credit_units bigint,heart_credit_display bigint)
language sql stable security definer set search_path=''
as $$
  with options(tier,period_count) as (values
    ('premium'::public.luxy_membership_tier,1),('premium'::public.luxy_membership_tier,3),
    ('diamond'::public.luxy_membership_tier,1),('diamond'::public.luxy_membership_tier,3)
  ), priced as (
    select o.tier,o.period_count,private.luxy_membership_monthly_price_vnd(o.tier) monthly_price_vnd,
      private.luxy_membership_discount_bps(o.period_count) discount_bps,private.luxy_membership_amount_due_vnd(o.tier,o.period_count) amount_due_vnd
    from options o
  )
  select p.tier,p.period_count,p.monthly_price_vnd,p.discount_bps,p.amount_due_vnd,
    private.luxy_membership_heart_credit_units(p.tier,p.amount_due_vnd),private.luxy_membership_heart_credit_units(p.tier,p.amount_due_vnd)/100
  from priced p order by case p.tier when 'premium' then 1 else 2 end,p.period_count
$$;
revoke all on function public.get_luxy_membership_plan_options() from public,anon;
grant execute on function public.get_luxy_membership_plan_options() to authenticated,service_role;

create or replace function public.create_luxy_membership_order(p_tier public.luxy_membership_tier,p_period_count integer,p_request_id uuid,p_source text default 'membership')
returns table(order_id uuid,order_code text,status text,tier public.luxy_membership_tier,period_count integer,monthly_price_vnd bigint,discount_bps integer,amount_due_vnd bigint,heart_credit_units bigint,created_at timestamptz)
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid(); v_source text:=lower(btrim(coalesce(p_source,''))); v_order private.luxy_membership_orders%rowtype;
  v_monthly bigint; v_discount integer; v_amount bigint; v_heart bigint; v_seed text;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if p_tier not in ('premium','diamond') then raise exception using errcode='22023',message='paid_membership_tier_required'; end if;
  if p_period_count not in (1,3) then raise exception using errcode='22023',message='membership_period_count_must_be_1_or_3'; end if;
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  if v_source='' or v_source!~'^[a-z][a-z0-9_]{1,63}$' then raise exception using errcode='22023',message='invalid_membership_source'; end if;
  select * into v_order from private.luxy_membership_orders o where o.user_id=v_user_id and o.request_id=p_request_id;
  if found then
    return query select v_order.id,v_order.order_code,v_order.status,v_order.requested_tier,v_order.period_count,v_order.monthly_price_vnd,
      v_order.discount_bps,v_order.amount_due_vnd,v_order.diamond_heart_credit_units,v_order.created_at; return;
  end if;
  v_monthly:=private.luxy_membership_monthly_price_vnd(p_tier); v_discount:=private.luxy_membership_discount_bps(p_period_count);
  v_amount:=private.luxy_membership_amount_due_vnd(p_tier,p_period_count); v_heart:=private.luxy_membership_heart_credit_units(p_tier,v_amount);
  v_seed:=upper(substr(replace(extensions.gen_random_uuid()::text,'-',''),1,12));
  insert into private.luxy_membership_orders(user_id,request_id,requested_tier,period_count,monthly_price_vnd,discount_bps,amount_due_vnd,diamond_heart_credit_units,order_code,source)
  values(v_user_id,p_request_id,p_tier,p_period_count,v_monthly,v_discount,v_amount,v_heart,'LXM'||v_seed,v_source) returning * into v_order;
  return query select v_order.id,v_order.order_code,v_order.status,v_order.requested_tier,v_order.period_count,v_order.monthly_price_vnd,
    v_order.discount_bps,v_order.amount_due_vnd,v_order.diamond_heart_credit_units,v_order.created_at;
end;
$$;
revoke all on function public.create_luxy_membership_order(public.luxy_membership_tier,integer,uuid,text) from public,anon;
grant execute on function public.create_luxy_membership_order(public.luxy_membership_tier,integer,uuid,text) to authenticated,service_role;

create or replace function public.mark_my_luxy_membership_order_submitted(p_order_id uuid)
returns text language plpgsql volatile security definer set search_path=''
as $$
declare v_user_id uuid:=auth.uid(); v_status text;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  update private.luxy_membership_orders set status='awaiting_confirmation',submitted_at=coalesce(submitted_at,now())
  where id=p_order_id and user_id=v_user_id and status='awaiting_payment' returning status into v_status;
  if found then return v_status; end if;
  select o.status into v_status from private.luxy_membership_orders o where o.id=p_order_id and o.user_id=v_user_id;
  if not found then raise exception using errcode='P0002',message='membership_order_not_found'; end if;
  return v_status;
end;
$$;
create or replace function public.cancel_my_luxy_membership_order(p_order_id uuid)
returns text language plpgsql volatile security definer set search_path=''
as $$
declare v_user_id uuid:=auth.uid(); v_status text;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  update private.luxy_membership_orders set status='cancelled',cancelled_at=now()
  where id=p_order_id and user_id=v_user_id and status in ('awaiting_payment','awaiting_confirmation') returning status into v_status;
  if found then return v_status; end if;
  select o.status into v_status from private.luxy_membership_orders o where o.id=p_order_id and o.user_id=v_user_id;
  if not found then raise exception using errcode='P0002',message='membership_order_not_found'; end if;
  return v_status;
end;
$$;
revoke all on function public.mark_my_luxy_membership_order_submitted(uuid) from public,anon;
revoke all on function public.cancel_my_luxy_membership_order(uuid) from public,anon;
grant execute on function public.mark_my_luxy_membership_order_submitted(uuid) to authenticated,service_role;
grant execute on function public.cancel_my_luxy_membership_order(uuid) to authenticated,service_role;

create or replace function public.get_my_luxy_membership_privacy()
returns table(hide_online boolean,hide_from_listing boolean,can_hide_online boolean,can_hide_from_listing boolean)
language plpgsql stable security definer set search_path=''
as $$
declare v_user_id uuid:=auth.uid(); v_tier public.luxy_membership_tier; v_settings private.luxy_membership_privacy%rowtype;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  v_tier:=private.get_active_luxy_membership_tier(v_user_id); select * into v_settings from private.luxy_membership_privacy s where s.user_id=v_user_id;
  return query select (v_tier in ('premium','diamond') and coalesce(v_settings.hide_online,false)),
    (v_tier='diamond' and coalesce(v_settings.hide_from_listing,false)),(v_tier in ('premium','diamond')),(v_tier='diamond');
end;
$$;
create or replace function public.update_my_luxy_membership_privacy(p_hide_online boolean,p_hide_from_listing boolean)
returns table(hide_online boolean,hide_from_listing boolean)
language plpgsql volatile security definer set search_path=''
as $$
declare v_user_id uuid:=auth.uid(); v_tier public.luxy_membership_tier; v_row private.luxy_membership_privacy%rowtype;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if p_hide_online is null or p_hide_from_listing is null then raise exception using errcode='22023',message='privacy_flags_required'; end if;
  v_tier:=private.get_active_luxy_membership_tier(v_user_id);
  if p_hide_online and v_tier not in ('premium','diamond') then raise exception using errcode='42501',message='premium_membership_required_for_hide_online'; end if;
  if p_hide_from_listing and v_tier<>'diamond' then raise exception using errcode='42501',message='diamond_membership_required_for_hide_listing'; end if;
  insert into private.luxy_membership_privacy(user_id,hide_online,hide_from_listing) values(v_user_id,p_hide_online,p_hide_from_listing)
  on conflict(user_id) do update set hide_online=excluded.hide_online,hide_from_listing=excluded.hide_from_listing,updated_at=now() returning * into v_row;
  return query select v_row.hide_online,v_row.hide_from_listing;
end;
$$;
revoke all on function public.get_my_luxy_membership_privacy() from public,anon;
revoke all on function public.update_my_luxy_membership_privacy(boolean,boolean) from public,anon;
grant execute on function public.get_my_luxy_membership_privacy() to authenticated,service_role;
grant execute on function public.update_my_luxy_membership_privacy(boolean,boolean) to authenticated,service_role;

create or replace function public.admin_list_luxy_membership_orders(p_actor_user_id uuid,p_status text default 'awaiting_confirmation',p_limit integer default 100,p_offset integer default 0)
returns table(order_id uuid,user_id uuid,username text,display_name text,tier public.luxy_membership_tier,period_count integer,amount_due_vnd bigint,
  heart_credit_units bigint,order_code text,status text,submitted_at timestamptz,created_at timestamptz,total_count bigint)
language plpgsql stable security definer set search_path=''
as $$
declare v_status text:=nullif(lower(btrim(coalesce(p_status,''))),'');
begin
  perform private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  if p_limit not between 1 and 200 or p_offset<0 then raise exception using errcode='22023',message='invalid_pagination'; end if;
  if v_status is not null and v_status not in ('awaiting_payment','awaiting_confirmation','approved','rejected','cancelled') then raise exception using errcode='22023',message='invalid_membership_order_status'; end if;
  return query select o.id,o.user_id,p.username::text,p.display_name,o.requested_tier,o.period_count,o.amount_due_vnd,o.diamond_heart_credit_units,
    o.order_code,o.status,o.submitted_at,o.created_at,count(*) over()
  from private.luxy_membership_orders o join public.profiles p on p.id=o.user_id where v_status is null or o.status=v_status
  order by case when o.status='awaiting_confirmation' then 0 else 1 end,coalesce(o.submitted_at,o.created_at),o.id limit p_limit offset p_offset;
end;
$$;

create or replace function public.admin_approve_luxy_membership_order(p_actor_user_id uuid,p_order_id uuid,p_bank_transaction_ref text,p_paid_amount_vnd bigint,p_verification_id uuid)
returns table(order_id uuid,tier public.luxy_membership_tier,membership_expires_at timestamptz,heart_credit_units bigint,heart_balance_after_units bigint,already_processed boolean)
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_role private.user_role; v_order private.luxy_membership_orders%rowtype; v_membership private.luxy_memberships%rowtype;
  v_product public.heart_products%rowtype; v_purchase_id uuid; v_account private.heart_accounts%rowtype;
  v_ref text:=upper(btrim(coalesce(p_bank_transaction_ref,''))); v_token_hash text; v_start timestamptz; v_expiry timestamptz;
  v_balance bigint:=0; v_before jsonb;
begin
  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  if p_order_id is null or p_verification_id is null then raise exception using errcode='22023',message='order_and_verification_required'; end if;
  if char_length(v_ref) not between 3 and 160 then raise exception using errcode='22023',message='invalid_bank_transaction_ref'; end if;
  perform pg_advisory_xact_lock(hashtextextended('luxy-membership:'||p_order_id::text,0));
  select * into v_order from private.luxy_membership_orders o where o.id=p_order_id for update;
  if not found then raise exception using errcode='P0002',message='membership_order_not_found'; end if;
  if v_order.status='approved' then
    if v_order.bank_transaction_ref is distinct from v_ref or v_order.paid_amount_vnd is distinct from p_paid_amount_vnd then
      raise exception using errcode='23505',message='membership_order_already_approved_with_different_payment';
    end if;
    if v_order.requested_tier='diamond' then select coalesce(a.available_units,0) into v_balance from private.heart_accounts a where a.user_id=v_order.user_id; end if;
    return query select v_order.id,v_order.requested_tier,v_order.membership_expires_at,v_order.diamond_heart_credit_units,coalesce(v_balance,0),true; return;
  end if;
  if v_order.status<>'awaiting_confirmation' then raise exception using errcode='42501',message='membership_order_not_awaiting_confirmation'; end if;
  if p_paid_amount_vnd is null or p_paid_amount_vnd<>v_order.amount_due_vnd then raise exception using errcode='22023',message='membership_amount_mismatch'; end if;
  if exists(select 1 from private.luxy_membership_orders o where o.bank_transaction_ref=v_ref and o.id<>v_order.id) then raise exception using errcode='23505',message='bank_transaction_already_used'; end if;
  if exists(select 1 from private.play_purchases pp where pp.provider_transaction_ref=v_ref) then raise exception using errcode='23505',message='bank_transaction_already_used'; end if;

  select * into v_membership from private.luxy_memberships m where m.user_id=v_order.user_id for update;
  v_before:=case when found then jsonb_build_object('tier',v_membership.tier,'status',v_membership.status,'expires_at',v_membership.expires_at) else '{}'::jsonb end;
  if found and v_membership.status='active' and v_membership.tier=v_order.requested_tier and v_membership.expires_at is not null and v_membership.expires_at>now() then
    v_start:=coalesce(v_membership.starts_at,now()); v_expiry:=v_membership.expires_at+make_interval(months=>v_order.period_count);
  else
    v_start:=now(); v_expiry:=now()+make_interval(months=>v_order.period_count);
  end if;
  insert into private.luxy_memberships(user_id,tier,status,messaging_enabled,starts_at,expires_at,source,updated_at)
  values(v_order.user_id,v_order.requested_tier,'active',true,v_start,v_expiry,'membership_order',now())
  on conflict(user_id) do update set tier=excluded.tier,status='active',messaging_enabled=true,starts_at=excluded.starts_at,expires_at=excluded.expires_at,source=excluded.source,updated_at=now();

  if v_order.requested_tier='diamond' and v_order.diamond_heart_credit_units>0 then
    select * into v_product from public.heart_products where google_product_id='luxy.membership.diamond.credit';
    if not found then raise exception using errcode='P0002',message='membership_heart_product_not_found'; end if;
    perform private.ensure_economy_accounts(v_order.user_id);
    select * into v_account from private.heart_accounts a where a.user_id=v_order.user_id for update;
    v_token_hash:=encode(extensions.digest('luxy-membership:'||v_order.id::text||':'||v_ref,'sha256'),'hex');
    insert into private.play_purchases(user_id,product_id,google_product_id,purchase_token_hash,google_order_id,purchase_state,heart_units,currency_code,
      gross_amount_micros,country_code,obfuscated_external_account_id,is_test_purchase,verified_at,acknowledged_at,consumed_at,idempotency_key,
      purchase_provider,provider_order_id,provider_transaction_ref)
    values(v_order.user_id,v_product.id,v_product.google_product_id,v_token_hash,null,'consumed',v_order.diamond_heart_credit_units,'VND',
      v_order.amount_due_vnd*1000000,'VN',null,false,now(),now(),now(),v_order.credit_idempotency_key,'luxy_membership',v_order.order_code,v_ref)
    returning id into v_purchase_id;
    insert into private.heart_lots(purchase_id,user_id,original_units,available_units)
    values(v_purchase_id,v_order.user_id,v_order.diamond_heart_credit_units,v_order.diamond_heart_credit_units);
    update private.heart_accounts set available_units=available_units+v_order.diamond_heart_credit_units,
      lifetime_purchased_units=lifetime_purchased_units+v_order.diamond_heart_credit_units,version=version+1,updated_at=now()
    where user_id=v_order.user_id returning * into v_account;
    insert into private.heart_ledger(user_id,entry_type,amount_units,balance_after_units,reference_type,reference_id,idempotency_key,metadata_json)
    values(v_order.user_id,'purchase_credit',v_order.diamond_heart_credit_units,v_account.available_units,'luxy_membership',v_order.id,v_order.credit_idempotency_key,
      jsonb_build_object('tier','diamond','period_count',v_order.period_count,'amount_vnd',v_order.amount_due_vnd,'credit_bps',8000,'bank_transaction_ref',v_ref,'verification_id',p_verification_id));
    update public.economy_sync set heart_account_version=v_account.version,updated_at=now() where user_id=v_order.user_id;
    v_balance:=v_account.available_units;
  end if;

  update private.luxy_membership_orders set status='approved',bank_transaction_ref=v_ref,paid_amount_vnd=p_paid_amount_vnd,verification_id=p_verification_id,
    reviewed_by=p_actor_user_id,reviewed_at=now(),activated_at=now(),membership_expires_at=v_expiry,linked_heart_purchase_id=v_purchase_id where id=v_order.id;
  perform private.append_admin_audit(p_actor_user_id,v_role,'luxy_membership_approved','luxy_membership_order',v_order.id,v_before,
    jsonb_build_object('tier',v_order.requested_tier,'period_count',v_order.period_count,'amount_vnd',v_order.amount_due_vnd,'membership_expires_at',v_expiry,
      'heart_credit_units',v_order.diamond_heart_credit_units),null,p_verification_id,null,null);
  return query select v_order.id,v_order.requested_tier,v_expiry,v_order.diamond_heart_credit_units,coalesce(v_balance,0),false;
end;
$$;

create or replace function public.admin_reject_luxy_membership_order(p_actor_user_id uuid,p_order_id uuid,p_reason_code text,p_request_id uuid)
returns boolean language plpgsql volatile security definer set search_path=''
as $$
declare v_role private.user_role; v_reason text:=lower(btrim(coalesce(p_reason_code,''))); v_order private.luxy_membership_orders%rowtype;
begin
  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  if v_reason!~'^[a-z][a-z0-9_]{1,63}$' then raise exception using errcode='22023',message='membership_rejection_reason_required'; end if;
  select * into v_order from private.luxy_membership_orders o where o.id=p_order_id for update;
  if not found then raise exception using errcode='P0002',message='membership_order_not_found'; end if;
  if v_order.status='rejected' then return true; end if;
  if v_order.status<>'awaiting_confirmation' then raise exception using errcode='42501',message='membership_order_not_awaiting_confirmation'; end if;
  update private.luxy_membership_orders set status='rejected',reviewed_by=p_actor_user_id,reviewed_at=now(),rejected_at=now(),rejection_reason=v_reason where id=v_order.id;
  perform private.append_admin_audit(p_actor_user_id,v_role,'luxy_membership_rejected','luxy_membership_order',v_order.id,
    jsonb_build_object('status',v_order.status),jsonb_build_object('status','rejected','reason_code',v_reason),v_reason,p_request_id,null,null);
  return true;
end;
$$;
revoke all on function public.admin_list_luxy_membership_orders(uuid,text,integer,integer) from public,anon,authenticated;
revoke all on function public.admin_approve_luxy_membership_order(uuid,uuid,text,bigint,uuid) from public,anon,authenticated;
revoke all on function public.admin_reject_luxy_membership_order(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_list_luxy_membership_orders(uuid,text,integer,integer) to service_role;
grant execute on function public.admin_approve_luxy_membership_order(uuid,uuid,text,bigint,uuid) to service_role;
grant execute on function public.admin_reject_luxy_membership_order(uuid,uuid,text,uuid) to service_role;

drop function public.get_my_luxy_membership_snapshot();
create function public.get_my_luxy_membership_snapshot()
returns table(tier public.luxy_membership_tier,can_message boolean,can_favorite boolean,can_request_private_photo boolean,can_full_search boolean,
  can_unlimited_likes boolean,can_hide_online boolean,can_hide_from_listing boolean,can_use_hearts boolean,visibility_priority integer,
  heart_balance_units bigint,status text,expires_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
declare v_user_id uuid:=auth.uid(); v_tier public.luxy_membership_tier; v_paid boolean; v_balance bigint:=0;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  v_tier:=private.get_active_luxy_membership_tier(v_user_id); v_paid:=v_tier in ('premium','diamond');
  if v_tier='diamond' then select coalesce(a.available_units,0) into v_balance from private.heart_accounts a where a.user_id=v_user_id; end if;
  return query select v_tier,private.can_message_with_luxy_membership(v_user_id),v_paid,v_paid,v_paid,v_paid,v_paid,(v_tier='diamond'),(v_tier='diamond'),
    private.luxy_visibility_priority(v_user_id),coalesce(v_balance,0),case when v_tier='free' then 'free' else 'active' end,
    case when v_tier='free' then null else m.expires_at end
  from (select 1) seed left join private.luxy_memberships m on m.user_id=v_user_id and m.status='active' and m.tier=v_tier and m.expires_at>now();
end;
$$;
revoke all on function public.get_my_luxy_membership_snapshot() from public,anon;
grant execute on function public.get_my_luxy_membership_snapshot() to authenticated,service_role;

create or replace function public.get_luxy_member_profile(p_username text)
returns table(
  id uuid,username text,display_name text,headline text,bio text,gender public.gender_identity,interested_in public.dating_interest,age smallint,
  province_id bigint,province_name text,avatar_media_id uuid,avatar_storage_bucket text,avatar_storage_path text,interests text[],height_cm smallint,
  weight_kg smallint,relationship_status public.relationship_status,children_status public.children_status,smoking_status public.smoking_status,
  drinking_status public.drinking_status,education_level public.education_level,occupation text,looking_for text,lifestyle_tags public.profile_lifestyle_tag[],
  languages text[],last_active_at timestamptz,member_since timestamptz,public_photo_count integer,private_photo_count integer,
  membership_tier public.luxy_membership_tier,membership_badge_visible boolean,blocked_by_viewer boolean
)
language plpgsql stable security definer set search_path=''
as $$
declare v_viewer_id uuid:=auth.uid(); v_username text:=lower(btrim(coalesce(p_username,''))); v_target_id uuid; v_blocked_by_viewer boolean:=false;
begin
  if v_viewer_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_viewer_id) then raise exception using errcode='42501',message='adult_onboarding_required'; end if;
  if v_username='' or char_length(v_username)>48 then raise exception using errcode='22023',message='profile_username_required'; end if;
  select p.id into v_target_id from public.profiles p where lower(p.username::text)=v_username and p.profile_status='active' and p.deleted_at is null and private.is_active_adult(p.id) limit 1;
  if v_target_id is null then return; end if;
  if exists(select 1 from public.user_blocks b where b.blocker_id=v_target_id and b.blocked_id=v_viewer_id) then return; end if;
  select exists(select 1 from public.user_blocks b where b.blocker_id=v_viewer_id and b.blocked_id=v_target_id) into v_blocked_by_viewer;
  return query select p.id,p.username::text,p.display_name,p.headline,p.bio,p.gender,p.interested_in,
    extract(year from age(current_date,ui.date_of_birth))::smallint,p.province_id,area.name_vi,
    case when v_blocked_by_viewer then null else p.avatar_media_id end,case when v_blocked_by_viewer then null else avatar.storage_bucket end,
    case when v_blocked_by_viewer then null else avatar.storage_path end,coalesce(p.interests,'{}'::text[]),p.height_cm,p.weight_kg,p.relationship_status,
    p.children_status,p.smoking_status,p.drinking_status,p.education_level,p.occupation,p.looking_for,coalesce(p.lifestyle_tags,'{}'::public.profile_lifestyle_tag[]),
    coalesce(p.languages,'{}'::text[]),case when private.luxy_online_hidden(p.id) then null else p.last_active_at end,p.created_at,
    case when v_blocked_by_viewer then 0 else coalesce(pub.photo_count,0) end::integer,case when v_blocked_by_viewer then 0 else coalesce(priv.photo_count,0) end::integer,
    private.get_active_luxy_membership_tier(p.id),(private.get_active_luxy_membership_tier(p.id) in ('premium','diamond')),v_blocked_by_viewer
  from public.profiles p join private.user_identity ui on ui.user_id=p.id
  left join public.administrative_areas area on area.id=p.province_id and area.country_code='VN' and area.is_active
  left join public.media_assets avatar on avatar.id=p.avatar_media_id and avatar.owner_id=p.id and avatar.visibility='avatar'
    and avatar.moderation_status in ('pending_review','approved') and avatar.deleted_at is null and avatar.uploaded_at is not null and private.can_view_media_internal(avatar.id,v_viewer_id)
  left join lateral (select count(*)::integer photo_count from public.media_assets m where m.owner_id=p.id and m.visibility='public'
    and m.moderation_status in ('pending_review','approved') and m.deleted_at is null and m.uploaded_at is not null and private.can_view_media_internal(m.id,v_viewer_id)) pub on true
  left join lateral (select count(*)::integer photo_count from public.media_assets m where m.owner_id=p.id and m.visibility='private'
    and m.moderation_status in ('pending_review','approved') and m.deleted_at is null and m.uploaded_at is not null) priv on true
  where p.id=v_target_id;
end;
$$;

create or replace function public.search_luxy_profiles_v2(
  p_sort text default 'distance',p_province_id bigint default null,p_max_distance_km numeric default null,p_min_age smallint default 18,p_max_age smallint default 99,
  p_genders public.gender_identity[] default null,p_min_height_cm smallint default null,p_max_height_cm smallint default null,p_min_weight_kg smallint default null,p_max_weight_kg smallint default null,
  p_relationship_statuses public.relationship_status[] default null,p_children_statuses public.children_status[] default null,p_smoking_statuses public.smoking_status[] default null,
  p_drinking_statuses public.drinking_status[] default null,p_education_levels public.education_level[] default null,p_lifestyle_tags public.profile_lifestyle_tag[] default null,
  p_languages text[] default null,p_interests text[] default null,p_has_photo boolean default null,p_online_now boolean default null,p_occupation_text text default null,p_profile_text text default null,
  p_view_state text default null,p_favorite_scope text default null,p_limit integer default 24,p_offset integer default 0
)
returns table(
  id uuid,username text,display_name text,headline text,bio text,gender public.gender_identity,age smallint,province_id bigint,province_name text,
  avatar_media_id uuid,avatar_storage_bucket text,avatar_storage_path text,photo_count integer,interests text[],height_cm smallint,weight_kg smallint,
  relationship_status public.relationship_status,children_status public.children_status,smoking_status public.smoking_status,drinking_status public.drinking_status,
  education_level public.education_level,occupation text,looking_for text,lifestyle_tags public.profile_lifestyle_tag[],languages text[],last_active_at timestamptz,
  is_online boolean,distance_km numeric,member_since timestamptz,is_favorited boolean,is_favorited_by boolean,is_viewed boolean
)
language plpgsql stable security definer set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid(); v_sort text:=lower(btrim(coalesce(p_sort,''))); v_view_state text:=nullif(lower(btrim(coalesce(p_view_state,''))),'');
  v_favorite_scope text:=nullif(lower(btrim(coalesce(p_favorite_scope,''))),''); v_online_minutes integer; v_limit integer:=least(greatest(coalesce(p_limit,24),1),40);
  v_offset integer:=least(greatest(coalesce(p_offset,0),0),199); v_profile_text text:=nullif(lower(btrim(coalesce(p_profile_text,''))),'');
  v_occupation_text text:=nullif(lower(btrim(coalesce(p_occupation_text,''))),'');
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='adult_onboarding_required'; end if;
  if v_sort not in ('distance','recent','newest') then raise exception using errcode='22023',message='invalid_search_sort'; end if;
  if v_view_state is not null and v_view_state not in ('viewed','unviewed') then raise exception using errcode='22023',message='invalid_search_view_state'; end if;
  if v_favorite_scope is not null and v_favorite_scope not in ('favorites','favorited_me') then raise exception using errcode='22023',message='invalid_search_favorite_scope'; end if;
  if p_min_age is null or p_max_age is null or p_min_age<18 or p_max_age>99 or p_min_age>p_max_age then raise exception using errcode='22023',message='invalid_search_age_range'; end if;
  if p_min_height_cm is not null and (p_min_height_cm<120 or p_min_height_cm>230) then raise exception using errcode='22023',message='invalid_search_height_range'; end if;
  if p_max_height_cm is not null and (p_max_height_cm<120 or p_max_height_cm>230) then raise exception using errcode='22023',message='invalid_search_height_range'; end if;
  if p_min_height_cm is not null and p_max_height_cm is not null and p_min_height_cm>p_max_height_cm then raise exception using errcode='22023',message='invalid_search_height_range'; end if;
  if p_min_weight_kg is not null and (p_min_weight_kg<35 or p_min_weight_kg>250) then raise exception using errcode='22023',message='invalid_search_weight_range'; end if;
  if p_max_weight_kg is not null and (p_max_weight_kg<35 or p_max_weight_kg>250) then raise exception using errcode='22023',message='invalid_search_weight_range'; end if;
  if p_min_weight_kg is not null and p_max_weight_kg is not null and p_min_weight_kg>p_max_weight_kg then raise exception using errcode='22023',message='invalid_search_weight_range'; end if;
  if p_max_distance_km is not null and (p_max_distance_km<=0 or p_max_distance_km>3000) then raise exception using errcode='22023',message='invalid_search_distance'; end if;
  if cardinality(coalesce(p_lifestyle_tags,'{}'::public.profile_lifestyle_tag[]))>12 then raise exception using errcode='22023',message='too_many_search_lifestyle_tags'; end if;
  if cardinality(coalesce(p_languages,'{}'::text[]))>8 then raise exception using errcode='22023',message='too_many_search_languages'; end if;
  if cardinality(coalesce(p_interests,'{}'::text[]))>12 then raise exception using errcode='22023',message='too_many_search_interests'; end if;
  if v_profile_text is not null and char_length(v_profile_text)>120 then raise exception using errcode='22023',message='invalid_search_profile_text'; end if;
  if v_occupation_text is not null and char_length(v_occupation_text)>120 then raise exception using errcode='22023',message='invalid_search_occupation_text'; end if;
  if p_province_id is not null and not exists(select 1 from public.administrative_areas a where a.id=p_province_id and a.country_code='VN' and a.is_active) then raise exception using errcode='22023',message='invalid_search_province'; end if;
  select coalesce((value_json#>>'{}')::integer,15) into v_online_minutes from private.app_config where key='luxy_search_online_minutes'; v_online_minutes:=least(greatest(coalesce(v_online_minutes,15),1),120);
  return query
  with caller as (
    select p.id,p.gender,p.interested_in,case when p.nearby_enabled and ul.is_enabled and ul.expires_at>now()
      and ul.captured_at>now()-make_interval(mins=>coalesce((select (value_json#>>'{}')::integer from private.app_config where key='nearby_location_fresh_minutes'),30))
      and ul.accuracy_meters<=coalesce((select (value_json#>>'{}')::integer from private.app_config where key='location_max_accuracy_meters'),5000)
      then ul.location else null end location
    from public.profiles p left join private.user_locations ul on ul.user_id=p.id where p.id=v_user_id
  ), base as (
    select p.id,p.username::text username,p.display_name,p.headline,p.bio,p.gender,extract(year from age(current_date,ui.date_of_birth))::smallint age,
      p.province_id,area.name_vi province_name,p.avatar_media_id,avatar.storage_bucket avatar_storage_bucket,avatar.storage_path avatar_storage_path,
      coalesce(photos.photo_count,0)::integer photo_count,p.interests,p.height_cm,p.weight_kg,p.relationship_status,p.children_status,p.smoking_status,p.drinking_status,
      p.education_level,p.occupation,p.looking_for,p.lifestyle_tags,p.languages,case when private.luxy_online_hidden(p.id) then null else p.last_active_at end last_active_at,
      (not private.luxy_online_hidden(p.id) and p.last_active_at is not null and p.last_active_at>=now()-make_interval(mins=>v_online_minutes)) is_online,
      case when caller.location is not null and p.nearby_enabled and candidate_location.location is not null then extensions.st_distance(candidate_location.location,caller.location) else null end distance_meters,
      p.created_at member_since,exists(select 1 from public.profile_favorites f where f.owner_id=caller.id and f.favorite_id=p.id) is_favorited,
      exists(select 1 from public.profile_favorites f where f.owner_id=p.id and f.favorite_id=caller.id) is_favorited_by,
      exists(select 1 from public.profile_views v where v.viewer_id=caller.id and v.viewed_id=p.id) is_viewed,private.luxy_visibility_priority(p.id) visibility_priority
    from caller join public.profiles p on p.id<>caller.id join private.user_identity ui on ui.user_id=p.id
    left join public.administrative_areas area on area.id=p.province_id and area.country_code='VN' and area.is_active
    left join private.user_locations candidate_location on candidate_location.user_id=p.id and candidate_location.is_enabled and candidate_location.expires_at>now()
      and candidate_location.captured_at>now()-make_interval(mins=>coalesce((select (value_json#>>'{}')::integer from private.app_config where key='nearby_location_fresh_minutes'),30))
      and candidate_location.accuracy_meters<=coalesce((select (value_json#>>'{}')::integer from private.app_config where key='location_max_accuracy_meters'),5000)
    left join public.media_assets avatar on avatar.id=p.avatar_media_id and avatar.owner_id=p.id and avatar.visibility='avatar' and avatar.moderation_status in ('pending_review','approved')
      and avatar.deleted_at is null and avatar.uploaded_at is not null and private.can_view_media_internal(avatar.id,caller.id)
    left join lateral (select count(*)::integer photo_count from public.media_assets m where m.owner_id=p.id and m.deleted_at is null and m.uploaded_at is not null
      and m.moderation_status in ('pending_review','approved') and m.visibility in ('avatar','public') and private.can_view_media_internal(m.id,caller.id)) photos on true
    where p.profile_status='active' and p.deleted_at is null and p.discovery_enabled and not private.luxy_listing_hidden(p.id)
      and private.is_active_adult(p.id) and not private.users_are_blocked(caller.id,p.id) and ui.date_of_birth is not null
      and (p_province_id is null or p.province_id=p_province_id) and extract(year from age(current_date,ui.date_of_birth)) between p_min_age and p_max_age
      and ((p_genders is not null and cardinality(p_genders)>0 and p.gender=any(p_genders)) or ((p_genders is null or cardinality(p_genders)=0)
        and (caller.interested_in='everyone' or (caller.interested_in='female' and p.gender='female') or (caller.interested_in='male' and p.gender='male'))))
      and (caller.gender not in ('male','female') or p.interested_in='everyone' or (caller.gender='female' and p.interested_in='female') or (caller.gender='male' and p.interested_in='male'))
      and (p_min_height_cm is null or p.height_cm>=p_min_height_cm) and (p_max_height_cm is null or p.height_cm<=p_max_height_cm)
      and (p_min_weight_kg is null or p.weight_kg>=p_min_weight_kg) and (p_max_weight_kg is null or p.weight_kg<=p_max_weight_kg)
      and (p_relationship_statuses is null or cardinality(p_relationship_statuses)=0 or p.relationship_status=any(p_relationship_statuses))
      and (p_children_statuses is null or cardinality(p_children_statuses)=0 or p.children_status=any(p_children_statuses))
      and (p_smoking_statuses is null or cardinality(p_smoking_statuses)=0 or p.smoking_status=any(p_smoking_statuses))
      and (p_drinking_statuses is null or cardinality(p_drinking_statuses)=0 or p.drinking_status=any(p_drinking_statuses))
      and (p_education_levels is null or cardinality(p_education_levels)=0 or p.education_level=any(p_education_levels))
      and (p_lifestyle_tags is null or cardinality(p_lifestyle_tags)=0 or p.lifestyle_tags @> p_lifestyle_tags)
      and (p_languages is null or cardinality(p_languages)=0 or not exists(select 1 from unnest(p_languages) wanted where not exists(select 1 from unnest(p.languages) actual where lower(btrim(actual))=lower(btrim(wanted)))))
      and (p_interests is null or cardinality(p_interests)=0 or not exists(select 1 from unnest(p_interests) wanted where not exists(select 1 from unnest(p.interests) actual where lower(btrim(actual))=lower(btrim(wanted)))))
      and (v_occupation_text is null or lower(coalesce(p.occupation,'')) like '%'||v_occupation_text||'%')
      and (v_profile_text is null or lower(coalesce(p.username::text,'')) like '%'||v_profile_text||'%' or lower(coalesce(p.display_name,'')) like '%'||v_profile_text||'%'
        or lower(coalesce(p.headline,'')) like '%'||v_profile_text||'%' or lower(coalesce(p.bio,'')) like '%'||v_profile_text||'%' or lower(coalesce(p.looking_for,'')) like '%'||v_profile_text||'%'
        or lower(coalesce(p.occupation,'')) like '%'||v_profile_text||'%')
  ), filtered as (
    select * from base b where (p_max_distance_km is null or (b.distance_meters is not null and b.distance_meters<=p_max_distance_km*1000.0))
      and (p_has_photo is null or (p_has_photo and b.photo_count>0) or (not p_has_photo and b.photo_count=0)) and (p_online_now is null or b.is_online=p_online_now)
      and (v_view_state is null or (v_view_state='viewed' and b.is_viewed) or (v_view_state='unviewed' and not b.is_viewed))
      and (v_favorite_scope is null or (v_favorite_scope='favorites' and b.is_favorited) or (v_favorite_scope='favorited_me' and b.is_favorited_by))
  )
  select f.id,f.username,f.display_name,f.headline,f.bio,f.gender,f.age,f.province_id,f.province_name,f.avatar_media_id,f.avatar_storage_bucket,f.avatar_storage_path,
    f.photo_count,f.interests,f.height_cm,f.weight_kg,f.relationship_status,f.children_status,f.smoking_status,f.drinking_status,f.education_level,f.occupation,f.looking_for,
    f.lifestyle_tags,f.languages,f.last_active_at,f.is_online,case when f.distance_meters is null then null else round((f.distance_meters/1000.0)::numeric,1) end,
    f.member_since,f.is_favorited,f.is_favorited_by,f.is_viewed
  from filtered f order by f.visibility_priority desc,case when v_sort='distance' then (f.distance_meters is null)::integer end asc,
    case when v_sort='distance' then f.distance_meters end asc nulls last,case when v_sort='recent' then f.last_active_at end desc nulls last,
    case when v_sort='newest' then f.member_since end desc nulls last,f.last_active_at desc nulls last,f.id
  offset v_offset limit least(v_limit,greatest(200-v_offset,0));
end;
$$;

drop function if exists public.list_luxy_interests(text,integer,integer);
create function public.list_luxy_interests(p_scope text default 'favorites',p_limit integer default 24,p_offset integer default 0)
returns table(id uuid,username text,display_name text,age smallint,province_name text,headline text,height_cm smallint,weight_kg smallint,avatar_media_id uuid,
  avatar_storage_bucket text,avatar_storage_path text,photo_count integer,last_active_at timestamptz,is_online boolean,membership_tier public.luxy_membership_tier,
  is_favorited boolean,is_favorited_by boolean,is_match boolean,interaction_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
declare v_user_id uuid:=auth.uid(); v_scope text:=lower(btrim(coalesce(p_scope,''))); v_limit integer:=least(greatest(coalesce(p_limit,24),1),40);
  v_offset integer:=least(greatest(coalesce(p_offset,0),0),199); v_online_minutes integer;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='adult_onboarding_required'; end if;
  if v_scope not in ('favorites','viewed_me','favorited_me') then raise exception using errcode='22023',message='invalid_interest_scope'; end if;
  select coalesce((value_json#>>'{}')::integer,15) into v_online_minutes from private.app_config where key='luxy_search_online_minutes'; v_online_minutes:=least(greatest(coalesce(v_online_minutes,15),1),120);
  return query with relations as (
    select f.favorite_id target_id,f.created_at relation_at from public.profile_favorites f where v_scope='favorites' and f.owner_id=v_user_id
    union all select f.owner_id target_id,f.created_at relation_at from public.profile_favorites f where v_scope='favorited_me' and f.favorite_id=v_user_id
    union all select v.viewer_id target_id,v.last_viewed_at relation_at from public.profile_views v where v_scope='viewed_me' and v.viewed_id=v_user_id and v.last_viewed_at>=now()-interval '180 days'
  )
  select p.id,p.username::text,p.display_name,extract(year from age(current_date,ui.date_of_birth))::smallint,area.name_vi,p.headline,p.height_cm,p.weight_kg,
    p.avatar_media_id,avatar.storage_bucket,avatar.storage_path,coalesce(photos.photo_count,0)::integer,case when private.luxy_online_hidden(p.id) then null else p.last_active_at end,
    (not private.luxy_online_hidden(p.id) and p.last_active_at is not null and p.last_active_at>=now()-make_interval(mins=>v_online_minutes)),private.get_active_luxy_membership_tier(p.id),
    exists(select 1 from public.profile_favorites f where f.owner_id=v_user_id and f.favorite_id=p.id),exists(select 1 from public.profile_favorites f where f.owner_id=p.id and f.favorite_id=v_user_id),
    exists(select 1 from public.profile_favorites mine join public.profile_favorites theirs on theirs.owner_id=p.id and theirs.favorite_id=v_user_id where mine.owner_id=v_user_id and mine.favorite_id=p.id),r.relation_at
  from relations r join public.profiles p on p.id=r.target_id join private.user_identity ui on ui.user_id=p.id
  left join public.administrative_areas area on area.id=p.province_id and area.country_code='VN' and area.is_active
  left join public.media_assets avatar on avatar.id=p.avatar_media_id and avatar.owner_id=p.id and avatar.visibility='avatar' and avatar.moderation_status in ('pending_review','approved')
    and avatar.deleted_at is null and avatar.uploaded_at is not null and private.can_view_media_internal(avatar.id,v_user_id)
  left join lateral (select count(*)::integer photo_count from public.media_assets m where m.owner_id=p.id and m.deleted_at is null and m.uploaded_at is not null
    and m.moderation_status in ('pending_review','approved') and m.visibility in ('avatar','public') and private.can_view_media_internal(m.id,v_user_id)) photos on true
  where p.profile_status='active' and p.deleted_at is null and p.discovery_enabled and private.is_active_adult(p.id) and not private.users_are_blocked(v_user_id,p.id)
  order by r.relation_at desc,p.id offset v_offset limit least(v_limit,greatest(200-v_offset,0));
end;
$$;
revoke all on function public.list_luxy_interests(text,integer,integer) from public,anon;
grant execute on function public.list_luxy_interests(text,integer,integer) to authenticated,service_role;

drop function if exists public.list_my_conversations(integer,integer);
create function public.list_my_conversations(p_limit integer default 30,p_offset integer default 0)
returns table(conversation_id uuid,friendship_id uuid,other_user_id uuid,username text,display_name text,age smallint,headline text,province_name text,
  avatar_media_id uuid,avatar_storage_bucket text,avatar_storage_path text,is_creator boolean,is_online boolean,membership_tier public.luxy_membership_tier,
  friendship_status text,can_send boolean,blocked boolean,is_archived boolean,last_message_id uuid,last_message_type text,last_message_body text,last_message_sender_id uuid,
  last_message_sent_at timestamptz,unread_count bigint)
language plpgsql stable security definer set search_path=''
as $$
declare v_user_id uuid:=auth.uid(); v_limit integer:=least(greatest(coalesce(p_limit,30),1),50); v_offset integer:=least(greatest(coalesce(p_offset,0),0),500); v_online_minutes integer:=15;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  select coalesce((cfg.value_json#>>'{}')::integer,15) into v_online_minutes from private.app_config cfg where cfg.key='luxy_search_online_minutes'; v_online_minutes:=least(greatest(coalesce(v_online_minutes,15),1),120);
  return query with selected as (
    select c.id,c.friendship_id,c.last_message_at,c.created_at,f.status,private.get_direct_conversation_other_user(c.id,v_user_id) other_id,cm.last_read_at,cm.archived_at
    from public.conversation_members cm join public.conversations c on c.id=cm.conversation_id left join public.friendships f on f.id=c.friendship_id where cm.user_id=v_user_id
    order by c.last_message_at desc nulls last,c.created_at desc,c.id limit v_limit offset v_offset
  )
  select s.id,s.friendship_id,p.id,p.username::text,case when bs.blocked_by_other then 'Tài khoản không khả dụng' else p.display_name end,
    extract(year from age(current_date,ui.date_of_birth))::smallint,case when bs.blocked then null else p.headline end,case when bs.blocked then null else area.name_vi end,
    case when bs.blocked then null else p.avatar_media_id end,case when bs.blocked then null else avatar.storage_bucket end,case when bs.blocked then null else avatar.storage_path end,
    (not bs.blocked and p.is_creator and exists(select 1 from public.creator_profiles cp where cp.user_id=p.id and cp.creator_status='approved'::public.creator_status)),
    (not bs.blocked and not private.luxy_online_hidden(p.id) and p.last_active_at is not null and p.last_active_at>=now()-make_interval(mins=>v_online_minutes)),
    private.get_active_luxy_membership_tier(p.id),coalesce(s.status::text,'direct'),(not bs.blocked and private.is_active_adult(p.id) and private.can_message_with_luxy_membership(v_user_id)),
    bs.blocked,(s.archived_at is not null),lm.id,lm.message_type::text,case when lm.id is null then null when lm.deleted_at is not null or lm.moderation_status='removed'::public.message_moderation_status then null
      when lm.message_type='text'::public.message_type then left(lm.body,160) else null end,lm.sender_id,lm.sent_at,coalesce(unread.unread_count,0)::bigint
  from selected s join public.profiles p on p.id=s.other_id join private.user_identity ui on ui.user_id=p.id left join public.administrative_areas area on area.id=p.province_id
  cross join lateral (select exists(select 1 from public.user_blocks b where (b.blocker_id=v_user_id and b.blocked_id=s.other_id) or (b.blocker_id=s.other_id and b.blocked_id=v_user_id)) blocked,
    exists(select 1 from public.user_blocks b where b.blocker_id=s.other_id and b.blocked_id=v_user_id) blocked_by_other) bs
  left join public.media_assets avatar on avatar.id=p.avatar_media_id and not bs.blocked and private.can_view_media_internal(avatar.id,v_user_id)
  left join lateral (select m.* from public.messages m where m.conversation_id=s.id and not private.is_message_hidden_for_user(m.id,v_user_id) order by m.sent_at desc,m.id desc limit 1) lm on true
  left join lateral (select count(*)::bigint unread_count from public.messages m where m.conversation_id=s.id and m.sender_id<>v_user_id and m.deleted_at is null
    and m.moderation_status<>'removed'::public.message_moderation_status and not private.is_message_hidden_for_user(m.id,v_user_id) and (s.last_read_at is null or m.sent_at>s.last_read_at)) unread on true
  where s.other_id is not null and p.deleted_at is null order by s.last_message_at desc nulls last,s.created_at desc,s.id;
end;
$$;
revoke all on function public.list_my_conversations(integer,integer) from public,anon;
grant execute on function public.list_my_conversations(integer,integer) to authenticated,service_role;

comment on table private.luxy_membership_orders is 'LX-17 manual-confirmation membership orders. Payment alone grants nothing; finance_admin/super_admin approval activates time-bounded entitlements.';
comment on function public.admin_approve_luxy_membership_order(uuid,uuid,text,bigint,uuid) is 'LX-17 service-role-only exact-payment confirmation. Activates Premium/Diamond and credits Diamond hearts once through immutable accounting.';
comment on function public.get_my_luxy_membership_snapshot() is 'LX-17 authoritative effective entitlement snapshot. Expired rows immediately evaluate as Free without waiting for a cron mutation.';
