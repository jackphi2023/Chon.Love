-- Qualify withdrawal admin columns that collide with OUT parameter names.
create or replace function public.admin_decide_withdrawal(
  p_actor_user_id uuid,p_withdrawal_id uuid,p_action text,p_reason_code text,p_payment_reference text,p_request_id uuid
)
returns table(withdrawal_id uuid,status text,held_balance_units bigint,paid_balance_units bigint,already_processed boolean)
language plpgsql security definer set search_path='' as $$
declare v_role private.user_role; v_withdrawal private.withdrawals%rowtype; v_existing private.admin_audit_logs%rowtype; v_account private.creator_earning_accounts%rowtype; v_alloc private.withdrawal_reward_allocations%rowtype; v_before jsonb;
begin
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  if p_action not in ('approve','reject','processing','paid') then raise exception using errcode='22023',message='invalid_withdrawal_action'; end if;
  select a.* into v_existing from private.admin_audit_logs a where a.request_id=p_request_id;
  if found then
    select w.* into v_withdrawal from private.withdrawals w where w.id=p_withdrawal_id;
    select cea.* into v_account from private.creator_earning_accounts cea where cea.creator_id=v_withdrawal.creator_id;
    return query select v_withdrawal.id,v_withdrawal.status::text,v_account.held_units,v_account.paid_units,true;
    return;
  end if;
  select w.* into v_withdrawal from private.withdrawals w where w.id=p_withdrawal_id for update;
  if not found then raise exception using errcode='23503',message='withdrawal_not_found'; end if;
  select cea.* into v_account from private.creator_earning_accounts cea where cea.creator_id=v_withdrawal.creator_id for update;
  v_before:=jsonb_build_object('status',v_withdrawal.status::text,'reward_units',v_withdrawal.requested_reward_units,'amount_vnd',v_withdrawal.amount_vnd,'bank_code',v_withdrawal.bank_code_snapshot,'bank_last4',v_withdrawal.bank_account_last4_snapshot);
  if p_action='approve' then
    if v_withdrawal.status not in ('pending','under_review') then raise exception using errcode='42501',message='withdrawal_not_approvable'; end if;
    update private.withdrawals as w set status='approved',reviewed_at=now(),reviewed_by=p_actor_user_id,approved_at=now(),rejection_reason_code=null where w.id=v_withdrawal.id returning w.* into v_withdrawal;
  elsif p_action='processing' then
    if v_withdrawal.status<>'approved' then raise exception using errcode='42501',message='approved_withdrawal_required'; end if;
    update private.withdrawals as w set status='processing' where w.id=v_withdrawal.id returning w.* into v_withdrawal;
  elsif p_action='reject' then
    if v_withdrawal.status not in ('pending','under_review','approved') then raise exception using errcode='42501',message='withdrawal_not_rejectable'; end if;
    if p_reason_code is null or p_reason_code!~'^[a-z][a-z0-9_]{1,63}$' then raise exception using errcode='22023',message='withdrawal_rejection_reason_required'; end if;
    for v_alloc in select wa.* from private.withdrawal_reward_allocations wa where wa.withdrawal_id=v_withdrawal.id for update loop
      update private.creator_reward_positions as rp set held_units=rp.held_units-v_alloc.allocated_units,available_units=rp.available_units+v_alloc.allocated_units,
        status=private.reward_position_status_for(rp.original_units,rp.pending_units,rp.available_units+v_alloc.allocated_units,rp.held_units-v_alloc.allocated_units,rp.paid_units,rp.reversed_units)
      where rp.gift_transaction_id=v_alloc.gift_transaction_id;
      update private.withdrawal_reward_allocations as wa set released_units=wa.allocated_units where wa.withdrawal_id=v_withdrawal.id and wa.gift_transaction_id=v_alloc.gift_transaction_id;
    end loop;
    update private.creator_earning_accounts as cea set held_units=cea.held_units-v_withdrawal.requested_reward_units,available_units=cea.available_units+v_withdrawal.requested_reward_units,version=cea.version+1
      where cea.creator_id=v_withdrawal.creator_id returning cea.* into v_account;
    update private.withdrawals as w set status='rejected',reviewed_at=now(),reviewed_by=p_actor_user_id,rejection_reason_code=p_reason_code,approved_at=null where w.id=v_withdrawal.id returning w.* into v_withdrawal;
    insert into private.creator_reward_ledger(creator_id,entry_type,amount_units,available_at,reference_type,reference_id,idempotency_key,metadata_json)
      values(v_withdrawal.creator_id,'withdrawal_released',v_withdrawal.requested_reward_units,now(),'withdrawal',v_withdrawal.id,p_request_id,jsonb_build_object('status','rejected','reason_code',p_reason_code));
  else
    if v_withdrawal.status not in ('approved','processing') then raise exception using errcode='42501',message='approved_or_processing_withdrawal_required'; end if;
    if nullif(btrim(p_payment_reference),'') is null or char_length(p_payment_reference)>120 then raise exception using errcode='22023',message='payment_reference_required'; end if;
    for v_alloc in select wa.* from private.withdrawal_reward_allocations wa where wa.withdrawal_id=v_withdrawal.id for update loop
      update private.creator_reward_positions as rp set held_units=rp.held_units-v_alloc.allocated_units,paid_units=rp.paid_units+v_alloc.allocated_units,
        status=private.reward_position_status_for(rp.original_units,rp.pending_units,rp.available_units,rp.held_units-v_alloc.allocated_units,rp.paid_units+v_alloc.allocated_units,rp.reversed_units)
      where rp.gift_transaction_id=v_alloc.gift_transaction_id;
      update private.withdrawal_reward_allocations as wa set paid_units=wa.allocated_units where wa.withdrawal_id=v_withdrawal.id and wa.gift_transaction_id=v_alloc.gift_transaction_id;
    end loop;
    update private.creator_earning_accounts as cea set held_units=cea.held_units-v_withdrawal.requested_reward_units,paid_units=cea.paid_units+v_withdrawal.requested_reward_units,version=cea.version+1
      where cea.creator_id=v_withdrawal.creator_id returning cea.* into v_account;
    update private.withdrawals as w set status='paid',paid_at=now(),payment_reference=btrim(p_payment_reference) where w.id=v_withdrawal.id returning w.* into v_withdrawal;
    insert into private.creator_reward_ledger(creator_id,entry_type,amount_units,available_at,reference_type,reference_id,idempotency_key,metadata_json)
      values(v_withdrawal.creator_id,'withdrawal_paid',v_withdrawal.requested_reward_units,now(),'withdrawal',v_withdrawal.id,p_request_id,jsonb_build_object('status','paid','payment_reference_present',true));
  end if;
  if p_action in ('reject','paid') then update public.economy_sync as es set creator_account_version=v_account.version,updated_at=now() where es.user_id=v_withdrawal.creator_id; end if;
  perform private.append_admin_audit(p_actor_user_id,v_role,'withdrawal_'||p_action,'withdrawal',v_withdrawal.id,v_before,
    jsonb_build_object('status',v_withdrawal.status::text,'reward_units',v_withdrawal.requested_reward_units,'amount_vnd',v_withdrawal.amount_vnd,'bank_code',v_withdrawal.bank_code_snapshot,'bank_last4',v_withdrawal.bank_account_last4_snapshot,'payment_reference_present',v_withdrawal.payment_reference is not null),
    p_reason_code,p_request_id,null,null);
  perform private.bump_payout_sync(v_withdrawal.creator_id,false,false,true,false);
  return query select v_withdrawal.id,v_withdrawal.status::text,v_account.held_units,v_account.paid_units,false;
end $$;

revoke all on function public.admin_decide_withdrawal(uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_decide_withdrawal(uuid,uuid,text,text,text,uuid) to service_role;
