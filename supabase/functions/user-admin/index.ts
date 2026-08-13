import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.57.4';

type Body = {
  action?: unknown;
  query?: unknown;
  status?: unknown;
  tier?: unknown;
  limit?: unknown;
  offset?: unknown;
  userId?: unknown;
  targetStatus?: unknown;
  hidden?: unknown;
  reason?: unknown;
  requestId?: unknown;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const headers = { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers });
}
function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}
function integer(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isInteger(value) ? Math.min(Math.max(value, min), max) : fallback;
}
function safeString(value: unknown, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function safeError(message?: string) {
  for (const code of ['required_admin_role_missing','invalid_pagination','invalid_profile_status','invalid_admin_profile_status','reason_and_request_id_required','cannot_suspend_self','inactive_user_cannot_be_unhidden','user_not_found']) {
    if (message?.includes(code)) return code;
  }
  return 'user_admin_operation_failed';
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: 'method_not_allowed' });

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return respond(401, { error: 'authentication_required' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return respond(500, { error: 'supabase_server_configuration_missing' });

  let body: Body;
  try { body = await request.json() as Body; } catch { return respond(400, { error: 'invalid_json' }); }
  const server = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await server.auth.getUser(authorization.slice(7));
  if (userError || !userData.user) return respond(401, { error: 'invalid_access_token' });
  const actorId = userData.user.id;
  const action = safeString(body.action, 32) || 'list';

  try {
    if (action === 'list') {
      const tier = safeString(body.tier, 16);
      const status = safeString(body.status, 32);
      const query = safeString(body.query, 120);
      const { data, error } = await server.rpc('admin_list_luxy_users', {
        p_actor_user_id: actorId,
        p_query: query || null,
        p_status: status || null,
        p_tier: tier || null,
        p_limit: integer(body.limit, 100, 1, 200),
        p_offset: integer(body.offset, 0, 0, 100000),
      });
      if (error) return respond(error.code === '42501' ? 403 : 400, { error: safeError(error.message) });
      return respond(200, { items: data ?? [] });
    }

    if (action === 'detail') {
      if (!validUuid(body.userId)) return respond(400, { error: 'invalid_user_id' });
      const { data, error } = await server.rpc('admin_get_luxy_user_detail', { p_actor_user_id: actorId, p_user_id: body.userId });
      if (error) return respond(error.code === '42501' ? 403 : 400, { error: safeError(error.message) });
      return respond(200, { item: data });
    }

    if (action === 'status') {
      if (!validUuid(body.userId) || !validUuid(body.requestId)) return respond(400, { error: 'user_and_request_id_required' });
      const { data, error } = await server.rpc('admin_set_luxy_user_status', {
        p_actor_user_id: actorId,
        p_user_id: body.userId,
        p_status: safeString(body.targetStatus, 32),
        p_reason: safeString(body.reason, 300),
        p_request_id: body.requestId,
      });
      if (error) return respond(error.code === '42501' ? 403 : 400, { error: safeError(error.message) });
      return respond(200, { status: data, requestId: body.requestId });
    }

    if (action === 'discovery') {
      if (!validUuid(body.userId) || !validUuid(body.requestId) || typeof body.hidden !== 'boolean') return respond(400, { error: 'invalid_discovery_request' });
      const { data, error } = await server.rpc('admin_set_luxy_user_discovery', {
        p_actor_user_id: actorId,
        p_user_id: body.userId,
        p_hidden: body.hidden,
        p_reason: safeString(body.reason, 300),
        p_request_id: body.requestId,
      });
      if (error) return respond(error.code === '42501' ? 403 : 400, { error: safeError(error.message) });
      return respond(200, { discoveryEnabled: data, requestId: body.requestId });
    }

    return respond(400, { error: 'unsupported_action' });
  } catch {
    return respond(500, { error: 'user_admin_unexpected_error' });
  }
});
