-- Qualify KYC document access columns that collide with OUT parameter names.
create or replace function public.server_authorize_kyc_document_access(
  p_actor_user_id uuid,p_kyc_document_id uuid,p_request_id uuid
)
returns table(kyc_document_id uuid,storage_bucket text,storage_path text,mime_type text,document_side text)
language plpgsql security definer set search_path='' as $$
declare v_role private.user_role; v_document private.kyc_documents%rowtype; v_media public.media_assets%rowtype;
begin
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  select kd.* into v_document from private.kyc_documents kd where kd.id=p_kyc_document_id and kd.status<>'deleted';
  if not found then raise exception using errcode='23503',message='kyc_document_not_found'; end if;
  select ma.* into v_media from public.media_assets ma where ma.id=v_document.media_id and ma.storage_bucket='kyc-private' and ma.visibility='kyc' and ma.deleted_at is null;
  if not found then raise exception using errcode='23503',message='kyc_document_media_not_found'; end if;
  perform private.append_admin_audit(p_actor_user_id,v_role,'kyc_document_accessed','kyc_document',v_document.id,'{}'::jsonb,
    jsonb_build_object('document_side',v_document.document_side::text,'mime_type',v_media.mime_type,'signed_url_ttl_seconds',60),
    'kyc_document_review',p_request_id,null,null);
  return query select v_document.id,v_media.storage_bucket,v_media.storage_path,v_media.mime_type,v_document.document_side::text;
end $$;

revoke all on function public.server_authorize_kyc_document_access(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.server_authorize_kyc_document_access(uuid,uuid,uuid) to service_role;
