create or replace function public.reverse_play_purchase(
  p_purchase_token_hash text,
  p_event_type text,
  p_idempotency_key uuid,
  p_reason_code text
)
returns table(
  purchase_id uuid,purchase_state text,unspent_debited_units bigint,spent_reversed_units bigint,
  creator_reward_reversed_units bigint,creator_liability_units bigint,already_processed boolean
)
language plpgsql security definer set search_path='' as $$
declare
  v_purchase private.play_purchases%rowtype;
  v_existing private.purchase_reversal_events%rowtype;
  v_account private.heart_accounts%rowtype;
  v_lot private.heart_lots%rowtype;
  v_alloc private.gift_funding_allocations%rowtype;
  v_gift public.gift_transactions%rowtype;
  v_position private.creator_reward_positions%rowtype;
  v_creator_account private.creator_earning_accounts%rowtype;
  v_event_type private.purchase_reversal_type;
  v_unspent bigint:=0;
  v_spent bigint:=0;
  v_reward_total bigint:=0;
  v_liability_total bigint:=0;
  v_reverse_gross bigint;
  v_reverse_reward bigint;
  v_reverse_platform bigint;
  v_remaining_reward bigint;
  v_from_pending bigint;
  v_from_available bigint;
  v_from_held bigint;
  v_from_paid bigint;
  v_new_reversed_gross bigint;
  v_new_reversed_reward bigint;
  v_new_reversed_platform bigint;
  v_new_status public.gift_transaction_status;
  v_progress public.fan_progress%rowtype;
begin
  if p_purchase_token_hash is null or p_purchase_token_hash!~'^[0-9a-f]{64}$' or p_idempotency_key is null then raise exception using errcode='22023',message='invalid_reversal_request'; end if;
  if p_event_type not in ('refund','revocation') then raise exception using errcode='22023',message='invalid_reversal_type'; end if;
  if p_reason_code is null or p_reason_code!~'^[a-z][a-z0-9_]{1,63}$' then raise exception using errcode='22023',message='invalid_reversal_reason'; end if;
  v_event_type:=p_event_type::private.purchase_reversal_type;
  perform pg_advisory_xact_lock(hashtextextended(p_purchase_token_hash,0));
  select pre.* into v_existing from private.purchase_reversal_events pre where pre.idempotency_key=p_idempotency_key;
  if found then
    select pp.* into v_purchase from private.play_purchases pp where pp.id=v_existing.purchase_id;
    return query select v_purchase.id,v_purchase.purchase_state::text,v_existing.unspent_debited_units,v_existing.spent_reversed_units,v_existing.creator_reward_reversed_units,v_existing.creator_liability_units,true;
    return;
  end if;
  select pp.* into v_purchase from private.play_purchases pp where pp.purchase_token_hash=p_purchase_token_hash for update;
  if not found then raise exception using errcode='23503',message='play_purchase_not_found'; end if;
  select pre.* into v_existing from private.purchase_reversal_events pre where pre.purchase_id=v_purchase.id and pre.event_type=v_event_type;
  if found then
    return query select v_purchase.id,v_purchase.purchase_state::text,v_existing.unspent_debited_units,v_existing.spent_reversed_units,v_existing.creator_reward_reversed_units,v_existing.creator_liability_units,true;
    return;
  end if;
  select ha.* into v_account from private.heart_accounts ha where ha.user_id=v_purchase.user_id for update;
  select hl.* into v_lot from private.heart_lots hl where hl.purchase_id=v_purchase.id for update;
  v_unspent:=v_lot.available_units;
  if v_unspent>0 then
    update private.heart_lots hl set available_units=0,reversed_units=hl.reversed_units+v_unspent where hl.purchase_id=v_purchase.id;
    update private.heart_accounts ha set available_units=ha.available_units-v_unspent,lifetime_reversed_units=ha.lifetime_reversed_units+v_unspent,version=ha.version+1
    where ha.user_id=v_purchase.user_id returning ha.* into v_account;
    insert into private.heart_ledger(user_id,entry_type,amount_units,balance_after_units,reference_type,reference_id,idempotency_key,metadata_json)
    values(v_purchase.user_id,'refund_debit',-v_unspent,v_account.available_units,'play_purchase',v_purchase.id,p_idempotency_key,jsonb_build_object('event_type',p_event_type,'reason_code',p_reason_code));
  end if;
  for v_alloc in select gfa.* from private.gift_funding_allocations gfa where gfa.purchase_id=v_purchase.id and gfa.reversed_units<gfa.allocated_units order by gfa.gift_transaction_id for update loop
    v_reverse_gross:=v_alloc.allocated_units-v_alloc.reversed_units;
    select gt.* into v_gift from public.gift_transactions gt where gt.id=v_alloc.gift_transaction_id for update;
    v_reverse_reward:=(v_reverse_gross*v_gift.creator_share_bps)/10000;
    v_reverse_platform:=v_reverse_gross-v_reverse_reward;
    select crp.* into v_position from private.creator_reward_positions crp where crp.gift_transaction_id=v_gift.id for update;
    select cea.* into v_creator_account from private.creator_earning_accounts cea where cea.creator_id=v_gift.creator_id for update;
    v_remaining_reward:=v_reverse_reward;
    v_from_pending:=least(v_position.pending_units,v_remaining_reward); v_remaining_reward:=v_remaining_reward-v_from_pending;
    v_from_available:=least(v_position.available_units,v_remaining_reward); v_remaining_reward:=v_remaining_reward-v_from_available;
    v_from_held:=least(v_position.held_units,v_remaining_reward); v_remaining_reward:=v_remaining_reward-v_from_held;
    v_from_paid:=least(v_position.paid_units,v_remaining_reward); v_remaining_reward:=v_remaining_reward-v_from_paid;
    if v_remaining_reward<>0 then raise exception using errcode='23514',message='creator_reward_position_invariant_failed'; end if;
    update private.creator_reward_positions crp set
      pending_units=crp.pending_units-v_from_pending,
      available_units=crp.available_units-v_from_available,
      held_units=crp.held_units-v_from_held,
      paid_units=crp.paid_units-v_from_paid,
      reversed_units=crp.reversed_units+v_reverse_reward,
      status=case when crp.reversed_units+v_reverse_reward=crp.original_units then 'reversed'::private.reward_position_status else 'partially_reversed'::private.reward_position_status end
    where crp.gift_transaction_id=v_gift.id;
    update private.creator_earning_accounts cea set
      pending_units=cea.pending_units-v_from_pending,
      available_units=cea.available_units-v_from_available,
      held_units=cea.held_units-v_from_held,
      paid_units=cea.paid_units-v_from_paid,
      reversed_units=cea.reversed_units+v_reverse_reward,
      version=cea.version+1
    where cea.creator_id=v_gift.creator_id returning cea.* into v_creator_account;
    if v_from_paid>0 then
      insert into private.creator_reward_liabilities(creator_id,purchase_id,gift_transaction_id,amount_units,reason_code)
      values(v_gift.creator_id,v_purchase.id,v_gift.id,v_from_paid,'paid_reward_purchase_reversal')
      on conflict on constraint creator_reward_liabilities_purchase_id_gift_transaction_id_key do update set amount_units=private.creator_reward_liabilities.amount_units+excluded.amount_units;
      v_liability_total:=v_liability_total+v_from_paid;
    end if;
    insert into private.creator_reward_ledger(creator_id,gift_transaction_id,entry_type,amount_units,available_at,reference_type,reference_id,idempotency_key,metadata_json)
    values(v_gift.creator_id,v_gift.id,'reward_reversed',-v_reverse_reward,now(),'play_purchase',v_purchase.id,extensions.gen_random_uuid(),
      jsonb_build_object('pending_units',v_from_pending,'available_units',v_from_available,'held_units',v_from_held,'paid_units',v_from_paid,'reason_code',p_reason_code));
    update private.gift_funding_allocations gfa set reversed_units=gfa.allocated_units where gfa.gift_transaction_id=v_alloc.gift_transaction_id and gfa.purchase_id=v_alloc.purchase_id;
    update private.heart_lots hl set spent_units=hl.spent_units-v_reverse_gross,reversed_units=hl.reversed_units+v_reverse_gross where hl.purchase_id=v_purchase.id;
    v_new_reversed_gross:=v_gift.reversed_heart_units+v_reverse_gross;
    v_new_reversed_reward:=v_gift.reversed_creator_reward_units+v_reverse_reward;
    v_new_reversed_platform:=v_gift.reversed_platform_units+v_reverse_platform;
    v_new_status:=case when v_new_reversed_gross=v_gift.gross_heart_units then 'reversed'::public.gift_transaction_status else 'partially_reversed'::public.gift_transaction_status end;
    update public.gift_transactions gt set reversed_heart_units=v_new_reversed_gross,reversed_creator_reward_units=v_new_reversed_reward,reversed_platform_units=v_new_reversed_platform,status=v_new_status,reversed_at=now()
    where gt.id=v_gift.id;
    update public.fan_progress fp set eligible_units=greatest(fp.eligible_units-v_reverse_gross,0)
    where fp.creator_id=v_gift.creator_id and fp.fan_user_id=v_gift.sender_id returning fp.* into v_progress;
    if found and v_progress.eligible_units<v_progress.threshold_units then
      update public.fan_memberships fm set status='revoked',revoked_at=coalesce(fm.revoked_at,now())
      where fm.creator_id=v_gift.creator_id and fm.fan_user_id=v_gift.sender_id and fm.status='active';
    end if;
    update public.economy_sync es set creator_account_version=v_creator_account.version,updated_at=now() where es.user_id=v_gift.creator_id;
    v_spent:=v_spent+v_reverse_gross;
    v_reward_total:=v_reward_total+v_reverse_reward;
  end loop;
  update private.play_purchases pp set
    purchase_state=case when v_event_type='refund' then 'refunded'::private.play_purchase_state else 'revoked'::private.play_purchase_state end,
    refunded_at=case when v_event_type='refund' then now() else pp.refunded_at end,
    revoked_at=case when v_event_type='revocation' then now() else pp.revoked_at end
  where pp.id=v_purchase.id returning pp.* into v_purchase;
  if v_unspent=0 then
    update private.heart_accounts ha set lifetime_reversed_units=ha.lifetime_reversed_units+v_spent,version=ha.version+1 where ha.user_id=v_purchase.user_id returning ha.* into v_account;
  else
    update private.heart_accounts ha set lifetime_reversed_units=ha.lifetime_reversed_units+v_spent where ha.user_id=v_purchase.user_id returning ha.* into v_account;
  end if;
  update public.economy_sync es set heart_account_version=v_account.version,updated_at=now() where es.user_id=v_purchase.user_id;
  insert into private.purchase_reversal_events(purchase_id,event_type,reason_code,unspent_debited_units,spent_reversed_units,creator_reward_reversed_units,creator_liability_units,idempotency_key)
  values(v_purchase.id,v_event_type,p_reason_code,v_unspent,v_spent,v_reward_total,v_liability_total,p_idempotency_key);
  return query select v_purchase.id,v_purchase.purchase_state::text,v_unspent,v_spent,v_reward_total,v_liability_total,false;
end $$;
revoke all on function public.reverse_play_purchase(text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.reverse_play_purchase(text,text,uuid,text) to service_role;

alter table public.heart_products enable row level security;
alter table public.gift_catalog enable row level security;
alter table public.gift_transactions enable row level security;
alter table public.fan_progress enable row level security;
alter table public.fan_memberships enable row level security;
alter table public.economy_sync enable row level security;
alter table private.play_purchases enable row level security;
alter table private.heart_accounts enable row level security;
alter table private.heart_lots enable row level security;
alter table private.heart_ledger enable row level security;
alter table private.gift_funding_allocations enable row level security;
alter table private.creator_earning_accounts enable row level security;
alter table private.creator_reward_positions enable row level security;
alter table private.creator_reward_ledger enable row level security;
alter table private.purchase_reversal_events enable row level security;
alter table private.creator_reward_liabilities enable row level security;

revoke all on public.heart_products,public.gift_catalog,public.gift_transactions,public.fan_progress,public.fan_memberships,public.economy_sync from public,anon,authenticated;
grant select on public.heart_products,public.gift_catalog to anon,authenticated;
grant select on public.gift_transactions,public.fan_progress,public.fan_memberships,public.economy_sync to authenticated;
revoke all on private.play_purchases,private.heart_accounts,private.heart_lots,private.heart_ledger,private.gift_funding_allocations,private.creator_earning_accounts,private.creator_reward_positions,private.creator_reward_ledger,private.purchase_reversal_events,private.creator_reward_liabilities from public,anon,authenticated;

create policy heart_products_read_active on public.heart_products for select to anon,authenticated using(is_active);
create policy gift_catalog_read_active on public.gift_catalog for select to anon,authenticated using(is_active and deleted_at is null);
create policy gift_transactions_read_involved on public.gift_transactions for select to authenticated using(sender_id=(select auth.uid()) or creator_id=(select auth.uid()));
create policy fan_progress_read_involved on public.fan_progress for select to authenticated using(fan_user_id=(select auth.uid()) or creator_id=(select auth.uid()));
create policy fan_memberships_read_involved on public.fan_memberships for select to authenticated using(fan_user_id=(select auth.uid()) or creator_id=(select auth.uid()));
create policy economy_sync_read_owner on public.economy_sync for select to authenticated using(user_id=(select auth.uid()));

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='gift_transactions') then alter publication supabase_realtime add table public.gift_transactions; end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='fan_progress') then alter publication supabase_realtime add table public.fan_progress; end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='fan_memberships') then alter publication supabase_realtime add table public.fan_memberships; end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='economy_sync') then alter publication supabase_realtime add table public.economy_sync; end if;
  end if;
end $$;

comment on function public.send_gift(uuid,uuid,integer,uuid,uuid,uuid) is 'Atomic owner-authorized digital gift operation with row locking, immutable ledgers, 70/30 integer split and Fan progress.';
comment on function public.record_verified_play_purchase(uuid,text,text,text,text,text,boolean,uuid,bytea) is 'Service-role-only entitlement credit after Google Play server verification. Stores only a SHA-256 token hash by default.';
comment on function public.reverse_play_purchase(text,text,uuid,text) is 'Service-role-only refund/revocation processor using purchase-lot attribution and reversal ledger entries.';
