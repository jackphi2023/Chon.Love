import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.57.4';

type Body = { action?: unknown; status?: unknown; priority?: unknown; limit?: unknown; offset?: unknown; reportId?: unknown; resolutionCode?: unknown; requestId?: unknown };
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const headers = { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };
function respond(status: number, body: Record<string, unknown>) { return new Response(JSON.stringify(body), { status, headers }); }
function safeString(value: unknown, max = 120) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function validUuid(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value); }
function integer(value: unknown, fallback: number, min: number, max: number) { return typeof value === 'number' && Number.isInteger(value) ? Math.min(Math.max(value, min), max) : fallback; }
function safeError(message?: string) {
  for (const code of ['required_admin_role_missing','invalid_pagination','invalid_report_status','invalid_report_priority','invalid_report_admin_action','request_id_required','resolution_code_required','report_not_found']) if (message?.includes(code)) return code;
  return 'report_admin_operation_failed';
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: 'method_not_allowed' });
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return respond(401, { error: 'authentication_required' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL'); const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return respond(500, { error: 'supabase_server_configuration_missing' });
  let body: Body; try { body = await request.json() as Body; } catch { return respond(400, { error: 'invalid_json' }); }
  const server = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await server.auth.getUser(authorization.slice(7));
  if (userError || !userData.user) return respond(401, { error: 'invalid_access_token' });
  const actorId = userData.user.id; const action = safeString(body.action, 32) || 'list';
  try {
    if (action === 'list') {
      const status = safeString(body.status, 32); const priority = safeString(body.priority, 16);
      const { data, error } = await server.rpc('admin_list_luxy_reports', { p_actor_user_id: actorId, p_status: status || null, p_priority: priority || null, p_limit: integer(body.limit, 100, 1, 200), p_offset: integer(body.offset, 0, 0, 100000) });
      if (error) return respond(error.code === '42501' ? 403 : 400, { error: safeError(error.message) });
      return respond(200, { items: data ?? [] });
    }
    if (action === 'start_review' || action === 'resolve' || action === 'dismiss') {
      if (!validUuid(body.reportId) || !validUuid(body.requestId)) return respond(400, { error: 'report_and_request_id_required' });
      const resolutionCode = safeString(body.resolutionCode, 64);
      const { data, error } = await server.rpc('admin_review_luxy_report', { p_actor_user_id: actorId, p_report_id: body.reportId, p_action: action, p_resolution_code: resolutionCode || null, p_request_id: body.requestId });
      if (error) return respond(error.code === '42501' ? 403 : 400, { error: safeError(error.message) });
      return respond(200, { status: data, requestId: body.requestId });
    }
    return respond(400, { error: 'unsupported_action' });
  } catch { return respond(500, { error: 'report_admin_unexpected_error' }); }
});
