import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.57.4';

type JsonBody = {
  action?: string;
  status?: string;
  limit?: number;
  offset?: number;
  orderId?: string;
  bankTransactionRef?: string;
  paidAmountVnd?: number;
  reasonCode?: string;
  requestId?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function limit(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) ? Math.min(Math.max(value, 1), 200) : 100;
}
function offset(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) ? Math.max(value, 0) : 0;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: 'method_not_allowed' });

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return respond(401, { error: 'authentication_required' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return respond(500, { error: 'supabase_server_configuration_missing' });

  let body: JsonBody;
  try { body = await request.json() as JsonBody; }
  catch { return respond(400, { error: 'invalid_json' }); }

  const server = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const token = authorization.slice(7);
  const { data: userData, error: userError } = await server.auth.getUser(token);
  if (userError || !userData.user) return respond(401, { error: 'invalid_access_token' });
  const actorId = userData.user.id;
  const action = body.action ?? 'list';

  if (action === 'list') {
    const { data, error } = await server.rpc('admin_list_luxy_membership_orders', {
      p_actor_user_id: actorId,
      p_status: typeof body.status === 'string' ? body.status : 'awaiting_confirmation',
      p_limit: limit(body.limit),
      p_offset: offset(body.offset),
    });
    if (error) return respond(error.code === '42501' ? 403 : 500, { error: error.message });
    return respond(200, { items: data ?? [] });
  }

  if (action === 'approve') {
    if (!validUuid(body.orderId)) return respond(400, { error: 'invalid_order_id' });
    if (!validUuid(body.requestId)) return respond(400, { error: 'request_id_required' });
    if (typeof body.bankTransactionRef !== 'string' || body.bankTransactionRef.trim().length < 3) return respond(400, { error: 'bank_transaction_ref_required' });
    if (typeof body.paidAmountVnd !== 'number' || !Number.isInteger(body.paidAmountVnd) || body.paidAmountVnd <= 0) return respond(400, { error: 'invalid_paid_amount' });
    const { data, error } = await server.rpc('admin_approve_luxy_membership_order', {
      p_actor_user_id: actorId,
      p_order_id: body.orderId,
      p_bank_transaction_ref: body.bankTransactionRef.trim(),
      p_paid_amount_vnd: body.paidAmountVnd,
      p_verification_id: body.requestId,
    });
    if (error) return respond(error.code === '42501' ? 403 : 400, { error: error.message });
    return respond(200, { result: data?.[0] ?? null, requestId: body.requestId });
  }

  if (action === 'reject') {
    if (!validUuid(body.orderId)) return respond(400, { error: 'invalid_order_id' });
    const requestId = validUuid(body.requestId) ? body.requestId : crypto.randomUUID();
    const reasonCode = typeof body.reasonCode === 'string' ? body.reasonCode.trim().toLowerCase() : '';
    if (!/^[a-z][a-z0-9_]{1,63}$/u.test(reasonCode)) return respond(400, { error: 'reason_code_required' });
    const { data, error } = await server.rpc('admin_reject_luxy_membership_order', {
      p_actor_user_id: actorId,
      p_order_id: body.orderId,
      p_reason_code: reasonCode,
      p_request_id: requestId,
    });
    if (error) return respond(error.code === '42501' ? 403 : 400, { error: error.message });
    return respond(200, { result: data, requestId });
  }

  return respond(400, { error: 'unsupported_action' });
});
