import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.57.4';

type Body = { action?: unknown; windowMinutes?: unknown; requestId?: unknown };
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const headers = { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };

function respond(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers });
}
function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}
function integer(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/u.test(value)) { const parsed = Number(value); return Number.isSafeInteger(parsed) ? parsed : null; }
  return null;
}
function safeError(message: string | undefined): string {
  for (const code of ['required_admin_role_missing', 'invalid_observability_window']) {
    if (message?.includes(code)) return code;
  }
  return 'runtime_observability_admin_failed';
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: 'method_not_allowed' });
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return respond(401, { error: 'authentication_required' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serverKey) return respond(500, { error: 'supabase_server_configuration_missing' });
  let body: Body;
  try { body = await request.json() as Body; } catch { return respond(400, { error: 'invalid_json' }); }
  const requestId = validUuid(body.requestId) ? body.requestId : crypto.randomUUID();
  if (body.action !== 'snapshot') return respond(400, { error: 'unsupported_action', requestId });
  const windowMinutes = integer(body.windowMinutes) ?? 60;
  const server = createClient(supabaseUrl, serverKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await server.auth.getUser(authorization.slice(7));
  if (userError || !userData.user) return respond(401, { error: 'invalid_access_token', requestId });
  try {
    const { data, error } = await server.rpc('admin_runtime_observability_snapshot', {
      p_actor_user_id: userData.user.id,
      p_window_minutes: windowMinutes,
    });
    if (error) return respond(400, { error: safeError(error.message), requestId });
    return respond(200, { items: data ?? [], requestId });
  } catch {
    console.error('runtime_observability_admin_failed');
    return respond(500, { error: 'runtime_observability_admin_failed', requestId });
  }
});
