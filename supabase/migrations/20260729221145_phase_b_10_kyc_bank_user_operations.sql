-- MyFan Phase B / Session 10
-- Secure KYC upload, encrypted KYC/bank submission and redacted owner APIs.

create or replace function private.user_has_any_active_role(p_user_id uuid,p_roles private.user_role[])
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from private.user_roles r
    where r.user_id=p_user_id and r.role=any(p_roles) and r.revoked_at is null
  )
$$;

create or replace function private.actor_role_for(p_user_id uuid,p_roles private.user_role[])
returns private.user_role language plpgsql stable security definer set search_path='' as $$
declare v_role private.user_role;
begin
  select r.role into v_role
  from private.user_roles r
  where r.user_id=p_user_id and r.role=any(p_roles) and r.revoked_at is null
  order by case r.role when 'super_admin' then 1 when 'finance_admin' then 2 when 'moderator' then 3 when 'creator' then 4 else 5 end
  limit 1;
  if v_role is null then raise exception using errcode='42501',message='required_admin_role_missing'; end if;
  return v_role;
end $$;

create or replace function private.bump_payout_sync(
  p_user_id uuid,
  p_kyc boolean default false,
  p_bank boolean default false,
  p_withdrawal boolean default false,
  p_deletion boolean default false
)
returns void language plpgsql security definer set search_path='' as $$
begin
  insert into public.payout_sync(user_id,kyc_version,bank_version,withdrawal_version,deletion_version)
  values(p_user_id,case when p_kyc then 1 else 0 end,case when p_bank then 1 else 0 end,case when p_withdrawal then 1 else 0 end,case when p_deletion then 1 else 0 end)
  on conflict(user_id) do update set
    kyc_version=public.payout_sync.kyc_version+case when p_kyc then 1 else 0 end,
    bank_version=public.payout_sync.bank_version+case when p_bank then 1 else 0 end,
    withdrawal_version=public.payout_sync.withdrawal_version+case when p_withdrawal then 1 else 0 end,
    deletion_version=public.payout_sync.deletion_version+case when p_deletion then 1 else 0 end,
    updated_at=now();
end $$;

create or replace function private.append_admin_audit(
  p_actor_user_id uuid,
  p_actor_role private.user_role,
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_before_json jsonb,
  p_after_json jsonb,
  p_reason text,
  p_request_id uuid,
  p_ip_hash text default null,
  p_user_agent_hash text default null
)
returns private.admin_audit_logs language plpgsql security definer set search_path='' as $$
declare v_log private.admin_audit_logs;
begin
  if p_actor_user_id is null or p_request_id is null then raise exception using errcode='22023',message='audit_actor_and_request_required'; end if;
  insert into private.admin_audit_logs(actor_user_id,actor_role,action,target_type,target_id,before_json,after_json,reason,request_id,ip_hash,user_agent_hash)
  values(p_actor_user_id,p_actor_role,p_action,p_target_type,p_target_id,coalesce(p_before_json,'{}'::jsonb),coalesce(p_after_json,'{}'::jsonb),nullif(btrim(p_reason),''),p_request_id,p_ip_hash,p_user_agent_hash)
  returning * into v_log;
  return v_log;
exception when unique_violation then
  select * into v_log from private.admin_audit_logs where request_id=p_request_id;
  return v_log;
end $$;

create or replace function private.has_active_financial_hold(p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from private.account_holds h
    where h.user_id=p_user_id
      and h.scope in ('creator_reward','withdrawal','account')
      and h.released_at is null
      and h.starts_at<=now()
      and (h.ends_at is null or h.ends_at>now())
  )
$$;

create or replace function private.refresh_creator_payout_eligibility(p_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_eligible boolean;
begin
  select exists(
    select 1
    from public.creator_profiles cp
    join private.user_identity ui on ui.user_id=cp.user_id
    where cp.user_id=p_user_id
      and cp.creator_status='approved'
      and ui.account_status='active'
      and exists(select 1 from private.kyc_profiles kp where kp.user_id=p_user_id and kp.status='approved' and (kp.expires_at is null or kp.expires_at>now()))
      and exists(select 1 from private.bank_accounts ba where ba.user_id=p_user_id and ba.status='verified' and ba.deleted_at is null)
      and not private.has_active_financial_hold(p_user_id)
  ) into v_eligible;
  update public.creator_profiles set payout_eligible=coalesce(v_eligible,false) where user_id=p_user_id;
  return coalesce(v_eligible,false);
end $$;

create or replace function private.kyc_media_object_allowed(p_name text,p_owner_id text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.media_assets m
    where m.owner_id::text=p_owner_id
      and m.storage_bucket='kyc-private'
      and m.storage_path=p_name
      and m.visibility='kyc'
      and m.moderation_status='pending_upload'
      and m.deleted_at is null
      and split_part(p_name,'/',1)=p_owner_id
      and split_part(p_name,'/',2)=m.id::text
  )
$$;

create policy kyc_private_insert_own_registered on storage.objects
for insert to authenticated
with check (
  bucket_id='kyc-private'
  and owner_id=(select auth.uid()::text)
  and (storage.foldername(name))[1]=(select auth.uid()::text)
  and private.kyc_media_object_allowed(name,owner_id)
);

create or replace function public.prepare_kyc_document_upload(
  p_mime_type text,
  p_file_size_bytes bigint,
  p_document_side text,
  p_width integer default null,
  p_height integer default null,
  p_sha256 text default null,
  p_extension text default 'jpg'
)
returns table(media_id uuid,storage_bucket text,storage_path text,document_side text)
language plpgsql security definer set search_path='' as $$
declare v_user_id uuid:=auth.uid(); v_media_id uuid:=extensions.gen_random_uuid(); v_extension text:=lower(btrim(p_extension)); v_path text; v_media_type public.media_type;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if not exists(select 1 from public.creator_profiles cp where cp.user_id=v_user_id and cp.creator_status in ('pending','approved')) then
    raise exception using errcode='42501',message='creator_profile_required';
  end if;
  if p_document_side not in ('front','back','portrait','supplemental') then raise exception using errcode='22023',message='invalid_kyc_document_side'; end if;
  if p_mime_type not in ('image/jpeg','image/png','image/webp','application/pdf') then raise exception using errcode='22023',message='unsupported_kyc_mime_type'; end if;
  if p_file_size_bytes is null or p_file_size_bytes<=0 or p_file_size_bytes>15728640 then raise exception using errcode='22023',message='invalid_kyc_file_size'; end if;
  if p_sha256 is not null and lower(p_sha256)!~'^[0-9a-f]{64}$' then raise exception using errcode='22023',message='invalid_sha256'; end if;
  if v_extension='jpeg' then v_extension:='jpg'; end if;
  if v_extension not in ('jpg','png','webp','pdf') then raise exception using errcode='22023',message='unsupported_kyc_extension'; end if;
  if (p_mime_type='image/jpeg' and v_extension<>'jpg') or (p_mime_type='image/png' and v_extension<>'png') or (p_mime_type='image/webp' and v_extension<>'webp') or (p_mime_type='application/pdf' and v_extension<>'pdf') then
    raise exception using errcode='22023',message='kyc_mime_extension_mismatch';
  end if;
  if p_mime_type='application/pdf' then
    if p_width is not null or p_height is not null then raise exception using errcode='22023',message='pdf_dimensions_must_be_null'; end if;
    v_media_type:='document';
  else
    if p_width is null or p_height is null or p_width not between 1 and 12000 or p_height not between 1 and 12000 then raise exception using errcode='22023',message='invalid_kyc_image_dimensions'; end if;
    v_media_type:='image';
  end if;
  v_path:=v_user_id::text||'/'||v_media_id::text||'/original.'||v_extension;
  insert into public.media_assets(id,owner_id,storage_bucket,storage_path,media_type,mime_type,file_size_bytes,width,height,sha256,visibility,moderation_status)
  values(v_media_id,v_user_id,'kyc-private',v_path,v_media_type,p_mime_type,p_file_size_bytes,p_width,p_height,case when p_sha256 is null then null else lower(p_sha256) end,'kyc','pending_upload');
  return query select v_media_id,'kyc-private'::text,v_path,p_document_side;
end $$;

create or replace function public.finalize_kyc_document_upload(p_media_id uuid,p_document_side text)
returns table(kyc_document_id uuid,media_id uuid,status text)
language plpgsql security definer set search_path='' as $$
declare v_user_id uuid:=auth.uid(); v_media public.media_assets%rowtype; v_kyc_id uuid; v_document_id uuid;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if p_document_side not in ('front','back','portrait','supplemental') then raise exception using errcode='22023',message='invalid_kyc_document_side'; end if;
  select * into v_media from public.media_assets where id=p_media_id and owner_id=v_user_id for update;
  if not found or v_media.storage_bucket<>'kyc-private' or v_media.visibility<>'kyc' or v_media.moderation_status<>'pending_upload' then
    raise exception using errcode='42501',message='kyc_upload_not_available';
  end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='kyc-private' and o.name=v_media.storage_path and o.owner_id=v_user_id::text) then
    raise exception using errcode='23503',message='kyc_storage_object_not_found';
  end if;
  insert into private.kyc_profiles(user_id) values(v_user_id)
  on conflict(user_id) do update set updated_at=now()
  returning id into v_kyc_id;
  update public.media_assets set moderation_status='pending_review',uploaded_at=now() where id=p_media_id;
  insert into private.kyc_documents(kyc_profile_id,media_id,document_side,status)
  values(v_kyc_id,p_media_id,p_document_side::private.kyc_document_side,'uploaded') returning id into v_document_id;
  perform private.bump_payout_sync(v_user_id,true,false,false,false);
  return query select v_document_id,p_media_id,'uploaded'::text;
end $$;

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
  select * into v_profile from private.kyc_profiles where user_id=p_user_id for update;
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
  if not exists(select 1 from private.kyc_profiles where user_id=p_user_id) then
    insert into private.kyc_profiles(user_id) values(p_user_id) returning * into v_profile;
  end if;
  if v_profile.status in ('approved','suspended') then raise exception using errcode='22023',message='kyc_status_not_resubmittable'; end if;
  if exists(
    select 1 from unnest(p_document_ids) d(id)
    left join private.kyc_documents kd on kd.id=d.id and kd.kyc_profile_id=v_profile.id
    where kd.id is null
  ) then raise exception using errcode='42501',message='invalid_kyc_document_reference'; end if;
  v_before:=jsonb_build_object('status',v_profile.status::text);
  update private.kyc_profiles set
    legal_name_ciphertext=p_legal_name_ciphertext,
    document_type=p_document_type::private.kyc_document_type,
    document_number_ciphertext=p_document_number_ciphertext,
    document_number_last4=upper(p_document_number_last4),
    country_code=upper(p_country_code),
    status='pending',submission_request_id=p_request_id,submitted_at=v_now,
    reviewed_at=null,reviewed_by=null,rejection_reason_code=null,expires_at=null
  where id=v_profile.id returning * into v_profile;
  update private.kyc_documents set status='submitted' where id=any(p_document_ids) and kyc_profile_id=v_profile.id;
  perform private.append_admin_audit(p_user_id,'user','kyc_submitted','kyc_profile',v_profile.id,v_before,
    jsonb_build_object('status','pending','document_type',p_document_type,'document_last4',upper(p_document_number_last4),'country_code',upper(p_country_code)),
    null,p_request_id,null,null);
  perform private.bump_payout_sync(p_user_id,true,false,false,false);
  return query select v_profile.id,v_profile.status::text,v_profile.submitted_at,false;
end $$;

create or replace function public.server_upsert_bank_account(
  p_user_id uuid,
  p_bank_account_id uuid,
  p_bank_code text,
  p_account_number_ciphertext text,
  p_account_number_last4 text,
  p_account_holder_ciphertext text,
  p_is_default boolean,
  p_request_id uuid
)
returns table(bank_account_id uuid,status text,bank_code text,account_number_last4 text,is_default boolean,already_processed boolean)
language plpgsql security definer set search_path='' as $$
declare v_account private.bank_accounts%rowtype; v_before jsonb:='{}'::jsonb;
begin
  if p_user_id is null or p_request_id is null then raise exception using errcode='22023',message='user_and_request_required'; end if;
  if exists(select 1 from private.admin_audit_logs a where a.request_id=p_request_id and a.action='bank_account_submitted' and a.actor_user_id=p_user_id) then
    select ba.* into v_account from private.admin_audit_logs a join private.bank_accounts ba on ba.id=a.target_id where a.request_id=p_request_id;
    return query select v_account.id,v_account.status::text,v_account.bank_code,v_account.account_number_last4,v_account.is_default,true;
    return;
  end if;
  select * into v_account from private.bank_accounts where submission_request_id=p_request_id;
  if found then
    if v_account.user_id<>p_user_id then raise exception using errcode='42501',message='bank_request_owner_mismatch'; end if;
    return query select v_account.id,v_account.status::text,v_account.bank_code,v_account.account_number_last4,v_account.is_default,true;
    return;
  end if;
  if not private.is_active_adult(p_user_id) or not exists(select 1 from public.creator_profiles cp where cp.user_id=p_user_id and cp.creator_status in ('pending','approved')) then
    raise exception using errcode='42501',message='eligible_creator_required';
  end if;
  if upper(p_bank_code)!~'^[A-Z0-9_-]{2,32}$'
     or p_account_number_ciphertext!~'^v1\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}$'
     or p_account_holder_ciphertext!~'^v1\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}$'
     or p_account_number_last4!~'^[0-9]{4}$' then
    raise exception using errcode='22023',message='invalid_encrypted_bank_payload';
  end if;
  if p_bank_account_id is not null then
    select * into v_account from private.bank_accounts where id=p_bank_account_id and user_id=p_user_id for update;
    if not found or v_account.deleted_at is not null or v_account.status='disabled' then raise exception using errcode='42501',message='bank_account_not_editable'; end if;
    v_before:=jsonb_build_object('status',v_account.status::text,'bank_code',v_account.bank_code,'last4',v_account.account_number_last4,'is_default',v_account.is_default);
    update private.bank_accounts set bank_code=upper(p_bank_code),account_number_ciphertext=p_account_number_ciphertext,
      account_number_last4=p_account_number_last4,account_holder_ciphertext=p_account_holder_ciphertext,status='pending',
      is_default=p_is_default,submission_request_id=p_request_id,verified_at=null,verified_by=null,rejection_reason_code=null
    where id=v_account.id returning * into v_account;
  else
    insert into private.bank_accounts(user_id,bank_code,account_number_ciphertext,account_number_last4,account_holder_ciphertext,is_default,submission_request_id)
    values(p_user_id,upper(p_bank_code),p_account_number_ciphertext,p_account_number_last4,p_account_holder_ciphertext,p_is_default,p_request_id)
    returning * into v_account;
  end if;
  if p_is_default then update private.bank_accounts set is_default=false where user_id=p_user_id and id<>v_account.id and deleted_at is null; end if;
  perform private.append_admin_audit(p_user_id,'user','bank_account_submitted','bank_account',v_account.id,v_before,
    jsonb_build_object('status','pending','bank_code',v_account.bank_code,'last4',v_account.account_number_last4,'is_default',v_account.is_default),
    null,p_request_id,null,null);
  perform private.refresh_creator_payout_eligibility(p_user_id);
  perform private.bump_payout_sync(p_user_id,false,true,false,false);
  return query select v_account.id,v_account.status::text,v_account.bank_code,v_account.account_number_last4,v_account.is_default,false;
end $$;

create or replace function public.get_my_kyc_status()
returns table(kyc_profile_id uuid,status text,document_type text,document_number_last4 text,country_code text,submitted_at timestamptz,reviewed_at timestamptz,rejection_reason_code text,expires_at timestamptz,document_count bigint)
language sql stable security definer set search_path='' as $$
  select kp.id,kp.status::text,kp.document_type::text,kp.document_number_last4,kp.country_code::text,kp.submitted_at,kp.reviewed_at,kp.rejection_reason_code,kp.expires_at,
    (select count(*) from private.kyc_documents kd where kd.kyc_profile_id=kp.id and kd.status<>'deleted')
  from private.kyc_profiles kp where kp.user_id=auth.uid()
$$;

create or replace function public.list_my_bank_accounts()
returns table(id uuid,bank_code text,account_number_last4 text,status text,is_default boolean,verified_at timestamptz,rejection_reason_code text,created_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
  select ba.id,ba.bank_code,ba.account_number_last4,ba.status::text,ba.is_default,ba.verified_at,ba.rejection_reason_code,ba.created_at,ba.updated_at
  from private.bank_accounts ba where ba.user_id=auth.uid() and ba.deleted_at is null order by ba.is_default desc,ba.created_at desc
$$;

create or replace function public.list_my_withdrawals(p_limit integer default 50,p_cursor uuid default null)
returns table(id uuid,bank_account_id uuid,bank_code_snapshot text,bank_account_last4_snapshot text,requested_reward_units bigint,amount_vnd bigint,heart_vnd_rate_snapshot bigint,status text,requested_at timestamptz,reviewed_at timestamptz,rejection_reason_code text,approved_at timestamptz,paid_at timestamptz,payment_reference text,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select w.id,w.bank_account_id,w.bank_code_snapshot,w.bank_account_last4_snapshot,w.requested_reward_units,w.amount_vnd,w.heart_vnd_rate_snapshot,w.status::text,w.requested_at,w.reviewed_at,w.rejection_reason_code,w.approved_at,w.paid_at,w.payment_reference,w.created_at
  from private.withdrawals w where w.creator_id=auth.uid() and (p_cursor is null or w.id>p_cursor)
  order by w.id limit least(greatest(coalesce(p_limit,50),1),100)
$$;

create or replace function public.get_my_account_deletion_status()
returns table(id uuid,status text,requested_at timestamptz,scheduled_delete_at timestamptz,cancelled_at timestamptz,processed_at timestamptz,legal_hold boolean)
language sql stable security definer set search_path='' as $$
  select d.id,d.status::text,d.requested_at,d.scheduled_delete_at,d.cancelled_at,d.processed_at,d.legal_hold
  from private.account_deletion_requests d where d.user_id=auth.uid() order by d.created_at desc limit 1
$$;

revoke all on function private.user_has_any_active_role(uuid,private.user_role[]) from public,anon,authenticated;
revoke all on function private.actor_role_for(uuid,private.user_role[]) from public,anon,authenticated;
revoke all on function private.bump_payout_sync(uuid,boolean,boolean,boolean,boolean) from public,anon,authenticated;
revoke all on function private.append_admin_audit(uuid,private.user_role,text,text,uuid,jsonb,jsonb,text,uuid,text,text) from public,anon,authenticated;
revoke all on function private.has_active_financial_hold(uuid) from public,anon,authenticated;
revoke all on function private.refresh_creator_payout_eligibility(uuid) from public,anon,authenticated;
revoke all on function private.kyc_media_object_allowed(text,text) from public,anon,authenticated;
grant execute on function private.kyc_media_object_allowed(text,text) to authenticated;

revoke all on function public.prepare_kyc_document_upload(text,bigint,text,integer,integer,text,text) from public,anon;
grant execute on function public.prepare_kyc_document_upload(text,bigint,text,integer,integer,text,text) to authenticated;
revoke all on function public.finalize_kyc_document_upload(uuid,text) from public,anon;
grant execute on function public.finalize_kyc_document_upload(uuid,text) to authenticated;
revoke all on function public.server_submit_kyc_profile(uuid,text,text,text,text,text,uuid[],uuid) from public,anon,authenticated;
grant execute on function public.server_submit_kyc_profile(uuid,text,text,text,text,text,uuid[],uuid) to service_role;
revoke all on function public.server_upsert_bank_account(uuid,uuid,text,text,text,text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.server_upsert_bank_account(uuid,uuid,text,text,text,text,boolean,uuid) to service_role;
revoke all on function public.get_my_kyc_status() from public,anon;
grant execute on function public.get_my_kyc_status() to authenticated;
revoke all on function public.list_my_bank_accounts() from public,anon;
grant execute on function public.list_my_bank_accounts() to authenticated;
revoke all on function public.list_my_withdrawals(integer,uuid) from public,anon;
grant execute on function public.list_my_withdrawals(integer,uuid) to authenticated;
revoke all on function public.get_my_account_deletion_status() from public,anon;
grant execute on function public.get_my_account_deletion_status() to authenticated;
