-- MyFan Phase B / Session 10
-- Owner payout contract, Realtime invalidation and audited server-only review payloads.

create or replace function public.get_my_payout_summary()
returns table(
  user_id uuid,
  creator_status text,
  payout_eligible boolean,
  kyc_status text,
  verified_bank_accounts bigint,
  pending_withdrawals bigint,
  creator_available_units bigint,
  creator_held_units bigint,
  creator_paid_units bigint,
  active_financial_hold boolean,
  deletion_status text
)
language sql stable security definer set search_path='' as $$
  select
    cp.user_id,
    cp.creator_status::text,
    cp.payout_eligible,
    coalesce((select kp.status::text from private.kyc_profiles kp where kp.user_id=cp.user_id),'not_submitted'),
    (select count(*) from private.bank_accounts ba where ba.user_id=cp.user_id and ba.status='verified' and ba.deleted_at is null),
    (select count(*) from private.withdrawals w where w.creator_id=cp.user_id and w.status in ('pending','under_review','approved','processing')),
    coalesce(cea.available_units,0),coalesce(cea.held_units,0),coalesce(cea.paid_units,0),
    private.has_active_financial_hold(cp.user_id),
    (select d.status::text from private.account_deletion_requests d where d.user_id=cp.user_id order by d.created_at desc limit 1)
  from public.creator_profiles cp
  left join private.creator_earning_accounts cea on cea.creator_id=cp.user_id
  where cp.user_id=auth.uid()
$$;

create or replace function public.server_get_kyc_review_payload(
  p_actor_user_id uuid,p_kyc_profile_id uuid,p_request_id uuid
)
returns table(
  kyc_profile_id uuid,user_id uuid,legal_name_ciphertext text,document_type text,
  document_number_ciphertext text,document_number_last4 text,country_code text,status text,
  submitted_at timestamptz,document_ids uuid[]
)
language plpgsql security definer set search_path='' as $$
declare v_role private.user_role; v_kyc private.kyc_profiles%rowtype; v_documents uuid[];
begin
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  select * into v_kyc from private.kyc_profiles where id=p_kyc_profile_id;
  if not found then raise exception using errcode='23503',message='kyc_profile_not_found'; end if;
  select coalesce(array_agg(kd.id order by kd.created_at,kd.id),'{}'::uuid[]) into v_documents
  from private.kyc_documents kd where kd.kyc_profile_id=v_kyc.id and kd.status<>'deleted';
  perform private.append_admin_audit(p_actor_user_id,v_role,'kyc_sensitive_viewed','kyc_profile',v_kyc.id,'{}'::jsonb,
    jsonb_build_object('status',v_kyc.status::text,'document_type',v_kyc.document_type::text,'document_last4',v_kyc.document_number_last4,'country_code',v_kyc.country_code,'document_count',cardinality(v_documents)),
    'kyc_review_access',p_request_id,null,null);
  return query select v_kyc.id,v_kyc.user_id,v_kyc.legal_name_ciphertext,v_kyc.document_type::text,
    v_kyc.document_number_ciphertext,v_kyc.document_number_last4,v_kyc.country_code::text,v_kyc.status::text,v_kyc.submitted_at,v_documents;
end $$;

create or replace function public.server_get_bank_review_payload(
  p_actor_user_id uuid,p_bank_account_id uuid,p_request_id uuid
)
returns table(
  bank_account_id uuid,user_id uuid,bank_code text,account_number_ciphertext text,
  account_number_last4 text,account_holder_ciphertext text,status text,is_default boolean
)
language plpgsql security definer set search_path='' as $$
declare v_role private.user_role; v_bank private.bank_accounts%rowtype;
begin
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  select * into v_bank from private.bank_accounts where id=p_bank_account_id and deleted_at is null;
  if not found then raise exception using errcode='23503',message='bank_account_not_found'; end if;
  perform private.append_admin_audit(p_actor_user_id,v_role,'bank_sensitive_viewed','bank_account',v_bank.id,'{}'::jsonb,
    jsonb_build_object('status',v_bank.status::text,'bank_code',v_bank.bank_code,'last4',v_bank.account_number_last4,'is_default',v_bank.is_default),
    'bank_review_access',p_request_id,null,null);
  return query select v_bank.id,v_bank.user_id,v_bank.bank_code,v_bank.account_number_ciphertext,
    v_bank.account_number_last4,v_bank.account_holder_ciphertext,v_bank.status::text,v_bank.is_default;
end $$;

create or replace function public.server_authorize_kyc_document_access(
  p_actor_user_id uuid,p_kyc_document_id uuid,p_request_id uuid
)
returns table(kyc_document_id uuid,storage_bucket text,storage_path text,mime_type text,document_side text)
language plpgsql security definer set search_path='' as $$
declare v_role private.user_role; v_document private.kyc_documents%rowtype; v_media public.media_assets%rowtype;
begin
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  select * into v_document from private.kyc_documents where id=p_kyc_document_id and status<>'deleted';
  if not found then raise exception using errcode='23503',message='kyc_document_not_found'; end if;
  select * into v_media from public.media_assets where id=v_document.media_id and storage_bucket='kyc-private' and visibility='kyc' and deleted_at is null;
  if not found then raise exception using errcode='23503',message='kyc_document_media_not_found'; end if;
  perform private.append_admin_audit(p_actor_user_id,v_role,'kyc_document_accessed','kyc_document',v_document.id,'{}'::jsonb,
    jsonb_build_object('document_side',v_document.document_side::text,'mime_type',v_media.mime_type,'signed_url_ttl_seconds',60),
    'kyc_document_review',p_request_id,null,null);
  return query select v_document.id,v_media.storage_bucket,v_media.storage_path,v_media.mime_type,v_document.document_side::text;
end $$;

revoke all on function public.get_my_payout_summary() from public,anon;
grant execute on function public.get_my_payout_summary() to authenticated;
revoke all on function public.server_get_kyc_review_payload(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.server_get_kyc_review_payload(uuid,uuid,uuid) to service_role;
revoke all on function public.server_get_bank_review_payload(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.server_get_bank_review_payload(uuid,uuid,uuid) to service_role;
revoke all on function public.server_authorize_kyc_document_access(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.server_authorize_kyc_document_access(uuid,uuid,uuid) to service_role;

revoke all on public.payout_sync from public,anon,authenticated;
grant select on public.payout_sync to authenticated;
grant all on public.payout_sync to service_role;
create policy payout_sync_read_owner on public.payout_sync for select to authenticated using(user_id=(select auth.uid()));

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='payout_sync') then
    alter publication supabase_realtime add table public.payout_sync;
  end if;
end $$;

revoke all on schema private from public,anon,authenticated;

comment on function public.get_my_payout_summary() is 'Redacted owner-only payout readiness summary shared by Expo Web, Android and iOS.';
comment on function public.server_get_kyc_review_payload(uuid,uuid,uuid) is 'Service-role-only audited retrieval of encrypted KYC review data.';
comment on function public.server_get_bank_review_payload(uuid,uuid,uuid) is 'Service-role-only audited retrieval of encrypted bank review data.';
comment on function public.server_authorize_kyc_document_access(uuid,uuid,uuid) is 'Service-role-only audited authorization for a short-lived KYC document signed URL.';
