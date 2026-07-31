import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.57.4';

type RequestBody = { action?: 'request' | 'cancel'; reason?: string; deletionRequestId?: string; requestId?: string };
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };
function respond(status: number, body: Record<string, unknown>): Response { return new Response(JSON.stringify(body), { status, headers: jsonHeaders }); }
function validUuid(value: string | undefined): value is string { return value != null && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value); }

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: 'method_not_allowed' });
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return respond(401, { error: 'authentication_required' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serverKey) return respond(500, { error: 'supabase_server_configuration_missing' });
  let body: RequestBody;
  try { body = await request.json() as RequestBody; } catch { return respond(400, { error: 'invalid_json' }); }
  const jwt = authorization.slice(7);
  try {
    const server = createClient(supabaseUrl, serverKey, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await server.auth.getUser(jwt);
    if (userError || !userData.user) return respond(401, { error: 'invalid_access_token' });
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const rid = validUuid(body.requestId) ? body.requestId : crypto.randomUUID();
    if (body.action === 'request') {
      const reason = body.reason?.trim() || null;
      if (reason && reason.length > 500) return respond(400, { error: 'deletion_reason_too_long' });
      const { data, error } = await userClient.rpc('request_account_deletion', { p_reason: reason, p_idempotency_key: rid });
      if (error || !data?.[0]) throw new Error(`request_deletion_failed:${error?.code ?? 'no_result'}`);
      const { error: signOutError } = await server.auth.admin.signOut(jwt, 'global');
      return respond(200, { ...data[0], requestId: rid, refreshSessionsRevoked: !signOutError, accessTokenExpiresNormally: true });
    }
    if (body.action === 'cancel') {
      if (!validUuid(body.deletionRequestId)) return respond(400, { error: 'invalid_deletion_request_id' });
      const { data, error } = await userClient.rpc('cancel_account_deletion', { p_deletion_request_id: body.deletionRequestId, p_request_id: rid });
      if (error || !data?.[0]) throw new Error(`cancel_deletion_failed:${error?.code ?? 'no_result'}`);
      return respond(200, { ...data[0], requestId: rid });
    }
    return respond(400, { error: 'unsupported_action' });
  } catch (error) {
    console.error(error instanceof Error ? error.message.split(':')[0] : 'account_deletion_failed');
    return respond(500, { error: 'account_deletion_failed' });
  }
});
