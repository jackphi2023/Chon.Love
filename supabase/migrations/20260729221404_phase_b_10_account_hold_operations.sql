-- MyFan Phase B / Session 10
create or replace function public.admin_create_account_hold(
  p_actor_user_id uuid,p_user_id uuid,p_hold_type text,p_scope text,p_reason_code text,p_ends_at timestamptz,p_request_id uuid
)
returns table(hold_id uuid,scope text,starts_at timestamptz,ends_at timestamptz,already_processed boolean)
language plpgsql security definer set search_path='' as $$
declare v_role private.user_role; v_hold private.account_holds%rowtype; v_existing private.admin_audit_logs%rowtype;
begin
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  select * into v_existing from private.admin_audit_logs where request_id=p_request_id;
  if found then select * into v_hold from private.account_holds where id=v_existing.target_id; return query select v_hold.id,v_hold.scope::text,v_hold.starts_at,v_hold.ends_at,true; return; end if;
  if p_hold_type not in ('fraud','compliance','chargeback','manual_review','legal') or p_scope not in ('gift','purchase','creator_reward','withdrawal','account') or p_reason_code!~'^[a-z][a-z0-9_]{1,63}$' then
    raise exception using errcode='22023',message='invalid_account_hold';
  end if;
  insert into private.account_holds(user_id,hold_type,reason_code,scope,ends_at,created_by)
  values(p_user_id,p_hold_type::private.account_hold_type,p_reason_code,p_scope::private.account_hold_scope,p_ends_at,p_actor_user_id) returning * into v_hold;
  if v_hold.scope in ('creator_reward','withdrawal','account') then update private.creator_earning_accounts set is_frozen=true,version=version+1 where creator_id=p_user_id; end if;
  perform private.refresh_creator_payout_eligibility(p_user_id);
  perform private.append_admin_audit(p_actor_user_id,v_role,'account_hold_created','account_hold',v_hold.id,'{}'::jsonb,
    jsonb_build_object('user_id',p_user_id,'hold_type',v_hold.hold_type::text,'scope',v_hold.scope::text,'reason_code',v_hold.reason_code,'ends_at',v_hold.ends_at),p_reason_code,p_request_id,null,null);
  perform private.bump_payout_sync(p_user_id,false,false,true,false);
  return query select v_hold.id,v_hold.scope::text,v_hold.starts_at,v_hold.ends_at,false;
end $$;

create or replace function public.admin_release_account_hold(p_actor_user_id uuid,p_hold_id uuid,p_reason text,p_request_id uuid)
returns table(hold_id uuid,released_at timestamptz,already_processed boolean)
language plpgsql security definer set search_path='' as $$
declare v_role private.user_role; v_hold private.account_holds%rowtype; v_existing private.admin_audit_logs%rowtype;
begin
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  select * into v_existing from private.admin_audit_logs where request_id=p_request_id;
  if found then select * into v_hold from private.account_holds where id=p_hold_id; return query select v_hold.id,v_hold.released_at,true; return; end if;
  select * into v_hold from private.account_holds where id=p_hold_id for update;
  if not found or v_hold.released_at is not null then raise exception using errcode='42501',message='active_hold_required'; end if;
  update private.account_holds set released_at=now(),released_by=p_actor_user_id where id=v_hold.id returning * into v_hold;
  if not private.has_active_financial_hold(v_hold.user_id) then update private.creator_earning_accounts set is_frozen=false,version=version+1 where creator_id=v_hold.user_id; end if;
  perform private.refresh_creator_payout_eligibility(v_hold.user_id);
  perform private.append_admin_audit(p_actor_user_id,v_role,'account_hold_released','account_hold',v_hold.id,
    jsonb_build_object('released_at',null,'scope',v_hold.scope::text),jsonb_build_object('released_at',v_hold.released_at,'scope',v_hold.scope::text),p_reason,p_request_id,null,null);
  perform private.bump_payout_sync(v_hold.user_id,false,false,true,false);
  return query select v_hold.id,v_hold.released_at,false;
end $$;

revoke all on function public.admin_create_account_hold(uuid,uuid,text,text,text,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.admin_create_account_hold(uuid,uuid,text,text,text,timestamptz,uuid) to service_role;
revoke all on function public.admin_release_account_hold(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_release_account_hold(uuid,uuid,text,uuid) to service_role;
