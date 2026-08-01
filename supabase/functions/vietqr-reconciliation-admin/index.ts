import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.57.4';

type JsonBody = Record<string, unknown> & { action?: string; requestId?: string };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };

function respond(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function requestId(value: unknown): string {
  return validUuid(value) ? value : crypto.randomUUID();
}

function integer(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/u.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeRpcError(message: string | undefined): string {
  const known = [
    'required_admin_role_missing',
    'vietqr_reconciliation_disabled',
    'vietqr_manual_settlement_disabled',
    'invalid_vietqr_provider',
    'invalid_bank_transaction_ref',
    'invalid_paid_amount',
    'invalid_transfer_content',
    'invalid_bank_transaction_time',
    'invalid_payload_sha256',
    'invalid_reconciliation_status',
    'invalid_reconciliation_action',
    'reconciliation_reason_required',
    'order_id_required',
    'vietqr_transaction_not_found',
    'vietqr_order_not_found',
    'vietqr_amount_mismatch',
    'vietqr_order_already_paid',
    'vietqr_transaction_already_final',
    'request_id_conflict',
  ];
  return known.find((code) => message?.includes(code)) ?? 'vietqr_reconciliation_admin_failed';
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: 'method_not_allowed' });

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return respond(401, { error: 'authentication_required' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serverKey) return respond(500, { error: 'supabase_server_configuration_missing' });

  let body: JsonBody;
  try {
    body = await request.json() as JsonBody;
  } catch {
    return respond(400, { error: 'invalid_json' });
  }

  const server = createClient(supabaseUrl, serverKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await server.auth.getUser(authorization.slice(7));
  if (userError || !userData.user) return respond(401, { error: 'invalid_access_token' });

  const actorId = userData.user.id;
  const rid = requestId(body.requestId);

  try {
    if (body.action === 'list') {
      const limit = integer(body.limit) ?? 100;
      const offset = integer(body.offset) ?? 0;
      const { data, error } = await server.rpc('admin_list_vietqr_reconciliation_queue', {
        p_actor_user_id: actorId,
        p_status: typeof body.status === 'string' && body.status.length > 0 ? body.status : null,
        p_limit: limit,
        p_offset: offset,
      });
      if (error) return respond(400, { error: safeRpcError(error.message), requestId: rid });
      return respond(200, { items: data ?? [], requestId: rid });
    }

    if (body.action === 'import') {
      const amountVnd = integer(body.amountVnd);
      if (!amountVnd || amountVnd <= 0) return respond(400, { error: 'invalid_paid_amount', requestId: rid });
      if (typeof body.provider !== 'string' || typeof body.transactionRef !== 'string' || typeof body.transferContent !== 'string') {
        return respond(400, { error: 'invalid_import_payload', requestId: rid });
      }
      const occurredAt = typeof body.occurredAt === 'string' ? body.occurredAt : new Date().toISOString();
      const payloadHash = typeof body.payloadSha256 === 'string' && body.payloadSha256.length > 0
        ? body.payloadSha256.toLowerCase()
        : await sha256Hex(JSON.stringify({
          provider: body.provider,
          transactionRef: body.transactionRef,
          amountVnd,
          transferContent: body.transferContent,
          occurredAt,
        }));
      const { data, error } = await server.rpc('admin_import_vietqr_bank_transaction', {
        p_actor_user_id: actorId,
        p_provider: body.provider,
        p_provider_transaction_ref: body.transactionRef,
        p_amount_vnd: amountVnd,
        p_transfer_content: body.transferContent,
        p_occurred_at: occurredAt,
        p_payload_sha256: payloadHash,
        p_request_id: rid,
      });
      if (error || !data?.[0]) return respond(400, { error: safeRpcError(error?.message), requestId: rid });
      return respond(200, { ...data[0], requestId: rid });
    }

    if (body.action === 'decide') {
      if (!validUuid(body.transactionId)) return respond(400, { error: 'invalid_transaction_id', requestId: rid });
      const { data, error } = await server.rpc('admin_decide_vietqr_reconciliation', {
        p_actor_user_id: actorId,
        p_transaction_id: body.transactionId,
        p_action: body.decision,
        p_order_id: validUuid(body.orderId) ? body.orderId : null,
        p_reason_code: typeof body.reasonCode === 'string' && body.reasonCode.length > 0 ? body.reasonCode : null,
        p_request_id: rid,
      });
      if (error || !data?.[0]) return respond(400, { error: safeRpcError(error?.message), requestId: rid });
      return respond(200, { ...data[0], requestId: rid });
    }

    return respond(400, { error: 'unsupported_action', requestId: rid });
  } catch (error) {
    console.error(error instanceof Error ? error.message.split(':')[0] : 'vietqr_reconciliation_admin_failed');
    return respond(500, { error: 'vietqr_reconciliation_admin_failed', requestId: rid });
  }
});
