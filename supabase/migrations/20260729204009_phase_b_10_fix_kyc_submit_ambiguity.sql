-- Qualify KYC document columns that collide with OUT parameter names.
create or replace function public.server_submit_kyc_profile(
  p_user_id uuid,
  p_legal_name_ciphertext text,
  p_document_type text,
  p_document_number_ciphertext text,
  p_document_number_last4 text,
  p_country_code text,
  p_document_ids uuid[],
  p_request_id uuid
)
returns table(kyc_profile_id uuid,status text,submitted_at timestamptz,already_processed boolean)
language plpgsql security definer set search_path='' as $$
declare v_profile private.kyc_profiles%rowtype; v_before jsonb; v_now timestamptz:=now();
begin
  if p_user_id is null or p_request_id is null then raise exception using errcode='22023',message='user_and_request_required'; end if;
  if exists(select 1 from private.admin_audit_logs a where a.request_id=p_request_id and a.action='kyc_submitted' and a.actor_user_id=p_user_id) then
    select kp.* into v_profile from private.admin_audit_logs a join private.kyc_profiles kp on kp.id=a.target_id where a.request_id=p_request_id;
    return query select v_profile.id,v_profile.status::text,v_profile.submitted_at,true;
    return;
  end if;
  select kp.* into v_profile from private.kyc_profiles kp where kp.user_id=p_user_id for update;
  if found and v_profile.submission_request_id=p_request_id then
    return query select v_profile.id,v_profile.status::text,v_profile.submitted_at,true;
    return;
  end if;
  if not private.is_active_adult(p_user_id) or not exists(select 1 from public.creator_profiles cp where cp.user_id=p_user_id and cp.creator_status in ('pending','approved')) then
    raise exception using errcode='42501',message='eligible_creator_required';
  end if;
  if p_document_type not in ('national_id','passport','drivers_license','residence_permit','other') then raise exception using errcode='22023',message='invalid_kyc_document_type'; end if;
  if p_legal_name_ciphertext!~'^v1\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}$'
     or p_document_number_ciphertext!~'^v1\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}$'
     or upper(p_document_number_last4)!~'^[A-Z0-9]{4}$'
     or upper(p_country_code)!~'^[A-Z]{2}$' then
    raise exception using errcode='22023',message='invalid_encrypted_kyc_payload';
  end if;
  if coalesce(array_length(p_document_ids,1),0)<1 then raise exception using errcode='22023',message='kyc_document_required'; end if;
  if not exists(select 1 from private.kyc_profiles kp where kp.user_id=p_user_id) then
    insert into private.kyc_profiles(user_id) values(p_user_id) returning * into v_profile;
  end if;
  if v_profile.status in ('approved','suspended') then raise exception using errcode='22023',message='kyc_status_not_resubmittable'; end if;
  if exists(
    select 1 from unnest(p_document_ids) d(id)
    left join private.kyc_documents kd on kd.id=d.id and kd.kyc_profile_id=v_profile.id
    where kd.id is null
  ) then raise exception using errcode='42501',message='invalid_kyc_document_reference'; end if;
  v_before:=jsonb_build_object('status',v_profile.status::text);
  update private.kyc_profiles kp set
    legal_name_ciphertext=p_legal_name_ciphertext,
    document_type=p_document_type::private.kyc_document_type,
    document_number_ciphertext=p_document_number_ciphertext,
    document_number_last4=upper(p_document_number_last4),
    country_code=upper(p_country_code),
    status='pending',submission_request_id=p_request_id,submitted_at=v_now,
    reviewed_at=null,reviewed_by=null,rejection_reason_code=null,expires_at=null
  where kp.id=v_profile.id returning kp.* into v_profile;
  update private.kyc_documents kd set status='submitted' where kd.id=any(p_document_ids) and kd.kyc_profile_id=v_profile.id;
  perform private.append_admin_audit(p_user_id,'user','kyc_submitted','kyc_profile',v_profile.id,v_before,
    jsonb_build_object('status','pending','document_type',p_document_type,'document_last4',upper(p_document_number_last4),'country_code',upper(p_country_code)),
    null,p_request_id,null,null);
  perform private.bump_payout_sync(p_user_id,true,false,false,false);
  return query select v_profile.id,v_profile.status::text,v_profile.submitted_at,false;
end $$;

revoke all on function public.server_submit_kyc_profile(uuid,text,text,text,text,text,uuid[],uuid) from public,anon,authenticated;
grant execute on function public.server_submit_kyc_profile(uuid,text,text,text,text,text,uuid[],uuid) to service_role;
