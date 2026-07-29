-- MyFan Phase B / Session 10
create or replace function public.request_account_deletion(p_reason text,p_idempotency_key uuid)
returns table(deletion_request_id uuid,status text,scheduled_delete_at timestamptz,legal_hold boolean,already_processed boolean)
language plpgsql security definer set search_path='' as $$
declare v_user_id uuid:=auth.uid(); v_existing private.account_deletion_requests%rowtype; v_profile public.profiles%rowtype; v_identity private.user_identity%rowtype; v_previous_payout_eligible boolean:=false; v_previous_frozen boolean:=false; v_grace integer; v_legal_hold boolean; v_request private.account_deletion_requests%rowtype;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if p_idempotency_key is null then raise exception using errcode='22023',message='idempotency_key_required'; end if;
  select * into v_existing from private.account_deletion_requests where idempotency_key=p_idempotency_key;
  if found then
    if v_existing.user_id<>v_user_id then raise exception using errcode='42501',message='deletion_request_owner_mismatch'; end if;
    return query select v_existing.id,v_existing.status::text,v_existing.scheduled_delete_at,v_existing.legal_hold,true;
    return;
  end if;
  if exists(select 1 from private.account_deletion_requests d where d.user_id=v_user_id and d.status in ('requested','scheduled','processing','blocked_by_legal_hold')) then
    raise exception using errcode='23505',message='active_deletion_request_exists';
  end if;
  select * into v_profile from public.profiles where id=v_user_id for update;
  select * into v_identity from private.user_identity where user_id=v_user_id for update;
  select cp.payout_eligible into v_previous_payout_eligible from public.creator_profiles cp where cp.user_id=v_user_id for update;
  v_previous_payout_eligible:=coalesce(v_previous_payout_eligible,false);
  select cea.is_frozen into v_previous_frozen from private.creator_earning_accounts cea where cea.creator_id=v_user_id for update;
  v_previous_frozen:=coalesce(v_previous_frozen,false);
  select (value_json#>>'{}')::integer into v_grace from private.app_config where key='account_deletion_grace_days';
  v_grace:=coalesce(v_grace,30);
  v_legal_hold:=exists(select 1 from private.withdrawals w where w.creator_id=v_user_id and w.status in ('pending','under_review','approved','processing'))
    or exists(select 1 from private.creator_reward_liabilities l where l.creator_id=v_user_id and l.status='open')
    or exists(select 1 from private.creator_earning_accounts cea where cea.creator_id=v_user_id and (cea.pending_units>0 or cea.available_units>0 or cea.held_units>0));
  insert into private.account_deletion_requests(user_id,status,scheduled_delete_at,legal_hold,reason,idempotency_key,previous_profile_status,previous_discovery_enabled,previous_nearby_enabled,previous_account_status,previous_payout_eligible,previous_creator_account_frozen)
  values(v_user_id,case when v_legal_hold then 'blocked_by_legal_hold'::private.account_deletion_status else 'scheduled'::private.account_deletion_status end,
    now()+make_interval(days=>v_grace),v_legal_hold,nullif(btrim(p_reason),''),p_idempotency_key,v_profile.profile_status,v_profile.discovery_enabled,v_profile.nearby_enabled,v_identity.account_status,v_previous_payout_eligible,v_previous_frozen)
  returning * into v_request;
  update public.profiles set discovery_enabled=false,nearby_enabled=false,profile_status='deactivated' where id=v_user_id;
  update private.user_identity set account_status='deletion_requested' where user_id=v_user_id;
  update private.user_locations set is_enabled=false where user_id=v_user_id;
  update public.creator_profiles set payout_eligible=false where user_id=v_user_id;
  update private.creator_earning_accounts set is_frozen=true,version=version+1 where creator_id=v_user_id;
  perform private.append_admin_audit(v_user_id,'user','account_deletion_requested','account_deletion',v_request.id,
    jsonb_build_object('profile_status',v_profile.profile_status::text,'account_status',v_identity.account_status::text),
    jsonb_build_object('status',v_request.status::text,'legal_hold',v_request.legal_hold,'scheduled_delete_at',v_request.scheduled_delete_at),null,p_idempotency_key,null,null);
  perform private.bump_payout_sync(v_user_id,false,false,false,true);
  return query select v_request.id,v_request.status::text,v_request.scheduled_delete_at,v_request.legal_hold,false;
end $$;

create or replace function public.cancel_account_deletion(p_deletion_request_id uuid,p_request_id uuid)
returns table(deletion_request_id uuid,status text,already_processed boolean)
language plpgsql security definer set search_path='' as $$
declare v_user_id uuid:=auth.uid(); v_request private.account_deletion_requests%rowtype;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  if exists(select 1 from private.admin_audit_logs a where a.request_id=p_request_id and a.action='account_deletion_cancelled' and a.target_id=p_deletion_request_id) then
    select * into v_request from private.account_deletion_requests where id=p_deletion_request_id and user_id=v_user_id;
    return query select v_request.id,v_request.status::text,true;
    return;
  end if;
  select * into v_request from private.account_deletion_requests where id=p_deletion_request_id and user_id=v_user_id for update;
  if not found or v_request.status not in ('requested','scheduled','blocked_by_legal_hold') then raise exception using errcode='42501',message='deletion_request_not_cancellable'; end if;
  update private.account_deletion_requests set status='cancelled',cancelled_at=now(),legal_hold=false where id=v_request.id returning * into v_request;
  update public.profiles set profile_status=v_request.previous_profile_status,discovery_enabled=v_request.previous_discovery_enabled,nearby_enabled=v_request.previous_nearby_enabled where id=v_user_id;
  update private.user_identity set account_status=v_request.previous_account_status where user_id=v_user_id;
  update public.creator_profiles set payout_eligible=v_request.previous_payout_eligible where user_id=v_user_id;
  update private.creator_earning_accounts set is_frozen=(v_request.previous_creator_account_frozen or private.has_active_financial_hold(v_user_id)),version=version+1 where creator_id=v_user_id;
  perform private.refresh_creator_payout_eligibility(v_user_id);
  perform private.append_admin_audit(v_user_id,'user','account_deletion_cancelled','account_deletion',v_request.id,
    jsonb_build_object('status','scheduled'),jsonb_build_object('status','cancelled'),null,p_request_id,null,null);
  perform private.bump_payout_sync(v_user_id,false,false,false,true);
  return query select v_request.id,v_request.status::text,false;
end $$;

create or replace function public.admin_process_account_deletion(p_actor_user_id uuid,p_deletion_request_id uuid,p_action text,p_reason text,p_request_id uuid)
returns table(deletion_request_id uuid,status text,already_processed boolean)
language plpgsql security definer set search_path='' as $$
declare v_role private.user_role; v_request private.account_deletion_requests%rowtype; v_existing private.admin_audit_logs%rowtype;
begin
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  v_role:=private.actor_role_for(p_actor_user_id,array['super_admin']::private.user_role[]);
  if p_action not in ('start','complete','block') then raise exception using errcode='22023',message='invalid_deletion_admin_action'; end if;
  select * into v_existing from private.admin_audit_logs where request_id=p_request_id;
  if found then select * into v_request from private.account_deletion_requests where id=p_deletion_request_id; return query select v_request.id,v_request.status::text,true; return; end if;
  select * into v_request from private.account_deletion_requests where id=p_deletion_request_id for update;
  if not found or v_request.status in ('cancelled','completed') then raise exception using errcode='42501',message='active_deletion_request_required'; end if;
  if p_action='block' then
    update private.account_deletion_requests set status='blocked_by_legal_hold',legal_hold=true where id=v_request.id returning * into v_request;
  elsif p_action='start' then
    if v_request.legal_hold then raise exception using errcode='42501',message='deletion_blocked_by_legal_hold'; end if;
    update private.account_deletion_requests set status='processing' where id=v_request.id returning * into v_request;
  else
    if v_request.status<>'processing' or v_request.legal_hold then raise exception using errcode='42501',message='processing_deletion_required'; end if;
    update public.profiles set username=null,display_name='Deleted user',bio=null,avatar_media_id=null,discovery_enabled=false,nearby_enabled=false,profile_status='deleted',deleted_at=now() where id=v_request.user_id;
    update private.user_identity set account_status='deleted' where user_id=v_request.user_id;
    update public.creator_profiles set creator_status='closed',payout_eligible=false where user_id=v_request.user_id;
    update private.bank_accounts set status='disabled',is_default=false,deleted_at=coalesce(deleted_at,now()) where user_id=v_request.user_id and deleted_at is null;
    update private.kyc_profiles set status='suspended',reviewed_at=coalesce(reviewed_at,now()),reviewed_by=coalesce(reviewed_by,p_actor_user_id),rejection_reason_code=null where user_id=v_request.user_id and status not in ('not_submitted','suspended');
    update private.account_deletion_requests set status='completed',processed_at=now() where id=v_request.id returning * into v_request;
  end if;
  perform private.append_admin_audit(p_actor_user_id,v_role,'account_deletion_'||p_action,'account_deletion',v_request.id,'{}'::jsonb,
    jsonb_build_object('status',v_request.status::text,'legal_hold',v_request.legal_hold),p_reason,p_request_id,null,null);
  perform private.bump_payout_sync(v_request.user_id,false,false,false,true);
  return query select v_request.id,v_request.status::text,false;
end $$;

revoke all on function public.request_account_deletion(text,uuid) from public,anon;
grant execute on function public.request_account_deletion(text,uuid) to authenticated;
revoke all on function public.cancel_account_deletion(uuid,uuid) from public,anon;
grant execute on function public.cancel_account_deletion(uuid,uuid) to authenticated;
revoke all on function public.admin_process_account_deletion(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_process_account_deletion(uuid,uuid,text,text,uuid) to service_role;
