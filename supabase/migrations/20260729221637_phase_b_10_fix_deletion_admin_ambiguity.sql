-- Qualify account deletion admin columns that collide with OUT parameter names.
create or replace function public.admin_process_account_deletion(p_actor_user_id uuid,p_deletion_request_id uuid,p_action text,p_reason text,p_request_id uuid)
returns table(deletion_request_id uuid,status text,already_processed boolean)
language plpgsql security definer set search_path='' as $$
declare v_role private.user_role; v_request private.account_deletion_requests%rowtype; v_existing private.admin_audit_logs%rowtype;
begin
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  v_role:=private.actor_role_for(p_actor_user_id,array['super_admin']::private.user_role[]);
  if p_action not in ('start','complete','block') then raise exception using errcode='22023',message='invalid_deletion_admin_action'; end if;
  select a.* into v_existing from private.admin_audit_logs a where a.request_id=p_request_id;
  if found then
    select d.* into v_request from private.account_deletion_requests d where d.id=p_deletion_request_id;
    return query select v_request.id,v_request.status::text,true;
    return;
  end if;
  select d.* into v_request from private.account_deletion_requests d where d.id=p_deletion_request_id for update;
  if not found or v_request.status in ('cancelled','completed') then raise exception using errcode='42501',message='active_deletion_request_required'; end if;
  if p_action='block' then
    update private.account_deletion_requests as d set status='blocked_by_legal_hold',legal_hold=true where d.id=v_request.id returning d.* into v_request;
  elsif p_action='start' then
    if v_request.legal_hold then raise exception using errcode='42501',message='deletion_blocked_by_legal_hold'; end if;
    update private.account_deletion_requests as d set status='processing' where d.id=v_request.id returning d.* into v_request;
  else
    if v_request.status<>'processing' or v_request.legal_hold then raise exception using errcode='42501',message='processing_deletion_required'; end if;
    update public.profiles as p set username=null,display_name='Deleted user',bio=null,avatar_media_id=null,discovery_enabled=false,nearby_enabled=false,profile_status='deleted',deleted_at=now() where p.id=v_request.user_id;
    update private.user_identity as ui set account_status='deleted' where ui.user_id=v_request.user_id;
    update public.creator_profiles as cp set creator_status='closed',payout_eligible=false where cp.user_id=v_request.user_id;
    update private.bank_accounts as ba set status='disabled',is_default=false,deleted_at=coalesce(ba.deleted_at,now()) where ba.user_id=v_request.user_id and ba.deleted_at is null;
    update private.kyc_profiles as kp set status='suspended',reviewed_at=coalesce(kp.reviewed_at,now()),reviewed_by=coalesce(kp.reviewed_by,p_actor_user_id),rejection_reason_code=null where kp.user_id=v_request.user_id and kp.status not in ('not_submitted','suspended');
    update private.account_deletion_requests as d set status='completed',processed_at=now() where d.id=v_request.id returning d.* into v_request;
  end if;
  perform private.append_admin_audit(p_actor_user_id,v_role,'account_deletion_'||p_action,'account_deletion',v_request.id,'{}'::jsonb,
    jsonb_build_object('status',v_request.status::text,'legal_hold',v_request.legal_hold),p_reason,p_request_id,null,null);
  perform private.bump_payout_sync(v_request.user_id,false,false,false,true);
  return query select v_request.id,v_request.status::text,false;
end $$;

revoke all on function public.admin_process_account_deletion(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_process_account_deletion(uuid,uuid,text,text,uuid) to service_role;
