-- Keep the LX-19 membership entitlement snapshot STABLE/read-only.
-- Economy accounts are bootstrapped by auth/profile triggers and LX-19 backfill.
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
    select coalesce(a.available_units,0) into v_balance
    from private.heart_accounts a
    where a.user_id=v_user_id;
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
