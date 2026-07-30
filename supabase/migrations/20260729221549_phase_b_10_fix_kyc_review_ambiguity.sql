-- Qualify KYC review columns that collide with OUT parameter names.
create or replace function public.admin_review_kyc(
  p_actor_user_id uuid,p_kyc_profile_id uuid,p_decision text,p_reason_code text,p_expires_at timestamptz,p_request_id uuid
)
returns table(kyc_profile_id uuid,status text,payout_eligible boolean,already_processed boolean)
language plpgsql security definer set search_path='' as $$
declare v_role private.user_role; v_kyc private.kyc_profiles%rowtype; v_existing private.admin_audit_logs%rowtype; v_eligible boolean; v_before jsonb;
begin
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  select a.* into v_existing from private.admin_audit_logs a where a.request_id=p_request_id;
  if found then
    select kp.* into v_kyc from private.kyc_profiles kp where kp.id=p_kyc_profile_id;
    select cp.payout_eligible into v_eligible from public.creator_profiles cp where cp.user_id=v_kyc.user_id;
    return query select v_kyc.id,v_kyc.status::text,coalesce(v_eligible,false),true;
    return;
  end if;
  if p_decision not in ('approve','reject') then raise exception using errcode='22023',message='invalid_kyc_decision'; end if;
  select kp.* into v_kyc from private.kyc_profiles kp where kp.id=p_kyc_profile_id for update;
  if not found or v_kyc.status<>'pending' then raise exception using errcode='42501',message='pending_kyc_required'; end if;
  if p_decision='reject' and (p_reason_code is null or p_reason_code!~'^[a-z][a-z0-9_]{1,63}$') then raise exception using errcode='22023',message='kyc_rejection_reason_required'; end if;
  v_before:=jsonb_build_object('status',v_kyc.status::text,'document_type',v_kyc.document_type::text,'document_last4',v_kyc.document_number_last4,'country_code',v_kyc.country_code);
  update private.kyc_profiles kp set
    status=case when p_decision='approve' then 'approved'::private.kyc_status else 'rejected'::private.kyc_status end,
    reviewed_at=now(),reviewed_by=p_actor_user_id,rejection_reason_code=case when p_decision='reject' then p_reason_code else null end,
    expires_at=case when p_decision='approve' then p_expires_at else null end
  where kp.id=v_kyc.id returning kp.* into v_kyc;
  update private.kyc_documents kd set status=case when p_decision='approve' then 'reviewed'::private.kyc_document_status else 'rejected'::private.kyc_document_status end where kd.kyc_profile_id=v_kyc.id;
  v_eligible:=private.refresh_creator_payout_eligibility(v_kyc.user_id);
  perform private.append_admin_audit(p_actor_user_id,v_role,'kyc_'||case when p_decision='approve' then 'approved' else 'rejected' end,'kyc_profile',v_kyc.id,v_before,
    jsonb_build_object('status',v_kyc.status::text,'document_type',v_kyc.document_type::text,'document_last4',v_kyc.document_number_last4,'country_code',v_kyc.country_code,'expires_at',v_kyc.expires_at),p_reason_code,p_request_id,null,null);
  perform private.bump_payout_sync(v_kyc.user_id,true,false,false,false);
  return query select v_kyc.id,v_kyc.status::text,v_eligible,false;
end $$;

revoke all on function public.admin_review_kyc(uuid,uuid,text,text,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.admin_review_kyc(uuid,uuid,text,text,timestamptz,uuid) to service_role;
