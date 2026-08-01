begin;

create type private.vietqr_reconciliation_state as enum (
  'unmatched',
  'matched',
  'needs_review',
  'settled',
  'ignored',
  'rejected'
);

create table private.vietqr_bank_transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  provider text not null check (provider ~ '^[a-z][a-z0-9_]{1,31}$'),
  provider_transaction_ref text not null check (char_length(provider_transaction_ref) between 3 and 160),
  amount_vnd bigint not null check (amount_vnd > 0),
  currency_code text not null default 'VND' check (currency_code = 'VND'),
  transfer_content_raw text not null check (char_length(transfer_content_raw) between 1 and 500),
  transfer_content_normalized text not null check (char_length(transfer_content_normalized) between 1 and 500),
  matched_token text,
  payload_sha256 text check (payload_sha256 is null or payload_sha256 ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz not null,
  status private.vietqr_reconciliation_state not null,
  matched_order_id uuid references private.vietqr_payment_orders(id) on delete restrict,
  matched_at timestamptz,
  settled_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete restrict,
  review_reason_code text check (review_reason_code is null or review_reason_code ~ '^[a-z][a-z0-9_]{1,63}$'),
  import_request_id uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_transaction_ref)
);

create index vietqr_bank_transactions_status_occurred_idx
  on private.vietqr_bank_transactions(status, occurred_at desc);
create index vietqr_bank_transactions_matched_order_idx
  on private.vietqr_bank_transactions(matched_order_id)
  where matched_order_id is not null;

create table private.vietqr_reconciliation_events (
  id uuid primary key default extensions.gen_random_uuid(),
  transaction_id uuid not null references private.vietqr_bank_transactions(id) on delete restrict,
  event_type text not null check (event_type in ('imported','duplicate_import','manual_match','settled','ignored','rejected')),
  actor_user_id uuid references auth.users(id) on delete restrict,
  request_id uuid not null unique,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index vietqr_reconciliation_events_transaction_created_idx
  on private.vietqr_reconciliation_events(transaction_id, created_at desc);

alter table private.vietqr_bank_transactions enable row level security;
alter table private.vietqr_reconciliation_events enable row level security;

create policy vietqr_bank_transactions_deny_client_direct_access
  on private.vietqr_bank_transactions for all to public
  using (false) with check (false);
create policy vietqr_reconciliation_events_deny_client_direct_access
  on private.vietqr_reconciliation_events for all to public
  using (false) with check (false);

create or replace function private.prevent_vietqr_reconciliation_event_mutation()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  raise exception using errcode='42501',message='vietqr_reconciliation_events_are_immutable';
end
$function$;

create trigger vietqr_reconciliation_events_immutable
before update or delete on private.vietqr_reconciliation_events
for each row execute function private.prevent_vietqr_reconciliation_event_mutation();

create or replace function private.config_boolean(p_key text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select case
    when c.value_type='boolean'::private.config_value_type then (c.value_json#>>'{}')::boolean
    else null
  end
  from private.app_config c
  where c.key=p_key
$function$;

create or replace function private.normalize_vietqr_transfer_content(p_content text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select regexp_replace(upper(coalesce(p_content,'')), '[^A-Z0-9]', '', 'g')
$function$;

insert into private.app_config(key,value_json,value_type,description,is_public)
values
  ('vietqr_reconciliation_enabled','false'::jsonb,'boolean','Allow finance administrators to import bank transactions into the VietQR reconciliation inbox.',false),
  ('vietqr_manual_settlement_enabled','false'::jsonb,'boolean','Allow an explicit finance-admin decision to credit hearts from an exact VietQR match.',false),
  ('vietqr_auto_settlement_enabled','false'::jsonb,'boolean','Reserved for future verified bank webhook settlement. BR-07 keeps this disabled.',false)
on conflict (key) do update
set value_json=excluded.value_json,
    value_type=excluded.value_type,
    description=excluded.description,
    is_public=false,
    updated_at=now();

update private.app_config
set value_json='false'::jsonb,
    updated_at=now()
where key='vietqr_web_payments_enabled';

create or replace function public.admin_import_vietqr_bank_transaction(
  p_actor_user_id uuid,
  p_provider text,
  p_provider_transaction_ref text,
  p_amount_vnd bigint,
  p_transfer_content text,
  p_occurred_at timestamptz,
  p_payload_sha256 text,
  p_request_id uuid
)
returns table(
  transaction_id uuid,
  status text,
  matched_order_id uuid,
  order_code text,
  amount_vnd bigint,
  expected_amount_vnd bigint,
  already_imported boolean
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role private.user_role;
  v_provider text:=lower(btrim(p_provider));
  v_ref text:=upper(btrim(p_provider_transaction_ref));
  v_content text:=btrim(p_transfer_content);
  v_normalized text;
  v_token text;
  v_transaction private.vietqr_bank_transactions%rowtype;
  v_order private.vietqr_payment_orders%rowtype;
  v_status private.vietqr_reconciliation_state;
  v_existing_audit private.admin_audit_logs%rowtype;
begin
  if coalesce(private.config_boolean('vietqr_reconciliation_enabled'),false) is not true then
    raise exception using errcode='55000',message='vietqr_reconciliation_disabled';
  end if;
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  if v_provider is null or v_provider !~ '^[a-z][a-z0-9_]{1,31}$' then
    raise exception using errcode='22023',message='invalid_vietqr_provider';
  end if;
  if v_ref is null or char_length(v_ref) not between 3 and 160 then
    raise exception using errcode='22023',message='invalid_bank_transaction_ref';
  end if;
  if p_amount_vnd is null or p_amount_vnd<=0 then raise exception using errcode='22023',message='invalid_paid_amount'; end if;
  if v_content is null or char_length(v_content) not between 1 and 500 then
    raise exception using errcode='22023',message='invalid_transfer_content';
  end if;
  if p_occurred_at is null or p_occurred_at>now()+interval '5 minutes' then
    raise exception using errcode='22023',message='invalid_bank_transaction_time';
  end if;
  if p_payload_sha256 is not null and lower(p_payload_sha256) !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='22023',message='invalid_payload_sha256';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('vietqr-reconciliation:'||v_provider||':'||v_ref,0));

  select a.* into v_existing_audit
  from private.admin_audit_logs a
  where a.request_id=p_request_id;
  if found then
    if v_existing_audit.action<>'vietqr_bank_transaction_imported'
       and v_existing_audit.action<>'vietqr_bank_transaction_duplicate_import' then
      raise exception using errcode='23505',message='request_id_conflict';
    end if;
    select t.* into v_transaction
    from private.vietqr_bank_transactions t
    where t.id=v_existing_audit.target_id;
    if not found then raise exception using errcode='P0002',message='vietqr_transaction_not_found'; end if;
    select o.* into v_order from private.vietqr_payment_orders o where o.id=v_transaction.matched_order_id;
    return query select v_transaction.id,v_transaction.status::text,v_transaction.matched_order_id,v_order.order_code,
      v_transaction.amount_vnd,v_order.amount_vnd,true;
    return;
  end if;

  select t.* into v_transaction
  from private.vietqr_bank_transactions t
  where t.provider=v_provider and t.provider_transaction_ref=v_ref;
  if found then
    perform private.append_admin_audit(
      p_actor_user_id,v_role,'vietqr_bank_transaction_duplicate_import','vietqr_bank_transaction',v_transaction.id,
      '{}'::jsonb,jsonb_build_object('status',v_transaction.status::text,'provider',v_provider,'amount_vnd',v_transaction.amount_vnd),
      'duplicate_provider_transaction_ref',p_request_id,null,null
    );
    insert into private.vietqr_reconciliation_events(transaction_id,event_type,actor_user_id,request_id,metadata_json)
    values(v_transaction.id,'duplicate_import',p_actor_user_id,p_request_id,
      jsonb_build_object('provider',v_provider,'provider_transaction_ref_sha256',encode(extensions.digest(v_ref,'sha256'),'hex')));
    select o.* into v_order from private.vietqr_payment_orders o where o.id=v_transaction.matched_order_id;
    return query select v_transaction.id,v_transaction.status::text,v_transaction.matched_order_id,v_order.order_code,
      v_transaction.amount_vnd,v_order.amount_vnd,true;
    return;
  end if;

  v_normalized:=private.normalize_vietqr_transfer_content(v_content);
  if char_length(v_normalized)=0 then raise exception using errcode='22023',message='invalid_transfer_content'; end if;
  v_token:=substring(v_normalized from '(MYFANMFQ[0-9A-F]{12})');
  if v_token is not null then
    select o.* into v_order
    from private.vietqr_payment_orders o
    where o.transfer_content=v_token;
  end if;

  if v_order.id is null then
    v_status:='unmatched';
  elsif v_order.amount_vnd<>p_amount_vnd or v_order.status='paid' then
    v_status:='needs_review';
  else
    v_status:='matched';
  end if;

  insert into private.vietqr_bank_transactions(
    provider,provider_transaction_ref,amount_vnd,transfer_content_raw,transfer_content_normalized,matched_token,
    payload_sha256,occurred_at,status,matched_order_id,matched_at,import_request_id
  ) values(
    v_provider,v_ref,p_amount_vnd,v_content,v_normalized,v_token,lower(p_payload_sha256),p_occurred_at,v_status,
    v_order.id,case when v_order.id is not null then now() else null end,p_request_id
  ) returning * into v_transaction;

  insert into private.vietqr_reconciliation_events(transaction_id,event_type,actor_user_id,request_id,metadata_json)
  values(v_transaction.id,'imported',p_actor_user_id,p_request_id,
    jsonb_build_object('status',v_status::text,'provider',v_provider,'matched_token_present',v_token is not null,
      'matched_order_id',v_order.id,'amount_matches',v_order.id is not null and v_order.amount_vnd=p_amount_vnd));

  perform private.append_admin_audit(
    p_actor_user_id,v_role,'vietqr_bank_transaction_imported','vietqr_bank_transaction',v_transaction.id,
    '{}'::jsonb,jsonb_build_object('status',v_status::text,'provider',v_provider,'amount_vnd',p_amount_vnd,
      'matched_order_id',v_order.id,'occurred_at',p_occurred_at),null,p_request_id,null,null
  );

  return query select v_transaction.id,v_status::text,v_order.id,v_order.order_code,p_amount_vnd,v_order.amount_vnd,false;
end
$function$;

create or replace function public.admin_list_vietqr_reconciliation_queue(
  p_actor_user_id uuid,
  p_status text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table(
  transaction_id uuid,
  provider text,
  provider_transaction_ref text,
  amount_vnd bigint,
  transfer_content_raw text,
  occurred_at timestamptz,
  status text,
  matched_order_id uuid,
  order_code text,
  expected_amount_vnd bigint,
  order_status text,
  user_id uuid,
  display_name text,
  created_at timestamptz,
  reviewed_at timestamptz,
  review_reason_code text,
  total_count bigint
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_filter private.vietqr_reconciliation_state;
begin
  perform private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  if p_limit not between 1 and 200 or p_offset<0 then raise exception using errcode='22023',message='invalid_pagination'; end if;
  if p_status is not null then
    begin v_filter:=p_status::private.vietqr_reconciliation_state;
    exception when invalid_text_representation then raise exception using errcode='22023',message='invalid_reconciliation_status';
    end;
  end if;
  return query
  select t.id,t.provider,t.provider_transaction_ref,t.amount_vnd,t.transfer_content_raw,t.occurred_at,t.status::text,
    t.matched_order_id,o.order_code,o.amount_vnd,o.status::text,o.user_id,p.display_name,t.created_at,t.reviewed_at,t.review_reason_code,
    count(*) over()
  from private.vietqr_bank_transactions t
  left join private.vietqr_payment_orders o on o.id=t.matched_order_id
  left join public.profiles p on p.id=o.user_id
  where v_filter is null or t.status=v_filter
  order by t.occurred_at desc,t.created_at desc
  limit p_limit offset p_offset;
end
$function$;

create or replace function public.admin_decide_vietqr_reconciliation(
  p_actor_user_id uuid,
  p_transaction_id uuid,
  p_action text,
  p_order_id uuid,
  p_reason_code text,
  p_request_id uuid
)
returns table(
  transaction_id uuid,
  status text,
  matched_order_id uuid,
  purchase_id uuid,
  balance_after_units bigint,
  already_processed boolean
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role private.user_role;
  v_transaction private.vietqr_bank_transactions%rowtype;
  v_order private.vietqr_payment_orders%rowtype;
  v_existing_audit private.admin_audit_logs%rowtype;
  v_purchase_id uuid;
  v_balance_after bigint;
  v_already_recorded boolean:=false;
  v_before jsonb;
  v_event_type text;
begin
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  if p_action not in ('match','settle','ignore','reject') then raise exception using errcode='22023',message='invalid_reconciliation_action'; end if;
  if p_action in ('ignore','reject') and (p_reason_code is null or p_reason_code !~ '^[a-z][a-z0-9_]{1,63}$') then
    raise exception using errcode='22023',message='reconciliation_reason_required';
  end if;

  select a.* into v_existing_audit from private.admin_audit_logs a where a.request_id=p_request_id;
  if found then
    if v_existing_audit.target_type<>'vietqr_bank_transaction' or v_existing_audit.target_id<>p_transaction_id then
      raise exception using errcode='23505',message='request_id_conflict';
    end if;
    select t.* into v_transaction from private.vietqr_bank_transactions t where t.id=p_transaction_id;
    select o.* into v_order from private.vietqr_payment_orders o where o.id=v_transaction.matched_order_id;
    select v_order.linked_purchase_id,coalesce(ha.available_units,0)
      into v_purchase_id,v_balance_after
    from private.heart_accounts ha
    where ha.user_id=v_order.user_id;
    return query select v_transaction.id,v_transaction.status::text,v_transaction.matched_order_id,v_purchase_id,v_balance_after,true;
    return;
  end if;

  select t.* into v_transaction from private.vietqr_bank_transactions t where t.id=p_transaction_id for update;
  if not found then raise exception using errcode='P0002',message='vietqr_transaction_not_found'; end if;
  if v_transaction.status in ('settled','ignored','rejected') then
    raise exception using errcode='22023',message='vietqr_transaction_already_final';
  end if;
  v_before:=jsonb_build_object('status',v_transaction.status::text,'matched_order_id',v_transaction.matched_order_id,
    'amount_vnd',v_transaction.amount_vnd);

  if p_action='match' then
    if p_order_id is null then raise exception using errcode='22023',message='order_id_required'; end if;
    select o.* into v_order from private.vietqr_payment_orders o where o.id=p_order_id for update;
    if not found then raise exception using errcode='P0002',message='vietqr_order_not_found'; end if;
    if v_order.amount_vnd<>v_transaction.amount_vnd then raise exception using errcode='22023',message='vietqr_amount_mismatch'; end if;
    if v_order.status='paid' then raise exception using errcode='22023',message='vietqr_order_already_paid'; end if;
    update private.vietqr_bank_transactions
    set status='matched',matched_order_id=v_order.id,matched_at=now(),reviewed_at=now(),reviewed_by=p_actor_user_id,
      review_reason_code=null,updated_at=now()
    where id=v_transaction.id returning * into v_transaction;
    v_event_type:='manual_match';
  elsif p_action='settle' then
    if coalesce(private.config_boolean('vietqr_manual_settlement_enabled'),false) is not true then
      raise exception using errcode='55000',message='vietqr_manual_settlement_disabled';
    end if;
    select o.* into v_order from private.vietqr_payment_orders o
    where o.id=coalesce(p_order_id,v_transaction.matched_order_id) for update;
    if not found then raise exception using errcode='P0002',message='vietqr_order_not_found'; end if;
    if v_order.amount_vnd<>v_transaction.amount_vnd then raise exception using errcode='22023',message='vietqr_amount_mismatch'; end if;
    if v_order.status='paid' and coalesce(v_order.bank_transaction_ref,'')<>v_transaction.provider_transaction_ref then
      raise exception using errcode='22023',message='vietqr_order_already_paid';
    end if;
    select r.purchase_id,r.balance_after_units,r.already_recorded
      into v_purchase_id,v_balance_after,v_already_recorded
    from public.record_verified_vietqr_payment(
      v_order.id,v_transaction.provider_transaction_ref,v_transaction.amount_vnd,p_request_id
    ) r;
    update private.vietqr_bank_transactions
    set status='settled',matched_order_id=v_order.id,matched_at=coalesce(matched_at,now()),settled_at=now(),reviewed_at=now(),
      reviewed_by=p_actor_user_id,review_reason_code=null,updated_at=now()
    where id=v_transaction.id returning * into v_transaction;
    v_event_type:='settled';
  elsif p_action='ignore' then
    update private.vietqr_bank_transactions
    set status='ignored',reviewed_at=now(),reviewed_by=p_actor_user_id,review_reason_code=p_reason_code,updated_at=now()
    where id=v_transaction.id returning * into v_transaction;
    v_event_type:='ignored';
  else
    update private.vietqr_bank_transactions
    set status='rejected',reviewed_at=now(),reviewed_by=p_actor_user_id,review_reason_code=p_reason_code,updated_at=now()
    where id=v_transaction.id returning * into v_transaction;
    v_event_type:='rejected';
  end if;

  insert into private.vietqr_reconciliation_events(transaction_id,event_type,actor_user_id,request_id,metadata_json)
  values(v_transaction.id,v_event_type,p_actor_user_id,p_request_id,
    jsonb_build_object('status',v_transaction.status::text,'matched_order_id',v_transaction.matched_order_id,
      'purchase_id',v_purchase_id,'already_recorded',v_already_recorded));

  perform private.append_admin_audit(
    p_actor_user_id,v_role,'vietqr_reconciliation_'||p_action,'vietqr_bank_transaction',v_transaction.id,v_before,
    jsonb_build_object('status',v_transaction.status::text,'matched_order_id',v_transaction.matched_order_id,
      'purchase_id',v_purchase_id,'balance_after_units',v_balance_after),p_reason_code,p_request_id,null,null
  );

  return query select v_transaction.id,v_transaction.status::text,v_transaction.matched_order_id,v_purchase_id,v_balance_after,false;
end
$function$;

revoke all on table private.vietqr_bank_transactions from public,anon,authenticated;
revoke all on table private.vietqr_reconciliation_events from public,anon,authenticated;

revoke execute on function private.config_boolean(text) from public,anon,authenticated;
revoke execute on function private.normalize_vietqr_transfer_content(text) from public,anon,authenticated;
revoke execute on function private.prevent_vietqr_reconciliation_event_mutation() from public,anon,authenticated;

revoke execute on function public.admin_import_vietqr_bank_transaction(uuid,text,text,bigint,text,timestamptz,text,uuid) from public,anon,authenticated;
revoke execute on function public.admin_list_vietqr_reconciliation_queue(uuid,text,integer,integer) from public,anon,authenticated;
revoke execute on function public.admin_decide_vietqr_reconciliation(uuid,uuid,text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_import_vietqr_bank_transaction(uuid,text,text,bigint,text,timestamptz,text,uuid) to service_role;
grant execute on function public.admin_list_vietqr_reconciliation_queue(uuid,text,integer,integer) to service_role;
grant execute on function public.admin_decide_vietqr_reconciliation(uuid,uuid,text,uuid,text,uuid) to service_role;

revoke execute on function public.record_verified_vietqr_payment(uuid,text,bigint,uuid) from service_role;
revoke execute on function public.create_vietqr_heart_order(uuid,uuid) from authenticated;
revoke execute on function public.list_vietqr_heart_products() from authenticated;
revoke execute on function public.get_my_vietqr_heart_order(uuid) from authenticated;
revoke execute on function public.mark_my_vietqr_transfer_submitted(uuid) from authenticated;
revoke execute on function public.cancel_my_vietqr_heart_order(uuid) from authenticated;

commit;
