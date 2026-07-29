-- MyFan Phase B / Session 10
create or replace function private.reward_position_status_for(
  p_original bigint,p_pending bigint,p_available bigint,p_held bigint,p_paid bigint,p_reversed bigint
)
returns private.reward_position_status language sql immutable set search_path='' as $$
  select case
    when p_reversed=p_original then 'reversed'::private.reward_position_status
    when p_held>0 then 'held'::private.reward_position_status
    when p_available>0 then 'available'::private.reward_position_status
    when p_pending>0 then 'pending'::private.reward_position_status
    when p_paid>0 then 'paid'::private.reward_position_status
    else 'partially_reversed'::private.reward_position_status
  end
$$;

create or replace function public.request_withdrawal(
  p_bank_account_id uuid,
  p_requested_reward_units bigint,
  p_idempotency_key uuid
)
returns table(withdrawal_id uuid,status text,requested_reward_units bigint,amount_vnd bigint,held_balance_units bigint,already_processed boolean)
language plpgsql security definer set search_path='' as $$
declare
  v_user_id uuid:=auth.uid();
  v_existing private.withdrawals%rowtype;
  v_bank private.bank_accounts%rowtype;
  v_account private.creator_earning_accounts%rowtype;
  v_position private.creator_reward_positions%rowtype;
  v_withdrawal private.withdrawals%rowtype;
  v_minimum bigint; v_rate bigint; v_units_per_heart bigint; v_remaining bigint; v_take bigint;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if p_idempotency_key is null or p_requested_reward_units is null or p_requested_reward_units<=0 then raise exception using errcode='22023',message='invalid_withdrawal_request'; end if;
  select * into v_existing from private.withdrawals where creator_id=v_user_id and idempotency_key=p_idempotency_key;
  if found then
    select * into v_account from private.creator_earning_accounts where creator_id=v_user_id;
    return query select v_existing.id,v_existing.status::text,v_existing.requested_reward_units,v_existing.amount_vnd,coalesce(v_account.held_units,0),true;
    return;
  end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if not exists(select 1 from public.creator_profiles cp where cp.user_id=v_user_id and cp.creator_status='approved') then raise exception using errcode='42501',message='approved_creator_required'; end if;
  if not exists(select 1 from private.kyc_profiles kp where kp.user_id=v_user_id and kp.status='approved' and (kp.expires_at is null or kp.expires_at>now())) then raise exception using errcode='42501',message='approved_kyc_required'; end if;
  select * into v_bank from private.bank_accounts where id=p_bank_account_id and user_id=v_user_id and status='verified' and deleted_at is null for update;
  if not found then raise exception using errcode='42501',message='verified_bank_account_required'; end if;
  if private.has_active_financial_hold(v_user_id) then raise exception using errcode='42501',message='withdrawal_blocked_by_hold'; end if;
  select (value_json#>>'{}')::bigint into v_minimum from private.app_config where key='minimum_withdrawal_units';
  select (value_json#>>'{}')::bigint into v_rate from private.app_config where key='heart_vnd_rate';
  select (value_json#>>'{}')::bigint into v_units_per_heart from private.app_config where key='heart_units_per_heart';
  if v_minimum is null or v_rate is null or v_units_per_heart is null or v_rate<=0 or v_units_per_heart<=0 then raise exception using errcode='55000',message='withdrawal_configuration_invalid'; end if;
  if p_requested_reward_units<v_minimum then raise exception using errcode='22023',message='withdrawal_below_minimum'; end if;
  select * into v_account from private.creator_earning_accounts where creator_id=v_user_id for update;
  if not found or v_account.is_frozen then raise exception using errcode='42501',message='creator_earning_account_unavailable'; end if;
  if v_account.available_units<p_requested_reward_units then raise exception using errcode='22023',message='insufficient_creator_available_balance'; end if;
  insert into private.withdrawals(
    creator_id,bank_account_id,requested_reward_units,amount_vnd,heart_vnd_rate_snapshot,heart_units_per_heart_snapshot,
    bank_code_snapshot,bank_account_last4_snapshot,bank_account_holder_ciphertext_snapshot,idempotency_key
  ) values(
    v_user_id,v_bank.id,p_requested_reward_units,(p_requested_reward_units*v_rate)/v_units_per_heart,v_rate,v_units_per_heart,
    v_bank.bank_code,v_bank.account_number_last4,v_bank.account_holder_ciphertext,p_idempotency_key
  ) returning * into v_withdrawal;
  v_remaining:=p_requested_reward_units;
  for v_position in
    select * from private.creator_reward_positions rp
    where rp.creator_id=v_user_id and rp.available_units>0
    order by rp.available_at,rp.gift_transaction_id for update
  loop
    v_take:=least(v_position.available_units,v_remaining);
    update private.creator_reward_positions set
      available_units=available_units-v_take,
      held_units=held_units+v_take,
      status=private.reward_position_status_for(original_units,pending_units,available_units-v_take,held_units+v_take,paid_units,reversed_units)
    where gift_transaction_id=v_position.gift_transaction_id;
    insert into private.withdrawal_reward_allocations(withdrawal_id,gift_transaction_id,allocated_units)
    values(v_withdrawal.id,v_position.gift_transaction_id,v_take);
    v_remaining:=v_remaining-v_take;
    exit when v_remaining=0;
  end loop;
  if v_remaining<>0 then raise exception using errcode='23514',message='creator_reward_position_balance_mismatch'; end if;
  update private.creator_earning_accounts set
    available_units=available_units-p_requested_reward_units,
    held_units=held_units+p_requested_reward_units,
    version=version+1
  where creator_id=v_user_id returning * into v_account;
  insert into private.creator_reward_ledger(creator_id,entry_type,amount_units,available_at,reference_type,reference_id,idempotency_key,metadata_json)
  values(v_user_id,'withdrawal_hold',p_requested_reward_units,now(),'withdrawal',v_withdrawal.id,p_idempotency_key,
    jsonb_build_object('status','pending','bank_code',v_bank.bank_code,'bank_last4',v_bank.account_number_last4,'amount_vnd',v_withdrawal.amount_vnd));
  update public.economy_sync set creator_account_version=v_account.version,updated_at=now() where user_id=v_user_id;
  perform private.append_admin_audit(v_user_id,'user','withdrawal_requested','withdrawal',v_withdrawal.id,'{}'::jsonb,
    jsonb_build_object('status','pending','reward_units',p_requested_reward_units,'amount_vnd',v_withdrawal.amount_vnd,'bank_code',v_bank.bank_code,'bank_last4',v_bank.account_number_last4),
    null,p_idempotency_key,null,null);
  perform private.bump_payout_sync(v_user_id,false,false,true,false);
  return query select v_withdrawal.id,v_withdrawal.status::text,v_withdrawal.requested_reward_units,v_withdrawal.amount_vnd,v_account.held_units,false;
end $$;

create or replace function public.cancel_my_withdrawal(p_withdrawal_id uuid,p_request_id uuid)
returns table(withdrawal_id uuid,status text,available_balance_units bigint,already_processed boolean)
language plpgsql security definer set search_path='' as $$
declare v_user_id uuid:=auth.uid(); v_withdrawal private.withdrawals%rowtype; v_account private.creator_earning_accounts%rowtype; v_alloc private.withdrawal_reward_allocations%rowtype;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  if exists(select 1 from private.admin_audit_logs a where a.request_id=p_request_id and a.action='withdrawal_cancelled' and a.target_id=p_withdrawal_id) then
    select * into v_withdrawal from private.withdrawals where id=p_withdrawal_id and creator_id=v_user_id;
    select * into v_account from private.creator_earning_accounts where creator_id=v_user_id;
    return query select v_withdrawal.id,v_withdrawal.status::text,v_account.available_units,true;
    return;
  end if;
  select * into v_withdrawal from private.withdrawals where id=p_withdrawal_id and creator_id=v_user_id for update;
  if not found or v_withdrawal.status<>'pending' then raise exception using errcode='42501',message='pending_withdrawal_required'; end if;
  select * into v_account from private.creator_earning_accounts where creator_id=v_user_id for update;
  for v_alloc in select * from private.withdrawal_reward_allocations where withdrawal_id=v_withdrawal.id for update loop
    update private.creator_reward_positions set
      held_units=held_units-v_alloc.allocated_units,
      available_units=available_units+v_alloc.allocated_units,
      status=private.reward_position_status_for(original_units,pending_units,available_units+v_alloc.allocated_units,held_units-v_alloc.allocated_units,paid_units,reversed_units)
    where gift_transaction_id=v_alloc.gift_transaction_id;
    update private.withdrawal_reward_allocations set released_units=allocated_units where withdrawal_id=v_withdrawal.id and gift_transaction_id=v_alloc.gift_transaction_id;
  end loop;
  update private.creator_earning_accounts set held_units=held_units-v_withdrawal.requested_reward_units,available_units=available_units+v_withdrawal.requested_reward_units,version=version+1
  where creator_id=v_user_id returning * into v_account;
  update private.withdrawals set status='cancelled' where id=v_withdrawal.id returning * into v_withdrawal;
  insert into private.creator_reward_ledger(creator_id,entry_type,amount_units,available_at,reference_type,reference_id,idempotency_key,metadata_json)
  values(v_user_id,'withdrawal_released',v_withdrawal.requested_reward_units,now(),'withdrawal',v_withdrawal.id,p_request_id,jsonb_build_object('status','cancelled'));
  update public.economy_sync set creator_account_version=v_account.version,updated_at=now() where user_id=v_user_id;
  perform private.append_admin_audit(v_user_id,'user','withdrawal_cancelled','withdrawal',v_withdrawal.id,jsonb_build_object('status','pending'),jsonb_build_object('status','cancelled'),null,p_request_id,null,null);
  perform private.bump_payout_sync(v_user_id,false,false,true,false);
  return query select v_withdrawal.id,v_withdrawal.status::text,v_account.available_units,false;
end $$;

revoke all on function private.reward_position_status_for(bigint,bigint,bigint,bigint,bigint,bigint) from public,anon,authenticated;
revoke all on function public.request_withdrawal(uuid,bigint,uuid) from public,anon;
grant execute on function public.request_withdrawal(uuid,bigint,uuid) to authenticated;
revoke all on function public.cancel_my_withdrawal(uuid,uuid) from public,anon;
grant execute on function public.cancel_my_withdrawal(uuid,uuid) to authenticated;
