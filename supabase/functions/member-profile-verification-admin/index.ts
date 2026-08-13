import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.57.4';

type JsonBody = {
  action?: string;
  userId?: string;
  kind?: string;
  decision?: string;
  reasonCode?: string;
  requestId?: string;
  limit?: number;
  offset?: number;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
};

function respond(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function pageLimit(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) ? Math.min(Math.max(value, 1), 200) : 100;
}

function pageOffset(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) ? Math.max(value, 0) : 0;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: 'method_not_allowed' });

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return respond(401, { error: 'authentication_required' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return respond(500, { error: 'supabase_server_configuration_missing' });

  let body: JsonBody;
  try {
    body = await request.json() as JsonBody;
  } catch {
    return respond(400, { error: 'invalid_json' });
  }

  const server = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const token = authorization.slice(7);
  const { data: userData, error: userError } = await server.auth.getUser(token);
  if (userError || !userData.user) return respond(401, { error: 'invalid_access_token' });
  const actorId = userData.user.id;
  const action = body.action ?? 'list';

  try {
    if (action === 'list') {
      const { data, error } = await server.rpc('admin_list_member_profile_verifications', {
        p_actor_user_id: actorId,
        p_limit: pageLimit(body.limit),
        p_offset: pageOffset(body.offset),
      });
      if (error) return respond(error.code === '42501' ? 403 : 500, { error: 'admin_profile_verification_list_failed' });
      return respond(200, { items: data ?? [] });
    }

    if (action === 'detail') {
      if (!validUuid(body.userId)) return respond(400, { error: 'invalid_user_id' });
      const { data, error } = await server.rpc('admin_get_member_profile_verification_detail', {
        p_actor_user_id: actorId,
        p_user_id: body.userId,
      });
      if (error) return respond(error.code === '42501' ? 403 : 500, { error: 'admin_profile_verification_detail_failed' });
      const item = data?.[0];
      if (!item) return respond(404, { error: 'profile_verification_not_found' });

      let identityFrontUrl: string | null = null;
      let identityBackUrl: string | null = null;
      if (item.identity_front_bucket && item.identity_front_path) {
        const { data: signed } = await server.storage.from(item.identity_front_bucket).createSignedUrl(item.identity_front_path, 60);
        identityFrontUrl = signed?.signedUrl ?? null;
      }
      if (item.identity_back_bucket && item.identity_back_path) {
        const { data: signed } = await server.storage.from(item.identity_back_bucket).createSignedUrl(item.identity_back_path, 60);
        identityBackUrl = signed?.signedUrl ?? null;
      }
      return respond(200, {
        item: {
          user_id: item.user_id,
          username: item.username,
          display_name: item.display_name,
          identity_status: item.identity_status,
          identity_submitted_at: item.identity_submitted_at,
          linkedin_status: item.linkedin_status,
          linkedin_profile_url: item.linkedin_profile_url,
          linkedin_submitted_at: item.linkedin_submitted_at,
        },
        identityFrontUrl,
        identityBackUrl,
        expiresInSeconds: 60,
      });
    }

    if (action === 'review') {
      if (!validUuid(body.userId)) return respond(400, { error: 'invalid_user_id' });
      if (body.kind !== 'identity' && body.kind !== 'linkedin') return respond(400, { error: 'invalid_verification_kind' });
      if (body.decision !== 'approve' && body.decision !== 'reject') return respond(400, { error: 'invalid_verification_decision' });
      const reasonCode = typeof body.reasonCode === 'string' && /^[a-z][a-z0-9_]{1,63}$/u.test(body.reasonCode)
        ? body.reasonCode
        : body.decision === 'approve' ? 'admin_verified' : 'admin_rejected';
      const requestId = validUuid(body.requestId) ? body.requestId : crypto.randomUUID();
      const { data, error } = await server.rpc('admin_review_member_profile_verification', {
        p_actor_user_id: actorId,
        p_user_id: body.userId,
        p_kind: body.kind,
        p_decision: body.decision,
        p_reason_code: reasonCode,
        p_request_id: requestId,
      });
      if (error) return respond(error.code === '42501' ? 403 : 500, { error: 'admin_profile_verification_review_failed' });
      return respond(200, { status: data, requestId });
    }

    return respond(400, { error: 'unsupported_action' });
  } catch {
    return respond(500, { error: 'member_profile_verification_admin_unexpected_error' });
  }
});
