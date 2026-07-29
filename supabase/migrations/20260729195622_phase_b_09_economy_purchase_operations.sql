-- MyFan Phase B / Session 9 operations and access control.

create or replace function private.prevent_immutable_financial_mutation()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception using errcode='42501',message=TG_TABLE_NAME||'_is_immutable';
end $$;
revoke all on function private.prevent_immutable_financial_mutation() from public,anon,authenticated;

create trigger heart_ledger_immutable before update or delete on private.heart_ledger
for each row execute function private.prevent_immutable_financial_mutation();
create trigger creator_reward_ledger_immutable before update or delete on private.creator_reward_ledger
for each row execute function private.prevent_immutable_financial_mutation();
create trigger purchase_reversal_events_immutable before update or delete on private.purchase_reversal_events
for each row execute function private.prevent_immutable_financial_mutation();

create or replace function private.config_integer(p_key text)
returns bigint language sql stable security definer set search_path='' as $$
  select case when c.value_type='integer'::private.config_value_type then (c.value_json#>>'{}')::bigint else null end
  from private.app_config c where c.key=p_key
$$;
revoke all on function private.config_integer(text) from public,anon,authenticated;

create or replace function private.optional_config_limit(p_key text)
returns bigint language plpgsql stable security definer set search_path='' as $$
declare v private.app_config%rowtype; v_enabled boolean; v_units bigint;
begin
  select * into v from private.app_config where key=p_key;
  if not found then return null; end if;
  if v.value_type='integer'::private.config_value_type then return (v.value_json#>>'{}')::bigint; end if;
  if v.value_type='json'::private.config_value_type then
    v_enabled:=coalesce((v.value_json->>'enabled')::boolean,false);
    if not v_enabled or v.value_json->>'units' is null then return null; end if;
    v_units:=(v.value_json->>'units')::bigint;
    if v_units<=0 then return null; end if;
    return v_units;
  end if;
  return null;
exception when invalid_text_representation or numeric_value_out_of_range then
  return null;
end $$;
revoke all on function private.optional_config_limit(text) from public,anon,authenticated;

create or replace function private.ensure_economy_accounts(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_user_id is null then raise exception using errcode='22023',message='user_id_required'; end if;
  insert into private.heart_accounts(user_id) values(p_user_id) on conflict(user_id) do nothing;
  insert into public.economy_sync(user_id) values(p_user_id) on conflict(user_id) do nothing;
  if exists(select 1 from public.creator_profiles cp where cp.user_id=p_user_id) then
    insert into private.creator_earning_accounts(creator_id) values(p_user_id) on conflict(creator_id) do nothing;
  end if;
end $$;
revoke all on function private.ensure_economy_accounts(uuid) from public,anon,authenticated;

create or replace function private.handle_new_auth_user_economy()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform private.ensure_economy_accounts(new.id);
  return new;
end $$;
revoke all on function private.handle_new_auth_user_economy() from public,anon,authenticated;
create trigger on_auth_user_created_economy after insert on auth.users
for each row execute function private.handle_new_auth_user_economy();

create or replace function private.handle_creator_profile_economy()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into private.creator_earning_accounts(creator_id) values(new.user_id) on conflict(creator_id) do nothing;
  insert into public.economy_sync(user_id) values(new.user_id) on conflict(user_id) do nothing;
  return new;
end $$;
revoke all on function private.handle_creator_profile_economy() from public,anon,authenticated;
create trigger creator_profiles_create_earning_account after insert on public.creator_profiles
for each row execute function private.handle_creator_profile_economy();

insert into private.heart_accounts(user_id) select id from auth.users on conflict(user_id) do nothing;
insert into public.economy_sync(user_id) select id from auth.users on conflict(user_id) do nothing;
insert into private.creator_earning_accounts(creator_id) select user_id from public.creator_profiles on conflict(creator_id) do nothing;

create or replace function private.validate_gift_message_insert()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_gift public.gift_transactions%rowtype;
begin
  if new.message_type<>'gift'::public.message_type then return new; end if;
  select * into v_gift from public.gift_transactions where id=new.gift_transaction_id;
  if not found then raise exception using errcode='23503',message='gift_transaction_not_found'; end if;
  if v_gift.sender_id<>new.sender_id then raise exception using errcode='42501',message='gift_message_sender_mismatch'; end if;
  if v_gift.status='reversed'::public.gift_transaction_status then raise exception using errcode='42501',message='reversed_gift_message_not_allowed'; end if;
  if not exists(select 1 from public.conversation_members cm where cm.conversation_id=new.conversation_id and cm.user_id=v_gift.creator_id) then
    raise exception using errcode='42501',message='gift_creator_not_conversation_member';
  end if;
  return new;
end $$;
revoke all on function private.validate_gift_message_insert() from public,anon,authenticated;
create trigger messages_validate_gift before insert on public.messages
for each row when (new.message_type='gift'::public.message_type)
execute function private.validate_gift_message_insert();

create or replace function public.get_my_economy_summary()
returns table(
  user_id uuid,
  heart_available_units bigint,
  heart_held_units bigint,
  lifetime_purchased_units bigint,
  lifetime_spent_units bigint,
  lifetime_reversed_units bigint,
  heart_version bigint,
  creator_pending_units bigint,
  creator_available_units bigint,
  creator_held_units bigint,
  creator_paid_units bigint,
  creator_reversed_units bigint,
  creator_version bigint,
  creator_frozen boolean
)
language plpgsql security definer set search_path='' as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  perform private.ensure_economy_accounts(v_user_id);
  return query
  select h.user_id,h.available_units,h.held_units,h.lifetime_purchased_units,h.lifetime_spent_units,h.lifetime_reversed_units,h.version,
         coalesce(e.pending_units,0),coalesce(e.available_units,0),coalesce(e.held_units,0),coalesce(e.paid_units,0),coalesce(e.reversed_units,0),coalesce(e.version,0),coalesce(e.is_frozen,false)
  from private.heart_accounts h left join private.creator_earning_accounts e on e.creator_id=h.user_id
  where h.user_id=v_user_id;
end $$;
revoke all on function public.get_my_economy_summary() from public,anon;
grant execute on function public.get_my_economy_summary() to authenticated,service_role;

create or replace function public.list_my_play_purchases(p_limit integer default 50,p_cursor uuid default null)
returns table(
  id uuid,product_id uuid,google_product_id text,purchase_state text,heart_units bigint,
  currency_code text,gross_amount_micros bigint,country_code text,google_order_id text,
  is_test_purchase boolean,verified_at timestamptz,acknowledged_at timestamptz,consumed_at timestamptz,
  refunded_at timestamptz,revoked_at timestamptz,created_at timestamptz
)
language sql stable security definer set search_path='' as $$
  select p.id,p.product_id,p.google_product_id,p.purchase_state::text,p.heart_units,p.currency_code::text,p.gross_amount_micros,p.country_code::text,p.google_order_id,
         p.is_test_purchase,p.verified_at,p.acknowledged_at,p.consumed_at,p.refunded_at,p.revoked_at,p.created_at
  from private.play_purchases p
  where p.user_id=auth.uid() and (p_cursor is null or p.id>p_cursor)
  order by p.id limit least(greatest(coalesce(p_limit,50),1),100)
$$;
revoke all on function public.list_my_play_purchases(integer,uuid) from public,anon;
grant execute on function public.list_my_play_purchases(integer,uuid) to authenticated,service_role;

create or replace function public.list_my_gifts(p_limit integer default 50,p_cursor uuid default null)
returns setof public.gift_transactions
language sql stable security definer set search_path='' as $$
  select g.* from public.gift_transactions g
  where (g.sender_id=auth.uid() or g.creator_id=auth.uid()) and (p_cursor is null or g.id>p_cursor)
  order by g.id limit least(greatest(coalesce(p_limit,50),1),100)
$$;
revoke all on function public.list_my_gifts(integer,uuid) from public,anon;
grant execute on function public.list_my_gifts(integer,uuid) to authenticated,service_role;

create or replace function public.record_verified_play_purchase(
  p_user_id uuid,
  p_google_product_id text,
  p_purchase_token_hash text,
  p_google_order_id text,
  p_obfuscated_external_account_id text,
  p_country_code text,
  p_is_test_purchase boolean,
  p_idempotency_key uuid,
  p_raw_response_encrypted bytea default null
)
returns table(purchase_id uuid,heart_units bigint,balance_after_units bigint,purchase_state text,already_recorded boolean)
language plpgsql security definer set search_path='' as $$
declare
  v_product public.heart_products%rowtype;
  v_existing private.play_purchases%rowtype;
  v_purchase_id uuid;
  v_account private.heart_accounts%rowtype;
  v_expected_account_id text;
begin
  if p_user_id is null or p_idempotency_key is null then raise exception using errcode='22023',message='user_and_idempotency_required'; end if;
  if p_purchase_token_hash is null or p_purchase_token_hash!~'^[0-9a-f]{64}$' then raise exception using errcode='22023',message='invalid_purchase_token_hash'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_purchase_token_hash,0));
  select * into v_existing from private.play_purchases where purchase_token_hash=p_purchase_token_hash or idempotency_key=p_idempotency_key order by created_at limit 1;
  if found then
    if v_existing.user_id<>p_user_id or v_existing.google_product_id<>p_google_product_id then raise exception using errcode='23505',message='purchase_identity_conflict'; end if;
    select * into v_account from private.heart_accounts where user_id=p_user_id;
    return query select v_existing.id,v_existing.heart_units,v_account.available_units,v_existing.purchase_state::text,true;
    return;
  end if;
  select * into v_product from public.heart_products where google_product_id=p_google_product_id and is_active;
  if not found then raise exception using errcode='22023',message='heart_product_not_active'; end if;
  if not private.is_active_adult(p_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  v_expected_account_id:=encode(extensions.digest(p_user_id::text,'sha256'),'hex');
  if p_obfuscated_external_account_id is null or p_obfuscated_external_account_id<>v_expected_account_id then
    raise exception using errcode='42501',message='google_account_binding_mismatch';
  end if;
  perform private.ensure_economy_accounts(p_user_id);
  select * into v_account from private.heart_accounts where user_id=p_user_id for update;
  insert into private.play_purchases(
    user_id,product_id,google_product_id,purchase_token_hash,google_order_id,purchase_state,heart_units,country_code,
    obfuscated_external_account_id,is_test_purchase,verified_at,idempotency_key,raw_response_encrypted
  ) values(
    p_user_id,v_product.id,v_product.google_product_id,p_purchase_token_hash,nullif(btrim(p_google_order_id),''),'purchased',v_product.heart_units,
    case when p_country_code is null then null else upper(p_country_code)::char(2) end,p_obfuscated_external_account_id,coalesce(p_is_test_purchase,false),now(),p_idempotency_key,p_raw_response_encrypted
  ) returning id into v_purchase_id;
  insert into private.heart_lots(purchase_id,user_id,original_units,available_units) values(v_purchase_id,p_user_id,v_product.heart_units,v_product.heart_units);
  update private.heart_accounts set available_units=available_units+v_product.heart_units,lifetime_purchased_units=lifetime_purchased_units+v_product.heart_units,version=version+1
  where user_id=p_user_id returning * into v_account;
  insert into private.heart_ledger(user_id,entry_type,amount_units,balance_after_units,reference_type,reference_id,idempotency_key,metadata_json)
  values(p_user_id,'purchase_credit',v_product.heart_units,v_account.available_units,'play_purchase',v_purchase_id,p_idempotency_key,jsonb_build_object('google_product_id',v_product.google_product_id));
  update public.economy_sync set heart_account_version=v_account.version,updated_at=now() where user_id=p_user_id;
  return query select v_purchase_id,v_product.heart_units,v_account.available_units,'purchased'::text,false;
end $$;
revoke all on function public.record_verified_play_purchase(uuid,text,text,text,text,text,boolean,uuid,bytea) from public,anon,authenticated;
grant execute on function public.record_verified_play_purchase(uuid,text,text,text,text,text,boolean,uuid,bytea) to service_role;

create or replace function public.mark_play_purchase_consumed(p_purchase_token_hash text,p_consumed_at timestamptz default now())
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update private.play_purchases
  set purchase_state='consumed',acknowledged_at=coalesce(acknowledged_at,p_consumed_at),consumed_at=coalesce(consumed_at,p_consumed_at)
  where purchase_token_hash=p_purchase_token_hash and purchase_state in ('purchased','consumed');
  return found;
end $$;
revoke all on function public.mark_play_purchase_consumed(text,timestamptz) from public,anon,authenticated;
grant execute on function public.mark_play_purchase_consumed(text,timestamptz) to service_role;
