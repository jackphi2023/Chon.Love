import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.57.4';
import { decryptText, importDecryptionKey } from './crypto.ts';

type JsonBody = Record<string, unknown> & { action?: string; requestId?: string };
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };
function respond(status: number, body: Record<string, unknown>): Response { return new Response(JSON.stringify(body), { status, headers: jsonHeaders }); }
function validUuid(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value); }
function requestId(value: unknown): string { return validUuid(value) ? value : crypto.randomUUID(); }
function pageLimit(value: unknown): number { return typeof value === 'number' && Number.isInteger(value) ? Math.min(Math.max(value, 1), 200) : 100; }
function pageOffset(value: unknown): number { return typeof value === 'number' && Number.isInteger(value) ? Math.max(value, 0) : 0; }

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: 'method_not_allowed' });
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return respond(401, { error: 'authentication_required' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serverKey) return respond(500, { error: 'supabase_server_configuration_missing' });
  let body: JsonBody;
  try { body = await request.json() as JsonBody; } catch { return respond(400, { error: 'invalid_json' }); }

  try {
    const server = createClient(supabaseUrl, serverKey, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await server.auth.getUser(authorization.slice(7));
    if (userError || !userData.user) return respond(401, { error: 'invalid_access_token' });
    const actorId = userData.user.id;
    const action = body.action;
    const rid = requestId(body.requestId);

    if (action === 'list_kyc_queue' || action === 'list_bank_queue' || action === 'list_withdrawal_queue') {
      const rpc = action === 'list_kyc_queue'
        ? 'admin_list_kyc_operational_queue'
        : action === 'list_bank_queue'
          ? 'admin_list_bank_operational_queue'
          : 'admin_list_withdrawal_operational_queue';
      const { data, error } = await server.rpc(rpc, {
        p_actor_user_id: actorId,
        p_status: typeof body.status === 'string' ? body.status : null,
        p_limit: pageLimit(body.limit),
        p_offset: pageOffset(body.offset),
      });
      if (error) throw new Error(`${action}_failed:${error.code}`);
      return respond(200, { items: data ?? [], requestId: rid });
    }

    if (action === 'start_kyc_review' || action === 'start_bank_review' || action === 'start_withdrawal_review') {
      const rpc = action === 'start_kyc_review'
        ? 'admin_start_kyc_review'
        : action === 'start_bank_review'
          ? 'admin_start_bank_review'
          : 'admin_start_withdrawal_review';
      const entityId = action === 'start_kyc_review' ? body.kycProfileId : action === 'start_bank_review' ? body.bankAccountId : body.withdrawalId;
      if (!validUuid(entityId)) return respond(400, { error: 'invalid_entity_id' });
      const idKey = action === 'start_kyc_review' ? 'p_kyc_profile_id' : action === 'start_bank_review' ? 'p_bank_account_id' : 'p_withdrawal_id';
      const { data, error } = await server.rpc(rpc, { p_actor_user_id: actorId, [idKey]: entityId, p_request_id: rid });
      if (error || !data?.[0]) throw new Error(`${action}_failed:${error?.code ?? 'no_result'}`);
      return respond(200, { ...data[0], requestId: rid });
    }

    if (action === 'review_kyc') {
      if (!validUuid(body.kycProfileId)) return respond(400, { error: 'invalid_kyc_profile_id' });
      const { data, error } = await server.rpc('admin_review_kyc', {
        p_actor_user_id: actorId, p_kyc_profile_id: body.kycProfileId, p_decision: body.decision,
        p_reason_code: body.reasonCode ?? null, p_expires_at: body.expiresAt ?? null, p_request_id: rid,
      });
      if (error || !data?.[0]) throw new Error(`review_kyc_failed:${error?.code ?? 'no_result'}`);
      return respond(200, { ...data[0], requestId: rid });
    }

    if (action === 'review_bank') {
      if (!validUuid(body.bankAccountId)) return respond(400, { error: 'invalid_bank_account_id' });
      const { data, error } = await server.rpc('admin_review_bank_account', {
        p_actor_user_id: actorId, p_bank_account_id: body.bankAccountId, p_decision: body.decision,
        p_reason_code: body.reasonCode ?? null, p_request_id: rid,
      });
      if (error || !data?.[0]) throw new Error(`review_bank_failed:${error?.code ?? 'no_result'}`);
      return respond(200, { ...data[0], requestId: rid });
    }

    if (action === 'operate_withdrawal') {
      if (!validUuid(body.withdrawalId)) return respond(400, { error: 'invalid_withdrawal_id' });
      const { data, error } = await server.rpc('admin_operate_withdrawal', {
        p_actor_user_id: actorId,
        p_withdrawal_id: body.withdrawalId,
        p_action: body.decision,
        p_reason_code: body.reasonCode ?? null,
        p_payment_reference: body.paymentReference ?? null,
        p_payment_evidence_sha256: body.paymentEvidenceSha256 ?? null,
        p_request_id: rid,
      });
      if (error || !data?.[0]) throw new Error(`operate_withdrawal_failed:${error?.code ?? 'no_result'}`);
      return respond(200, { ...data[0], requestId: rid });
    }

    if (action === 'create_hold') {
      if (!validUuid(body.userId)) return respond(400, { error: 'invalid_user_id' });
      const { data, error } = await server.rpc('admin_create_account_hold', { p_actor_user_id: actorId, p_user_id: body.userId, p_hold_type: body.holdType, p_scope: body.scope, p_reason_code: body.reasonCode, p_ends_at: body.endsAt ?? null, p_request_id: rid });
      if (error || !data?.[0]) throw new Error(`create_hold_failed:${error?.code ?? 'no_result'}`);
      return respond(200, { ...data[0], requestId: rid });
    }
    if (action === 'release_hold') {
      if (!validUuid(body.holdId)) return respond(400, { error: 'invalid_hold_id' });
      const { data, error } = await server.rpc('admin_release_account_hold', { p_actor_user_id: actorId, p_hold_id: body.holdId, p_reason: body.reason ?? null, p_request_id: rid });
      if (error || !data?.[0]) throw new Error(`release_hold_failed:${error?.code ?? 'no_result'}`);
      return respond(200, { ...data[0], requestId: rid });
    }
    if (action === 'process_deletion') {
      if (!validUuid(body.deletionRequestId)) return respond(400, { error: 'invalid_deletion_request_id' });
      const { data, error } = await server.rpc('admin_process_account_deletion', { p_actor_user_id: actorId, p_deletion_request_id: body.deletionRequestId, p_action: body.decision, p_reason: body.reason ?? null, p_request_id: rid });
      if (error || !data?.[0]) throw new Error(`process_deletion_failed:${error?.code ?? 'no_result'}`);
      return respond(200, { ...data[0], requestId: rid });
    }

    if (action === 'get_kyc_review' || action === 'get_bank_review') {
      const keyValue = Deno.env.get('MYFAN_PII_ENCRYPTION_KEY_B64');
      if (!keyValue) return respond(503, { error: 'pii_encryption_configuration_missing' });
      const key = await importDecryptionKey(keyValue);
      if (action === 'get_kyc_review') {
        if (!validUuid(body.kycProfileId)) return respond(400, { error: 'invalid_kyc_profile_id' });
        const { data, error } = await server.rpc('server_get_kyc_review_payload', { p_actor_user_id: actorId, p_kyc_profile_id: body.kycProfileId, p_request_id: rid });
        if (error || !data?.[0]) throw new Error(`get_kyc_review_failed:${error?.code ?? 'no_result'}`);
        const row = data[0];
        return respond(200, { kycProfileId: row.kyc_profile_id, userId: row.user_id, legalName: await decryptText(key, row.legal_name_ciphertext), documentType: row.document_type, documentNumber: await decryptText(key, row.document_number_ciphertext), documentNumberLast4: row.document_number_last4, countryCode: row.country_code, status: row.status, submittedAt: row.submitted_at, documentIds: row.document_ids, requestId: rid });
      }
      if (!validUuid(body.bankAccountId)) return respond(400, { error: 'invalid_bank_account_id' });
      const { data, error } = await server.rpc('server_get_bank_review_payload', { p_actor_user_id: actorId, p_bank_account_id: body.bankAccountId, p_request_id: rid });
      if (error || !data?.[0]) throw new Error(`get_bank_review_failed:${error?.code ?? 'no_result'}`);
      const row = data[0];
      return respond(200, { bankAccountId: row.bank_account_id, userId: row.user_id, bankCode: row.bank_code, accountNumber: await decryptText(key, row.account_number_ciphertext), accountNumberLast4: row.account_number_last4, accountHolder: await decryptText(key, row.account_holder_ciphertext), status: row.status, isDefault: row.is_default, requestId: rid });
    }

    if (action === 'get_kyc_document_url') {
      if (!validUuid(body.kycDocumentId)) return respond(400, { error: 'invalid_kyc_document_id' });
      const { data, error } = await server.rpc('server_authorize_kyc_document_access', { p_actor_user_id: actorId, p_kyc_document_id: body.kycDocumentId, p_request_id: rid });
      if (error || !data?.[0]) throw new Error(`authorize_kyc_document_failed:${error?.code ?? 'no_result'}`);
      const row = data[0];
      const { data: signed, error: signedError } = await server.storage.from(row.storage_bucket).createSignedUrl(row.storage_path, 60);
      if (signedError || !signed?.signedUrl) throw new Error('kyc_signed_url_failed');
      return respond(200, { kycDocumentId: row.kyc_document_id, documentSide: row.document_side, mimeType: row.mime_type, signedUrl: signed.signedUrl, expiresInSeconds: 60, requestId: rid });
    }

    return respond(400, { error: 'unsupported_action' });
  } catch (error) {
    console.error(error instanceof Error ? error.message.split(':')[0] : 'payout_admin_failed');
    return respond(500, { error: 'payout_admin_failed' });
  }
});
