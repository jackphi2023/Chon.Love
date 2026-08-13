-- LX-19 — Durable per-user gift receipt log.
--
-- `public.gift_transactions` remains the canonical ledger. We intentionally do not create a
-- second mutable log table because duplicating financial events would create reconciliation risk.
-- Every gift transaction already persists sender, recipient, gift snapshots, quantity, unit value,
-- gross value, split, status, reversal amounts and timestamps. This RPC exposes the recipient-owned
-- audit view with an efficient `(creator_id, created_at desc, id)` index already present.

create or replace function public.list_my_received_gift_log(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table(
  gift_transaction_id uuid,
  sender_id uuid,
  sender_username text,
  sender_display_name text,
  gift_id uuid,
  gift_slug text,
  gift_name_vi text,
  gift_name_en text,
  gift_icon_emoji text,
  quantity integer,
  unit_heart_units bigint,
  gross_heart_units bigint,
  recipient_reward_units bigint,
  platform_gross_units bigint,
  reversed_heart_units bigint,
  net_heart_units bigint,
  reward_available_at timestamptz,
  status text,
  message_id uuid,
  received_at timestamptz,
  completed_at timestamptz,
  reversed_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_limit integer:=least(greatest(coalesce(p_limit,50),1),100);
  v_offset integer:=least(greatest(coalesce(p_offset,0),0),5000);
begin
  if v_user_id is null then
    raise exception using errcode='28000',message='authentication_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode='42501',message='active_adult_account_required';
  end if;

  return query
  select
    g.id,
    g.sender_id,
    p.username::text,
    p.display_name,
    g.gift_id,
    g.gift_slug_snapshot,
    g.gift_name_vi_snapshot,
    g.gift_name_en_snapshot,
    gc.icon_emoji,
    g.quantity,
    g.unit_heart_units,
    g.gross_heart_units,
    g.creator_reward_units,
    g.platform_gross_units,
    g.reversed_heart_units,
    greatest(g.gross_heart_units-g.reversed_heart_units,0),
    rp.available_at,
    g.status::text,
    g.message_id,
    g.created_at,
    g.completed_at,
    g.reversed_at
  from public.gift_transactions g
  join public.profiles p on p.id=g.sender_id
  left join public.gift_catalog gc on gc.id=g.gift_id
  left join private.creator_reward_positions rp on rp.gift_transaction_id=g.id
  where g.creator_id=v_user_id
  order by g.created_at desc,g.id desc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.list_my_received_gift_log(integer,integer) from public,anon;
grant execute on function public.list_my_received_gift_log(integer,integer) to authenticated,service_role;

comment on function public.list_my_received_gift_log(integer,integer) is
  'LX-19 recipient-owned durable gift receipt log: timestamp, gift snapshot, sender, gross/net value, reward availability, status and reversals. Canonical data remains public.gift_transactions.';
