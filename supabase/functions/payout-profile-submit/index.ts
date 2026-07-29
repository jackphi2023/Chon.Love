import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.57.4';
import { encryptText, importEncryptionKey } from './crypto.ts';

type SubmitKycBody = { action: 'submit_kyc'; legalName?: string; documentType?: string; documentNumber?: string; countryCode?: string; documentIds?: string[]; requestId?: string };
type UpsertBankBody = { action: 'upsert_bank'; bankAccountId?: string | null; bankCode?: string; accountNumber?: string; accountHolder?: string; isDefault?: boolean; requestId?: string };
type RequestBody = SubmitKycBody | UpsertBankBody;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };

function respond(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
function validUuid(value: string | undefined): value is string {
  return value != null && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}
function normalizedRequestId(value?: string): string {
  return validUuid(value) ? value : crypto.randomUUID();
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: 'method_not_allowed' });
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return respond(401, { error: 'authentication_required' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const encryptionKeyValue = Deno.env.get('MYFAN_PII_ENCRYPTION_KEY_B64');
  if (!supabaseUrl || !serverKey) return respond(500, { error: 'supabase_server_configuration_missing' });
  if (!encryptionKeyValue) return respond(503, { error: 'pii_encryption_configuration_missing' });
  let body: RequestBody;
  try { body = await request.json() as RequestBody; } catch { return respond(400, { error: 'invalid_json' }); }
  try {
    const server = createClient(supabaseUrl, serverKey, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await server.auth.getUser(authorization.slice(7));
    if (userError || !userData.user) return respond(401, { error: 'invalid_access_token' });
    const encryptionKey = await importEncryptionKey(encryptionKeyValue);
    const requestId = normalizedRequestId(body.requestId);
    if (body.action === 'submit_kyc') {
      const legalName = body.legalName?.trim();
      const documentNumber = body.documentNumber?.trim().toUpperCase();
      const documentType = body.documentType?.trim();
      const countryCode = body.countryCode?.trim().toUpperCase();
      const documentIds = body.documentIds ?? [];
      if (!legalName || legalName.length > 160 || !documentNumber || documentNumber.length > 64 || !documentType || !countryCode || !/^[A-Z]{2}$/u.test(countryCode)) return respond(400, { error: 'invalid_kyc_submission' });
      if (documentNumber.length < 4 || !documentIds.length || documentIds.length > 8 || documentIds.some((id) => !validUuid(id))) return respond(400, { error: 'invalid_kyc_documents' });
      const { data, error } = await server.rpc('server_submit_kyc_profile', {
        p_user_id: userData.user.id,
        p_legal_name_ciphertext: await encryptText(encryptionKey, legalName),
        p_document_type: documentType,
        p_document_number_ciphertext: await encryptText(encryptionKey, documentNumber),
        p_document_number_last4: documentNumber.slice(-4),
        p_country_code: countryCode,
        p_document_ids: documentIds,
        p_request_id: requestId,
      });
      if (error || !data?.[0]) throw new Error(`kyc_submit_failed:${error?.code ?? 'no_result'}`);
      return respond(200, { ...data[0], requestId });
    }
    if (body.action === 'upsert_bank') {
      const bankCode = body.bankCode?.trim().toUpperCase();
      const accountNumber = body.accountNumber?.replace(/\s+/gu, '');
      const accountHolder = body.accountHolder?.trim();
      if (!bankCode || !/^[A-Z0-9_-]{2,32}$/u.test(bankCode) || !accountNumber || !/^\d{4,34}$/u.test(accountNumber) || !accountHolder || accountHolder.length > 160) return respond(400, { error: 'invalid_bank_submission' });
      if (body.bankAccountId != null && !validUuid(body.bankAccountId)) return respond(400, { error: 'invalid_bank_account_id' });
      const { data, error } = await server.rpc('server_upsert_bank_account', {
        p_user_id: userData.user.id,
        p_bank_account_id: body.bankAccountId ?? null,
        p_bank_code: bankCode,
        p_account_number_ciphertext: await encryptText(encryptionKey, accountNumber),
        p_account_number_last4: accountNumber.slice(-4),
        p_account_holder_ciphertext: await encryptText(encryptionKey, accountHolder),
        p_is_default: body.isDefault ?? false,
        p_request_id: requestId,
      });
      if (error || !data?.[0]) throw new Error(`bank_submit_failed:${error?.code ?? 'no_result'}`);
      return respond(200, { ...data[0], requestId });
    }
    return respond(400, { error: 'unsupported_action' });
  } catch (error) {
    console.error(error instanceof Error ? error.message.split(':')[0] : 'payout_profile_submit_failed');
    return respond(500, { error: 'payout_profile_submit_failed' });
  }
});
