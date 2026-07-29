create or replace function public.send_gift(
  p_creator_id uuid,
  p_gift_id uuid,
  p_quantity integer,
  p_idempotency_key uuid,
  p_conversation_id uuid default null,
  p_client_message_id uuid default null
)
returns table(
  gift_transaction_id uuid,sender_id uuid,creator_id uuid,gift_id uuid,quantity integer,
  gross_heart_units bigint,creator_reward_units bigint,platform_gross_units bigint,
  sender_balance_units bigint,reward_available_at timestamptz,fan_eligible_units bigint,
  fan_threshold_units bigint,fan_status text,message_id uuid,already_processed boolean
)
language plpgsql security definer set search_path='' as $$
declare
  v_sender uuid:=auth.uid();
  v_gift public.gift_catalog%rowtype;
  v_creator public.creator_profiles%rowtype;
  v_existing public.gift_transactions%rowtype;
  v_account private.heart_accounts%rowtype;
  v_creator_account private.creator_earning_accounts%rowtype;
  v_gift_tx public.gift_transactions%rowtype;
  v_progress public.fan_progress%rowtype;
  v_lot private.heart_lots%rowtype;
  v_remaining bigint;
  v_take bigint;
  v_units_per_heart bigint;
  v_creator_bps bigint;
  v_platform_bps bigint;
  v_hold_days bigint;
  v_daily_limit bigint;
  v_daily_used bigint;
  v_gross bigint;
  v_reward bigint;
  v_platform bigint;
  v_available_at timestamptz;
  v_message_id uuid;
  v_fan_status text;
begin
  if v_sender is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if p_idempotency_key is null then raise exception using errcode='22023',message='idempotency_key_required'; end if;
  if p_creator_id is null or p_gift_id is null or p_quantity is null or p_quantity not between 1 and 100 then raise exception using errcode='22023',message='invalid_gift_request'; end if;
  if (p_conversation_id is null)<>(p_client_message_id is null) then raise exception using errcode='22023',message='conversation_and_client_message_id_must_be_paired'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_sender::text||':'||p_idempotency_key::text,0));
  select gt.* into v_existing from public.gift_transactions gt where gt.sender_id=v_sender and gt.idempotency_key=p_idempotency_key;
  if found then
    select fp.* into v_progress from public.fan_progress fp where fp.creator_id=v_existing.creator_id and fp.fan_user_id=v_sender;
    select ha.* into v_account from private.heart_accounts ha where ha.user_id=v_sender;
    select fm.status::text into v_fan_status from public.fan_memberships fm where fm.creator_id=v_existing.creator_id and fm.fan_user_id=v_sender;
    return query select v_existing.id,v_existing.sender_id,v_existing.creator_id,v_existing.gift_id,v_existing.quantity,v_existing.gross_heart_units,v_existing.creator_reward_units,v_existing.platform_gross_units,
      v_account.available_units,(select rp.available_at from private.creator_reward_positions rp where rp.gift_transaction_id=v_existing.id),coalesce(v_progress.eligible_units,0),coalesce(v_progress.threshold_units,0),coalesce(v_fan_status,'none'),v_existing.message_id,true;
    return;
  end if;
  if v_sender=p_creator_id then raise exception using errcode='22023',message='cannot_gift_self'; end if;
  if not private.is_active_adult(v_sender) then raise exception using errcode='42501',message='active_adult_sender_required'; end if;
  select cp.* into v_creator from public.creator_profiles cp where cp.user_id=p_creator_id and cp.creator_status='approved' and cp.approved_at is not null;
  if not found or not private.is_active_adult(p_creator_id) then raise exception using errcode='42501',message='approved_creator_required'; end if;
  if private.users_are_blocked(v_sender,p_creator_id) then raise exception using errcode='42501',message='gifting_blocked'; end if;
  select gc.* into v_gift from public.gift_catalog gc where gc.id=p_gift_id and gc.is_active and gc.deleted_at is null;
  if not found then raise exception using errcode='22023',message='gift_not_active'; end if;
  v_units_per_heart:=private.config_integer('heart_units_per_heart');
  v_creator_bps:=private.config_integer('creator_share_bps');
  v_platform_bps:=private.config_integer('platform_share_bps');
  v_hold_days:=private.config_integer('creator_reward_hold_days');
  if v_units_per_heart<>100 or v_creator_bps is null or v_platform_bps is null or v_creator_bps+v_platform_bps<>10000 then raise exception using errcode='22023',message='heart_economy_config_invalid'; end if;
  if v_hold_days is null or v_hold_days<0 or v_hold_days>365 then raise exception using errcode='22023',message='creator_reward_hold_config_invalid'; end if;
  v_gross:=v_gift.heart_price_units*p_quantity::bigint;
  v_reward:=(v_gross*v_creator_bps)/10000;
  v_platform:=v_gross-v_reward;
  v_available_at:=now()+make_interval(days=>v_hold_days::integer);
  v_daily_limit:=private.optional_config_limit('maximum_daily_gift_units');
  if v_daily_limit is not null then
    select coalesce(sum(g.gross_heart_units-g.reversed_heart_units),0) into v_daily_used from public.gift_transactions g
    where g.sender_id=v_sender and g.created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
    if v_daily_used+v_gross>v_daily_limit then raise exception using errcode='22023',message='daily_gift_limit_exceeded'; end if;
  end if;
  perform private.ensure_economy_accounts(v_sender);
  perform private.ensure_economy_accounts(p_creator_id);
  select ha.* into v_account from private.heart_accounts ha where ha.user_id=v_sender for update;
  select gt.* into v_existing from public.gift_transactions gt where gt.sender_id=v_sender and gt.idempotency_key=p_idempotency_key;
  if found then
    select fp.* into v_progress from public.fan_progress fp where fp.creator_id=v_existing.creator_id and fp.fan_user_id=v_sender;
    select fm.status::text into v_fan_status from public.fan_memberships fm where fm.creator_id=v_existing.creator_id and fm.fan_user_id=v_sender;
    return query select v_existing.id,v_existing.sender_id,v_existing.creator_id,v_existing.gift_id,v_existing.quantity,v_existing.gross_heart_units,v_existing.creator_reward_units,v_existing.platform_gross_units,
      v_account.available_units,(select rp.available_at from private.creator_reward_positions rp where rp.gift_transaction_id=v_existing.id),coalesce(v_progress.eligible_units,0),coalesce(v_progress.threshold_units,0),coalesce(v_fan_status,'none'),v_existing.message_id,true;
    return;
  end if;
  if v_account.available_units<v_gross then raise exception using errcode='22023',message='insufficient_heart_balance'; end if;
  insert into private.creator_earning_accounts(creator_id) values(p_creator_id) on conflict on constraint creator_earning_accounts_pkey do nothing;
  select cea.* into v_creator_account from private.creator_earning_accounts cea where cea.creator_id=p_creator_id for update;
  if v_creator_account.is_frozen then raise exception using errcode='42501',message='creator_reward_account_frozen'; end if;
  insert into public.gift_transactions(
    sender_id,creator_id,gift_id,gift_slug_snapshot,gift_name_vi_snapshot,gift_name_en_snapshot,quantity,unit_heart_units,gross_heart_units,
    creator_share_bps,platform_share_bps,creator_reward_units,platform_gross_units,idempotency_key
  ) values(
    v_sender,p_creator_id,v_gift.id,v_gift.slug,v_gift.name_vi,v_gift.name_en,p_quantity,v_gift.heart_price_units,v_gross,
    v_creator_bps::integer,v_platform_bps::integer,v_reward,v_platform,p_idempotency_key
  ) returning * into v_gift_tx;
  v_remaining:=v_gross;
  for v_lot in select hl.* from private.heart_lots hl where hl.user_id=v_sender and hl.available_units>0 order by hl.created_at,hl.purchase_id for update loop
    exit when v_remaining=0;
    v_take:=least(v_lot.available_units,v_remaining);
    update private.heart_lots hl set available_units=hl.available_units-v_take,spent_units=hl.spent_units+v_take where hl.purchase_id=v_lot.purchase_id;
    insert into private.gift_funding_allocations(gift_transaction_id,purchase_id,allocated_units) values(v_gift_tx.id,v_lot.purchase_id,v_take);
    v_remaining:=v_remaining-v_take;
  end loop;
  if v_remaining<>0 then raise exception using errcode='23514',message='heart_lot_balance_invariant_failed'; end if;
  update private.heart_accounts ha set available_units=ha.available_units-v_gross,lifetime_spent_units=ha.lifetime_spent_units+v_gross,version=ha.version+1
  where ha.user_id=v_sender returning ha.* into v_account;
  insert into private.heart_ledger(user_id,entry_type,amount_units,balance_after_units,reference_type,reference_id,idempotency_key,metadata_json)
  values(v_sender,'gift_debit',-v_gross,v_account.available_units,'gift_transaction',v_gift_tx.id,p_idempotency_key,jsonb_build_object('creator_id',p_creator_id,'gift_id',p_gift_id,'quantity',p_quantity));
  update private.creator_earning_accounts cea set pending_units=cea.pending_units+v_reward,version=cea.version+1
  where cea.creator_id=p_creator_id returning cea.* into v_creator_account;
  insert into private.creator_reward_positions(gift_transaction_id,creator_id,original_units,pending_units,available_at)
  values(v_gift_tx.id,p_creator_id,v_reward,v_reward,v_available_at);
  insert into private.creator_reward_ledger(creator_id,gift_transaction_id,entry_type,amount_units,available_at,reference_type,reference_id,idempotency_key,metadata_json)
  values(p_creator_id,v_gift_tx.id,'gift_reward_pending',v_reward,v_available_at,'gift_transaction',v_gift_tx.id,p_idempotency_key,jsonb_build_object('gross_heart_units',v_gross,'creator_share_bps',v_creator_bps));
  insert into public.fan_progress(creator_id,fan_user_id,lifetime_supported_units,eligible_units,threshold_units)
  values(p_creator_id,v_sender,v_gross,v_gross,greatest(v_creator.fan_threshold_units,1))
  on conflict on constraint fan_progress_pkey do update set
    lifetime_supported_units=public.fan_progress.lifetime_supported_units+excluded.lifetime_supported_units,
    eligible_units=public.fan_progress.eligible_units+excluded.eligible_units,
    threshold_units=excluded.threshold_units
  returning * into v_progress;
  if v_progress.eligible_units>=v_progress.threshold_units then
    insert into public.fan_memberships(creator_id,fan_user_id,achieved_at,status)
    values(p_creator_id,v_sender,now(),'active')
    on conflict on constraint fan_memberships_pkey do update set status='active',revoked_at=null,achieved_at=case when public.fan_memberships.status='revoked' then now() else public.fan_memberships.achieved_at end;
    v_fan_status:='active';
  else v_fan_status:='none'; end if;
  if p_conversation_id is not null then
    if not exists(
      select 1 from public.conversations c join public.friendships f on f.id=c.friendship_id
      where c.id=p_conversation_id and f.status='accepted' and ((f.requester_id=v_sender and f.addressee_id=p_creator_id) or (f.requester_id=p_creator_id and f.addressee_id=v_sender))
    ) then raise exception using errcode='42501',message='accepted_creator_friendship_conversation_required'; end if;
    insert into public.messages(conversation_id,sender_id,message_type,body,gift_transaction_id,client_message_id,moderation_status)
    values(p_conversation_id,v_sender,'gift',null,v_gift_tx.id,p_client_message_id,'approved') returning id into v_message_id;
    update public.gift_transactions gt set message_id=v_message_id where gt.id=v_gift_tx.id returning gt.* into v_gift_tx;
  end if;
  update public.economy_sync es set heart_account_version=v_account.version,updated_at=now() where es.user_id=v_sender;
  update public.economy_sync es set creator_account_version=v_creator_account.version,updated_at=now() where es.user_id=p_creator_id;
  return query select v_gift_tx.id,v_sender,p_creator_id,v_gift.id,p_quantity,v_gross,v_reward,v_platform,v_account.available_units,v_available_at,v_progress.eligible_units,v_progress.threshold_units,v_fan_status,v_message_id,false;
end $$;
revoke all on function public.send_gift(uuid,uuid,integer,uuid,uuid,uuid) from public,anon;
grant execute on function public.send_gift(uuid,uuid,integer,uuid,uuid,uuid) to authenticated,service_role;

create or replace function public.release_due_creator_rewards(p_limit integer default 500)
returns table(released_positions integer,released_units bigint)
language plpgsql security definer set search_path='' as $$
declare
  v_position private.creator_reward_positions%rowtype;
  v_account private.creator_earning_accounts%rowtype;
  v_count integer:=0;
  v_units bigint:=0;
  v_amount bigint;
begin
  for v_position in
    select rp.* from private.creator_reward_positions rp join public.creator_profiles cp on cp.user_id=rp.creator_id
    where rp.pending_units>0 and rp.available_at<=now() and cp.creator_status='approved' and cp.payout_eligible
      and exists(select 1 from public.gift_transactions g where g.id=rp.gift_transaction_id and g.status<>'reversed')
    order by rp.available_at,rp.gift_transaction_id limit least(greatest(coalesce(p_limit,500),1),5000) for update of rp skip locked
  loop
    select cea.* into v_account from private.creator_earning_accounts cea where cea.creator_id=v_position.creator_id for update;
    if v_account.is_frozen then continue; end if;
    v_amount:=v_position.pending_units;
    update private.creator_reward_positions rp set pending_units=0,available_units=rp.available_units+v_amount,status=case when rp.reversed_units>0 then 'partially_reversed'::private.reward_position_status else 'available'::private.reward_position_status end
    where rp.gift_transaction_id=v_position.gift_transaction_id;
    update private.creator_earning_accounts cea set pending_units=cea.pending_units-v_amount,available_units=cea.available_units+v_amount,version=cea.version+1
    where cea.creator_id=v_position.creator_id returning cea.* into v_account;
    insert into private.creator_reward_ledger(creator_id,gift_transaction_id,entry_type,amount_units,available_at,reference_type,reference_id,idempotency_key,metadata_json)
    values(v_position.creator_id,v_position.gift_transaction_id,'reward_released',v_amount,now(),'gift_transaction',v_position.gift_transaction_id,extensions.gen_random_uuid(),'{}');
    update public.economy_sync es set creator_account_version=v_account.version,updated_at=now() where es.user_id=v_position.creator_id;
    v_count:=v_count+1; v_units:=v_units+v_amount;
  end loop;
  return query select v_count,v_units;
end $$;
revoke all on function public.release_due_creator_rewards(integer) from public,anon,authenticated;
grant execute on function public.release_due_creator_rewards(integer) to service_role;
