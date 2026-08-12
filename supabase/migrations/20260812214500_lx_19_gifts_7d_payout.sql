-- LX-19 — Luxy member gifts + 7-day reward availability.
--
-- Product contract:
-- - Reuse the existing 20-gift catalog and immutable heart/reward ledgers.
-- - Premium and Diamond may send gifts; Free may not.
-- - Any active adult Luxy member may receive a gift. Legacy `creator_*` column/table names
--   are retained as internal compatibility names only; they no longer imply a public Creator role.
-- - Recipient reward remains 70%; platform gross remains 30%, snapshotted on each transaction.
-- - New gift rewards are pending for exactly 7 days before they can become available to withdraw.
-- - Gifts never unlock private photos, create a relationship, or require a reply.
-- - Gift send is atomic and idempotent. A gift message may be attached to an LX-15 direct conversation.

insert into private.app_config(key,value_json,value_type,description,is_public)
values
  ('luxy_member_gifts_enabled','true'::jsonb,'boolean','Enable LX-19 Premium/Diamond member-to-member digital gifts.',false),
  ('luxy_gift_reward_hold_days','7'::jsonb,'integer','LX-19 days from gift receipt until recipient reward can become available to withdraw.',false),
  ('creator_reward_hold_days','7'::jsonb,'integer','Compatibility value aligned to the LX-19 seven-day gift reward hold.',false)
on conflict(key) do update
set value_json=excluded.value_json,
    value_type=excluded.value_type,
    description=excluded.description,
    is_public=excluded.is_public,
    updated_at=now();

-- Recipient accounting is now a member capability. Keep legacy table/column names to avoid
-- a risky financial-ledger rename, but point their identity FKs at profiles instead of Creator status.
alter table private.creator_earning_accounts drop constraint if exists creator_earning_accounts_creator_id_fkey;
alter table private.creator_earning_accounts
  add constraint creator_earning_accounts_creator_id_fkey foreign key(creator_id) references public.profiles(id) on delete restrict;

alter table private.creator_reward_positions drop constraint if exists creator_reward_positions_creator_id_fkey;
alter table private.creator_reward_positions
  add constraint creator_reward_positions_creator_id_fkey foreign key(creator_id) references public.profiles(id) on delete restrict;

alter table private.creator_reward_ledger drop constraint if exists creator_reward_ledger_creator_id_fkey;
alter table private.creator_reward_ledger
  add constraint creator_reward_ledger_creator_id_fkey foreign key(creator_id) references public.profiles(id) on delete restrict;

alter table private.creator_reward_liabilities drop constraint if exists creator_reward_liabilities_creator_id_fkey;
alter table private.creator_reward_liabilities
  add constraint creator_reward_liabilities_creator_id_fkey foreign key(creator_id) references public.profiles(id) on delete restrict;

-- Prepare the existing encrypted KYC/bank/withdrawal infrastructure for member recipients.
-- LX-20 owns the public verification UX; LX-19 does not bypass KYC or bank verification.
alter table private.kyc_profiles drop constraint if exists kyc_profiles_user_id_fkey;
alter table private.kyc_profiles
  add constraint kyc_profiles_user_id_fkey foreign key(user_id) references public.profiles(id) on delete restrict;

alter table private.bank_accounts drop constraint if exists bank_accounts_user_id_fkey;
alter table private.bank_accounts
  add constraint bank_accounts_user_id_fkey foreign key(user_id) references public.profiles(id) on delete restrict;

alter table private.withdrawals drop constraint if exists withdrawals_creator_id_fkey;
alter table private.withdrawals
  add constraint withdrawals_creator_id_fkey foreign key(creator_id) references public.profiles(id) on delete restrict;

create or replace function private.ensure_economy_accounts(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_user_id is null then raise exception using errcode='22023',message='user_id_required'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_user_id) then
    raise exception using errcode='P0002',message='profile_not_found';
  end if;
  insert into private.heart_accounts(user_id) values(p_user_id) on conflict(user_id) do nothing;
  insert into private.creator_earning_accounts(creator_id) values(p_user_id) on conflict(creator_id) do nothing;
  insert into public.economy_sync(user_id) values(p_user_id) on conflict(user_id) do nothing;
end;
$$;
revoke all on function private.ensure_economy_accounts(uuid) from public,anon,authenticated;
grant execute on function private.ensure_economy_accounts(uuid) to service_role;

insert into private.creator_earning_accounts(creator_id)
select p.id from public.profiles p
on conflict(creator_id) do nothing;

create or replace function private.luxy_member_gifts_enabled()
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(private.config_boolean('luxy_member_gifts_enabled'),false)
$$;
revoke all on function private.luxy_member_gifts_enabled() from public,anon,authenticated;
grant execute on function private.luxy_member_gifts_enabled() to service_role;

create or replace function private.luxy_gift_hold_days()
returns integer
language sql
stable
security definer
set search_path=''
as $$
  select least(greatest(coalesce(private.config_integer('luxy_gift_reward_hold_days'),7),1),30)::integer
$$;
revoke all on function private.luxy_gift_hold_days() from public,anon,authenticated;
grant execute on function private.luxy_gift_hold_days() to service_role;

create or replace function private.can_send_luxy_gift(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(private.luxy_member_gifts_enabled(),false)
    and private.is_active_adult(p_user_id)
    and private.has_active_luxy_paid_membership(p_user_id)
$$;
revoke all on function private.can_send_luxy_gift(uuid) from public,anon,authenticated;
grant execute on function private.can_send_luxy_gift(uuid) to service_role;

create or replace function public.send_luxy_gift(
  p_recipient_id uuid,
  p_gift_id uuid,
  p_quantity integer,
  p_idempotency_key uuid,
  p_conversation_id uuid default null,
  p_client_message_id uuid default null
)
returns table(
  gift_transaction_id uuid,
  sender_id uuid,
  recipient_id uuid,
  gift_id uuid,
  quantity integer,
  gross_heart_units bigint,
  recipient_reward_units bigint,
  platform_gross_units bigint,
  sender_balance_units bigint,
  reward_available_at timestamptz,
  message_id uuid,
  already_processed boolean
)
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_sender uuid:=auth.uid();
  v_gift public.gift_catalog%rowtype;
  v_existing public.gift_transactions%rowtype;
  v_account private.heart_accounts%rowtype;
  v_recipient_account private.creator_earning_accounts%rowtype;
  v_gift_tx public.gift_transactions%rowtype;
  v_lot private.heart_lots%rowtype;
  v_remaining bigint;
  v_take bigint;
  v_creator_bps bigint;
  v_platform_bps bigint;
  v_daily_limit bigint;
  v_daily_used bigint;
  v_gross bigint;
  v_reward bigint;
  v_platform bigint;
  v_available_at timestamptz;
  v_message_id uuid;
begin
  if v_sender is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if p_idempotency_key is null then raise exception using errcode='22023',message='idempotency_key_required'; end if;
  if p_recipient_id is null or p_gift_id is null or p_quantity is null or p_quantity not between 1 and 100 then
    raise exception using errcode='22023',message='invalid_gift_request';
  end if;
  if (p_conversation_id is null)<>(p_client_message_id is null) then
    raise exception using errcode='22023',message='conversation_and_client_message_id_must_be_paired';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_sender::text||':'||p_idempotency_key::text,0));

  select gt.* into v_existing
  from public.gift_transactions gt
  where gt.sender_id=v_sender and gt.idempotency_key=p_idempotency_key;
  if found then
    select ha.* into v_account from private.heart_accounts ha where ha.user_id=v_sender;
    return query select
      v_existing.id,v_existing.sender_id,v_existing.creator_id,v_existing.gift_id,v_existing.quantity,
      v_existing.gross_heart_units,v_existing.creator_reward_units,v_existing.platform_gross_units,
      coalesce(v_account.available_units,0),
      (select rp.available_at from private.creator_reward_positions rp where rp.gift_transaction_id=v_existing.id),
      v_existing.message_id,true;
    return;
  end if;

  if not private.can_send_luxy_gift(v_sender) then
    raise exception using errcode='42501',message='premium_membership_required_for_gifting';
  end if;
  if v_sender=p_recipient_id then raise exception using errcode='22023',message='cannot_gift_self'; end if;
  if private.users_are_blocked(v_sender,p_recipient_id) then
    raise exception using errcode='42501',message='gifting_blocked';
  end if;
  if not private.is_active_adult(p_recipient_id)
    or not exists(
      select 1 from public.profiles p
      where p.id=p_recipient_id and p.profile_status='active' and p.deleted_at is null
    ) then
    raise exception using errcode='42501',message='gift_recipient_not_available';
  end if;

  select gc.* into v_gift
  from public.gift_catalog gc
  where gc.id=p_gift_id and gc.is_active and gc.deleted_at is null;
  if not found then raise exception using errcode='22023',message='gift_not_active'; end if;

  v_creator_bps:=coalesce(private.config_integer('creator_share_bps'),7000);
  v_platform_bps:=coalesce(private.config_integer('platform_share_bps'),3000);
  if v_creator_bps<0 or v_platform_bps<0 or v_creator_bps+v_platform_bps<>10000 then
    raise exception using errcode='55000',message='gift_share_config_invalid';
  end if;

  v_gross:=v_gift.heart_price_units*p_quantity::bigint;
  v_reward:=(v_gross*v_creator_bps)/10000;
  v_platform:=v_gross-v_reward;
  v_available_at:=now()+make_interval(days=>private.luxy_gift_hold_days());

  v_daily_limit:=private.optional_config_limit('maximum_daily_gift_units');
  if v_daily_limit is not null then
    select coalesce(sum(g.gross_heart_units-g.reversed_heart_units),0) into v_daily_used
    from public.gift_transactions g
    where g.sender_id=v_sender
      and g.created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
    if v_daily_used+v_gross>v_daily_limit then
      raise exception using errcode='22023',message='daily_gift_limit_exceeded';
    end if;
  end if;

  perform private.ensure_economy_accounts(v_sender);
  perform private.ensure_economy_accounts(p_recipient_id);
  select ha.* into v_account from private.heart_accounts ha where ha.user_id=v_sender for update;
  if v_account.available_units<v_gross then raise exception using errcode='22023',message='insufficient_heart_balance'; end if;

  select cea.* into v_recipient_account
  from private.creator_earning_accounts cea
  where cea.creator_id=p_recipient_id
  for update;
  if v_recipient_account.is_frozen then
    raise exception using errcode='42501',message='recipient_reward_account_frozen';
  end if;

  insert into public.gift_transactions(
    sender_id,creator_id,gift_id,gift_slug_snapshot,gift_name_vi_snapshot,gift_name_en_snapshot,
    quantity,unit_heart_units,gross_heart_units,creator_share_bps,platform_share_bps,
    creator_reward_units,platform_gross_units,idempotency_key
  ) values(
    v_sender,p_recipient_id,v_gift.id,v_gift.slug,v_gift.name_vi,v_gift.name_en,
    p_quantity,v_gift.heart_price_units,v_gross,v_creator_bps::integer,v_platform_bps::integer,
    v_reward,v_platform,p_idempotency_key
  ) returning * into v_gift_tx;

  v_remaining:=v_gross;
  for v_lot in
    select hl.* from private.heart_lots hl
    where hl.user_id=v_sender and hl.available_units>0
    order by hl.created_at,hl.purchase_id
    for update
  loop
    exit when v_remaining=0;
    v_take:=least(v_lot.available_units,v_remaining);
    update private.heart_lots hl
    set available_units=hl.available_units-v_take,
        spent_units=hl.spent_units+v_take
    where hl.purchase_id=v_lot.purchase_id;
    insert into private.gift_funding_allocations(gift_transaction_id,purchase_id,allocated_units)
    values(v_gift_tx.id,v_lot.purchase_id,v_take);
    v_remaining:=v_remaining-v_take;
  end loop;
  if v_remaining<>0 then raise exception using errcode='23514',message='heart_lot_balance_invariant_failed'; end if;

  update private.heart_accounts ha
  set available_units=ha.available_units-v_gross,
      lifetime_spent_units=ha.lifetime_spent_units+v_gross,
      version=ha.version+1
  where ha.user_id=v_sender
  returning ha.* into v_account;

  insert into private.heart_ledger(
    user_id,entry_type,amount_units,balance_after_units,reference_type,reference_id,idempotency_key,metadata_json
  ) values(
    v_sender,'gift_debit',-v_gross,v_account.available_units,'gift_transaction',v_gift_tx.id,p_idempotency_key,
    jsonb_build_object('recipient_id',p_recipient_id,'gift_id',p_gift_id,'quantity',p_quantity,'luxy_gift',true)
  );

  update private.creator_earning_accounts cea
  set pending_units=cea.pending_units+v_reward,
      version=cea.version+1
  where cea.creator_id=p_recipient_id
  returning cea.* into v_recipient_account;

  insert into private.creator_reward_positions(
    gift_transaction_id,creator_id,original_units,pending_units,available_at
  ) values(v_gift_tx.id,p_recipient_id,v_reward,v_reward,v_available_at);

  insert into private.creator_reward_ledger(
    creator_id,gift_transaction_id,entry_type,amount_units,available_at,reference_type,reference_id,idempotency_key,metadata_json
  ) values(
    p_recipient_id,v_gift_tx.id,'gift_reward_pending',v_reward,v_available_at,'gift_transaction',v_gift_tx.id,
    extensions.gen_random_uuid(),jsonb_build_object('gross_heart_units',v_gross,'recipient_share_bps',v_creator_bps,'luxy_gift',true)
  );

  if p_conversation_id is not null then
    if not exists(
      select 1 from public.conversations c
      where c.id=p_conversation_id
        and c.direct_member_low_id=least(v_sender,p_recipient_id)
        and c.direct_member_high_id=greatest(v_sender,p_recipient_id)
        and private.is_conversation_member(c.id,v_sender)
        and private.is_conversation_member(c.id,p_recipient_id)
    ) then
      raise exception using errcode='42501',message='luxy_direct_conversation_required';
    end if;

    insert into public.messages(
      conversation_id,sender_id,message_type,body,gift_transaction_id,client_message_id,moderation_status
    ) values(
      p_conversation_id,v_sender,'gift',null,v_gift_tx.id,p_client_message_id,'approved'
    ) returning id into v_message_id;

    update public.gift_transactions gt
    set message_id=v_message_id
    where gt.id=v_gift_tx.id
    returning gt.* into v_gift_tx;
  end if;

  update public.economy_sync es
  set heart_account_version=v_account.version,updated_at=now()
  where es.user_id=v_sender;
  update public.economy_sync es
  set creator_account_version=v_recipient_account.version,updated_at=now()
  where es.user_id=p_recipient_id;

  return query select
    v_gift_tx.id,v_sender,p_recipient_id,v_gift.id,p_quantity,v_gross,v_reward,v_platform,
    v_account.available_units,v_available_at,v_message_id,false;
end;
$$;
revoke all on function public.send_luxy_gift(uuid,uuid,integer,uuid,uuid,uuid) from public,anon;
grant execute on function public.send_luxy_gift(uuid,uuid,integer,uuid,uuid,uuid) to authenticated,service_role;

create or replace function private.release_due_luxy_rewards_for(p_user_id uuid,p_limit integer default 500)
returns table(released_positions integer,released_units bigint)
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_position private.creator_reward_positions%rowtype;
  v_account private.creator_earning_accounts%rowtype;
  v_count integer:=0;
  v_units bigint:=0;
  v_amount bigint;
begin
  if p_user_id is null then raise exception using errcode='22023',message='user_id_required'; end if;
  perform private.ensure_economy_accounts(p_user_id);

  select cea.* into v_account
  from private.creator_earning_accounts cea
  where cea.creator_id=p_user_id
  for update;
  if v_account.is_frozen then return query select 0,0::bigint; return; end if;

  for v_position in
    select rp.*
    from private.creator_reward_positions rp
    join public.gift_transactions g on g.id=rp.gift_transaction_id
    where rp.creator_id=p_user_id
      and rp.pending_units>0
      and rp.available_at<=now()
      and g.status<>'reversed'
    order by rp.available_at,rp.gift_transaction_id
    limit least(greatest(coalesce(p_limit,500),1),5000)
    for update of rp skip locked
  loop
    v_amount:=v_position.pending_units;
    update private.creator_reward_positions rp
    set pending_units=0,
        available_units=rp.available_units+v_amount,
        status=private.reward_position_status_for(
          rp.original_units,0,rp.available_units+v_amount,rp.held_units,rp.paid_units,rp.reversed_units
        )
    where rp.gift_transaction_id=v_position.gift_transaction_id;

    update private.creator_earning_accounts cea
    set pending_units=cea.pending_units-v_amount,
        available_units=cea.available_units+v_amount,
        version=cea.version+1
    where cea.creator_id=p_user_id
    returning cea.* into v_account;

    insert into private.creator_reward_ledger(
      creator_id,gift_transaction_id,entry_type,amount_units,available_at,reference_type,reference_id,idempotency_key,metadata_json
    ) values(
      p_user_id,v_position.gift_transaction_id,'reward_released',v_amount,now(),'gift_transaction',v_position.gift_transaction_id,
      extensions.gen_random_uuid(),jsonb_build_object('luxy_gift',true,'hold_days',private.luxy_gift_hold_days())
    );

    v_count:=v_count+1;
    v_units:=v_units+v_amount;
  end loop;

  if v_count>0 then
    update public.economy_sync es
    set creator_account_version=v_account.version,updated_at=now()
    where es.user_id=p_user_id;
  end if;
  return query select v_count,v_units;
end;
$$;
revoke all on function private.release_due_luxy_rewards_for(uuid,integer) from public,anon,authenticated;
grant execute on function private.release_due_luxy_rewards_for(uuid,integer) to service_role;

-- Preserve the legacy service-role cron entry point but release due rewards for any Luxy member recipient.
create or replace function public.release_due_creator_rewards(p_limit integer default 500)
returns table(released_positions integer,released_units bigint)
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_user_id uuid;
  v_result record;
  v_count integer:=0;
  v_units bigint:=0;
begin
  for v_user_id in
    select distinct rp.creator_id
    from private.creator_reward_positions rp
    join public.gift_transactions g on g.id=rp.gift_transaction_id
    where rp.pending_units>0 and rp.available_at<=now() and g.status<>'reversed'
    order by rp.creator_id
    limit least(greatest(coalesce(p_limit,500),1),5000)
  loop
    select * into v_result from private.release_due_luxy_rewards_for(v_user_id,p_limit);
    v_count:=v_count+coalesce(v_result.released_positions,0);
    v_units:=v_units+coalesce(v_result.released_units,0);
  end loop;
  return query select v_count,v_units;
end;
$$;
revoke all on function public.release_due_creator_rewards(integer) from public,anon,authenticated;
grant execute on function public.release_due_creator_rewards(integer) to service_role;

create or replace function public.get_my_luxy_gift_wallet()
returns table(
  can_gift boolean,
  heart_available_units bigint,
  reward_pending_units bigint,
  reward_available_units bigint,
  reward_held_units bigint,
  reward_paid_units bigint,
  reward_reversed_units bigint,
  reward_frozen boolean,
  reward_hold_days integer,
  recipient_share_bps integer,
  platform_share_bps integer,
  minimum_withdrawal_units bigint,
  kyc_approved boolean,
  verified_bank_available boolean,
  withdrawal_ready boolean
)
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_heart private.heart_accounts%rowtype;
  v_reward private.creator_earning_accounts%rowtype;
  v_minimum bigint;
  v_kyc boolean;
  v_bank boolean;
  v_hold boolean;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;

  perform private.ensure_economy_accounts(v_user_id);
  perform private.release_due_luxy_rewards_for(v_user_id,500);

  select * into strict v_heart from private.heart_accounts where user_id=v_user_id;
  select * into strict v_reward from private.creator_earning_accounts where creator_id=v_user_id;
  v_minimum:=coalesce(private.config_integer('minimum_withdrawal_units'),1000);
  v_kyc:=exists(
    select 1 from private.kyc_profiles kp
    where kp.user_id=v_user_id and kp.status='approved' and (kp.expires_at is null or kp.expires_at>now())
  );
  v_bank:=exists(
    select 1 from private.bank_accounts ba
    where ba.user_id=v_user_id and ba.status='verified' and ba.deleted_at is null
  );
  v_hold:=private.has_active_financial_hold(v_user_id);

  return query select
    private.can_send_luxy_gift(v_user_id),
    v_heart.available_units,
    v_reward.pending_units,
    v_reward.available_units,
    v_reward.held_units,
    v_reward.paid_units,
    v_reward.reversed_units,
    v_reward.is_frozen,
    private.luxy_gift_hold_days(),
    coalesce(private.config_integer('creator_share_bps'),7000)::integer,
    coalesce(private.config_integer('platform_share_bps'),3000)::integer,
    v_minimum,
    v_kyc,
    v_bank,
    (v_kyc and v_bank and not v_hold and not v_reward.is_frozen and v_reward.available_units>=v_minimum);
end;
$$;
revoke all on function public.get_my_luxy_gift_wallet() from public,anon;
grant execute on function public.get_my_luxy_gift_wallet() to authenticated,service_role;

create or replace function public.list_my_luxy_gifts(
  p_direction text default 'received',
  p_limit integer default 30,
  p_offset integer default 0
)
returns table(
  gift_transaction_id uuid,
  direction text,
  other_user_id uuid,
  other_username text,
  other_display_name text,
  gift_slug text,
  gift_name_vi text,
  gift_icon_emoji text,
  quantity integer,
  gross_heart_units bigint,
  recipient_reward_units bigint,
  reward_available_at timestamptz,
  status text,
  message_id uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_direction text:=lower(btrim(coalesce(p_direction,'')));
  v_limit integer:=least(greatest(coalesce(p_limit,30),1),50);
  v_offset integer:=least(greatest(coalesce(p_offset,0),0),500);
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if v_direction not in ('received','sent') then raise exception using errcode='22023',message='invalid_gift_direction'; end if;

  return query
  select
    g.id,
    v_direction,
    case when v_direction='received' then g.sender_id else g.creator_id end,
    case when private.users_are_blocked(v_user_id,case when v_direction='received' then g.sender_id else g.creator_id end)
      then null else p.username::text end,
    case when private.users_are_blocked(v_user_id,case when v_direction='received' then g.sender_id else g.creator_id end)
      then 'Tài khoản không khả dụng' else p.display_name end,
    g.gift_slug_snapshot,
    g.gift_name_vi_snapshot,
    gc.icon_emoji,
    g.quantity,
    g.gross_heart_units,
    g.creator_reward_units,
    rp.available_at,
    g.status::text,
    g.message_id,
    g.created_at
  from public.gift_transactions g
  join public.profiles p on p.id=case when v_direction='received' then g.sender_id else g.creator_id end
  left join public.gift_catalog gc on gc.id=g.gift_id
  left join private.creator_reward_positions rp on rp.gift_transaction_id=g.id
  where (v_direction='received' and g.creator_id=v_user_id)
     or (v_direction='sent' and g.sender_id=v_user_id)
  order by g.created_at desc,g.id desc
  limit v_limit offset v_offset;
end;
$$;
revoke all on function public.list_my_luxy_gifts(text,integer,integer) from public,anon;
grant execute on function public.list_my_luxy_gifts(text,integer,integer) to authenticated,service_role;

-- LX-17 entitlement snapshot: both paid tiers may use the heart/gift economy.
create or replace function public.get_my_luxy_membership_snapshot()
returns table(
  tier public.luxy_membership_tier,
  can_message boolean,
  can_favorite boolean,
  can_request_private_photo boolean,
  can_full_search boolean,
  can_unlimited_likes boolean,
  can_hide_online boolean,
  can_hide_from_listing boolean,
  can_use_hearts boolean,
  visibility_priority integer,
  heart_balance_units bigint,
  status text,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_tier public.luxy_membership_tier;
  v_paid boolean;
  v_balance bigint:=0;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  v_tier:=private.get_active_luxy_membership_tier(v_user_id);
  v_paid:=v_tier in ('premium','diamond');
  if v_paid then
    perform private.ensure_economy_accounts(v_user_id);
    select coalesce(a.available_units,0) into v_balance from private.heart_accounts a where a.user_id=v_user_id;
  end if;
  return query
  select
    v_tier,
    private.can_message_with_luxy_membership(v_user_id),
    v_paid,
    v_paid,
    v_paid,
    v_paid,
    v_paid,
    (v_tier='diamond'),
    v_paid,
    private.luxy_visibility_priority(v_user_id),
    coalesce(v_balance,0),
    case when v_tier='free' then 'free' else 'active' end,
    case when v_tier='free' then null else m.expires_at end
  from (select 1) seed
  left join private.luxy_memberships m
    on m.user_id=v_user_id and m.status='active' and m.tier=v_tier and m.expires_at>now();
end;
$$;
revoke all on function public.get_my_luxy_membership_snapshot() from public,anon;
grant execute on function public.get_my_luxy_membership_snapshot() to authenticated,service_role;

-- Withdrawal remains KYC + verified-bank + hold gated, but no longer requires a public Creator role.
create or replace function public.request_withdrawal(
  p_bank_account_id uuid,
  p_requested_reward_units bigint,
  p_idempotency_key uuid
)
returns table(withdrawal_id uuid,status text,requested_reward_units bigint,amount_vnd bigint,held_balance_units bigint,already_processed boolean)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_existing private.withdrawals%rowtype;
  v_bank private.bank_accounts%rowtype;
  v_account private.creator_earning_accounts%rowtype;
  v_position private.creator_reward_positions%rowtype;
  v_withdrawal private.withdrawals%rowtype;
  v_minimum bigint;
  v_rate bigint;
  v_units_per_heart bigint;
  v_remaining bigint;
  v_take bigint;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if p_idempotency_key is null or p_requested_reward_units is null or p_requested_reward_units<=0 then
    raise exception using errcode='22023',message='invalid_withdrawal_request';
  end if;

  select * into v_existing from private.withdrawals
  where creator_id=v_user_id and idempotency_key=p_idempotency_key;
  if found then
    select * into v_account from private.creator_earning_accounts where creator_id=v_user_id;
    return query select v_existing.id,v_existing.status::text,v_existing.requested_reward_units,
      v_existing.amount_vnd,coalesce(v_account.held_units,0),true;
    return;
  end if;

  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  perform private.ensure_economy_accounts(v_user_id);
  perform private.release_due_luxy_rewards_for(v_user_id,500);

  if not exists(
    select 1 from private.kyc_profiles kp
    where kp.user_id=v_user_id and kp.status='approved' and (kp.expires_at is null or kp.expires_at>now())
  ) then raise exception using errcode='42501',message='approved_kyc_required'; end if;

  select * into v_bank from private.bank_accounts
  where id=p_bank_account_id and user_id=v_user_id and status='verified' and deleted_at is null
  for update;
  if not found then raise exception using errcode='42501',message='verified_bank_account_required'; end if;
  if private.has_active_financial_hold(v_user_id) then raise exception using errcode='42501',message='withdrawal_blocked_by_hold'; end if;

  v_minimum:=coalesce(private.config_integer('minimum_withdrawal_units'),1000);
  v_rate:=private.config_integer('heart_vnd_rate');
  v_units_per_heart:=private.config_integer('heart_units_per_heart');
  if v_rate is null or v_units_per_heart is null or v_rate<=0 or v_units_per_heart<=0 then
    raise exception using errcode='55000',message='withdrawal_configuration_invalid';
  end if;
  if p_requested_reward_units<v_minimum then raise exception using errcode='22023',message='withdrawal_below_minimum'; end if;

  select * into v_account from private.creator_earning_accounts where creator_id=v_user_id for update;
  if not found or v_account.is_frozen then raise exception using errcode='42501',message='recipient_earning_account_unavailable'; end if;
  if v_account.available_units<p_requested_reward_units then
    raise exception using errcode='22023',message='insufficient_recipient_available_balance';
  end if;

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
    order by rp.available_at,rp.gift_transaction_id
    for update
  loop
    v_take:=least(v_position.available_units,v_remaining);
    update private.creator_reward_positions
    set available_units=available_units-v_take,
        held_units=held_units+v_take,
        status=private.reward_position_status_for(
          original_units,pending_units,available_units-v_take,held_units+v_take,paid_units,reversed_units
        )
    where gift_transaction_id=v_position.gift_transaction_id;
    insert into private.withdrawal_reward_allocations(withdrawal_id,gift_transaction_id,allocated_units)
    values(v_withdrawal.id,v_position.gift_transaction_id,v_take);
    v_remaining:=v_remaining-v_take;
    exit when v_remaining=0;
  end loop;
  if v_remaining<>0 then raise exception using errcode='23514',message='recipient_reward_position_balance_mismatch'; end if;

  update private.creator_earning_accounts
  set available_units=available_units-p_requested_reward_units,
      held_units=held_units+p_requested_reward_units,
      version=version+1
  where creator_id=v_user_id
  returning * into v_account;

  insert into private.creator_reward_ledger(
    creator_id,entry_type,amount_units,available_at,reference_type,reference_id,idempotency_key,metadata_json
  ) values(
    v_user_id,'withdrawal_hold',p_requested_reward_units,now(),'withdrawal',v_withdrawal.id,p_idempotency_key,
    jsonb_build_object('status','pending','bank_code',v_bank.bank_code,'bank_last4',v_bank.account_number_last4,'amount_vnd',v_withdrawal.amount_vnd,'luxy_member',true)
  );
  update public.economy_sync set creator_account_version=v_account.version,updated_at=now() where user_id=v_user_id;
  perform private.append_admin_audit(v_user_id,'user','withdrawal_requested','withdrawal',v_withdrawal.id,'{}'::jsonb,
    jsonb_build_object('status','pending','reward_units',p_requested_reward_units,'amount_vnd',v_withdrawal.amount_vnd,'bank_code',v_bank.bank_code,'bank_last4',v_bank.account_number_last4),
    null,p_idempotency_key,null,null);
  perform private.bump_payout_sync(v_user_id,false,false,true,false);
  return query select v_withdrawal.id,v_withdrawal.status::text,v_withdrawal.requested_reward_units,
    v_withdrawal.amount_vnd,v_account.held_units,false;
end;
$$;
revoke all on function public.request_withdrawal(uuid,bigint,uuid) from public,anon;
grant execute on function public.request_withdrawal(uuid,bigint,uuid) to authenticated,service_role;

comment on function public.send_luxy_gift(uuid,uuid,integer,uuid,uuid,uuid) is
  'LX-19: Premium/Diamond member gift send using the existing 20-gift catalog and immutable 70/30 ledger; private-photo and relationship entitlements are unaffected.';
comment on function public.get_my_luxy_gift_wallet() is
  'LX-19: caller-owned heart and recipient reward summary; due rewards are lazily released after the exact seven-day hold.';
comment on function public.list_my_luxy_gifts(text,integer,integer) is
  'LX-19: caller-owned sent/received gift history using transaction snapshots plus the current safe gift icon.';
