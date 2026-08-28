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
  reasonCode?: unknown;
  reviewAction?: unknown;
  requestId?: unknown;
};

type AdminMediaRow = {
  id: string;
  storage_bucket: string;
  storage_path: string;
  media_type: string;
  mime_type: string;
  visibility: string;
  moderation_status: string;
  moderation_reason_code: string | null;
  uploaded_at: string | null;
  created_at: string;
  width: number | null;
  height: number | null;
};

type AdminMediaItem = Omit<AdminMediaRow, 'storage_bucket' | 'storage_path'> & {
  signed_url: string | null;
};

type AdminSelfieItem = {
  signed_url: string | null;
  created_at: string | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const headers = { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };
const SIGNED_URL_TTL_SECONDS = 10 * 60;
const VERIFICATION_BUCKET = 'member-verification';

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
  for (const code of [
    'required_admin_role_missing',
    'invalid_pagination',
    'invalid_profile_status',
    'invalid_admin_profile_status',
    'reason_and_request_id_required',
    'cannot_suspend_self',
    'inactive_user_cannot_be_unhidden',
    'user_not_found',
    'user_id_required',
    'request_id_required',
    'invalid_listing_review_action',
    'invalid_reason_code',
    'listing_verification_not_found',
    'listing_verification_not_reviewable',
  ]) {
    if (message?.includes(code)) return code;
  }
  return 'user_admin_operation_failed';
}

async function createSignedUrl(
  server: ReturnType<typeof createClient>,
  bucket: string,
  path: string,
): Promise<string | null> {
  const { data, error } = await server.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return error ? null : data.signedUrl;
}

async function loadAllUserMedia(
  server: ReturnType<typeof createClient>,
  userId: string,
): Promise<AdminMediaItem[]> {
  const { data, error } = await server
    .from('media_assets')
    .select('id,storage_bucket,storage_path,media_type,mime_type,visibility,moderation_status,moderation_reason_code,uploaded_at,created_at,width,height')
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .not('uploaded_at', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return Promise.all(((data ?? []) as AdminMediaRow[]).map(async ({ storage_bucket, storage_path, ...item }) => ({
    ...item,
    signed_url: await createSignedUrl(server, storage_bucket, storage_path),
  })));
}

async function loadVerificationSelfies(
  server: ReturnType<typeof createClient>,
  userId: string,
): Promise<AdminSelfieItem[]> {
  const bucket = server.storage.from(VERIFICATION_BUCKET);
  const { data: rootEntries, error: rootError } = await bucket.list(userId, { limit: 100 });
  if (rootError) throw rootError;

  const sessionNames = (rootEntries ?? [])
    .map((entry) => entry.name)
    .filter((name): name is string => validUuid(name));

  const sessions = await Promise.all(sessionNames.map(async (sessionName) => {
    const prefix = `${userId}/${sessionName}`;
    const { data: files, error } = await bucket.list(prefix, { limit: 100 });
    if (error) return [] as AdminSelfieItem[];

    return Promise.all((files ?? [])
      .filter((file) => file.name.toLowerCase() === 'selfie.jpg')
      .map(async (file) => ({
        signed_url: await createSignedUrl(server, VERIFICATION_BUCKET, `${prefix}/${file.name}`),
        created_at: file.created_at ?? null,
      })));
  }));

  return sessions
    .flat()
    .sort((left, right) => (right.created_at ?? '').localeCompare(left.created_at ?? ''));
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

    if (action === 'listing_queue') {
      const { data, error } = await server.rpc('admin_list_member_listing_verifications', {
        p_actor_user_id: actorId,
        p_limit: integer(body.limit, 100, 1, 200),
        p_offset: integer(body.offset, 0, 0, 5000),
      });
      if (error) return respond(error.code === '42501' ? 403 : 400, { error: safeError(error.message) });
      return respond(200, { items: data ?? [] });
    }

    if (action === 'listing_review') {
      if (!validUuid(body.userId) || !validUuid(body.requestId)) {
        return respond(400, { error: 'user_and_request_id_required' });
      }
      const reviewAction = safeString(body.reviewAction, 16);
      if (!['approve', 'reject'].includes(reviewAction)) return respond(400, { error: 'invalid_listing_review_action' });
      const reasonCode = safeString(body.reasonCode, 64) || (reviewAction === 'approve' ? 'admin_approved' : 'admin_rejected');
      if (!/^[a-z][a-z0-9_]{1,63}$/u.test(reasonCode)) return respond(400, { error: 'invalid_reason_code' });

      const { data, error } = await server.rpc('admin_review_member_listing_verification', {
        p_actor_user_id: actorId,
        p_user_id: body.userId,
        p_action: reviewAction,
        p_reason_code: reasonCode,
        p_request_id: body.requestId,
      });
      if (error) return respond(error.code === '42501' ? 403 : 400, { error: safeError(error.message) });
      return respond(200, { item: Array.isArray(data) ? (data[0] ?? null) : data, requestId: body.requestId });
    }

    if (action === 'detail') {
      if (!validUuid(body.userId)) return respond(400, { error: 'invalid_user_id' });
      const { data, error } = await server.rpc('admin_get_luxy_user_detail', { p_actor_user_id: actorId, p_user_id: body.userId });
      if (error) return respond(error.code === '42501' ? 403 : 400, { error: safeError(error.message) });

      // The detail RPC above is the authorization barrier. Only after the caller is
      // confirmed as super_admin do we use service-role access to sign private/hidden
      // profile media and verification selfies. Storage RLS remains unchanged.
      const [media, verificationSelfies] = await Promise.all([
        loadAllUserMedia(server, body.userId),
        loadVerificationSelfies(server, body.userId),
      ]);
      const profile = data && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, unknown>).profile
        : null;
      const publicProfileCode = profile && typeof profile === 'object' && !Array.isArray(profile)
        ? safeString((profile as Record<string, unknown>).public_profile_code, 16)
        : '';
      const shareProfileUrl = publicProfileCode
        ? `https://www.chon.love/thanh-vien/id-${encodeURIComponent(publicProfileCode)}`
        : null;

      return respond(200, {
        item: {
          ...(data as Record<string, unknown>),
          media,
          verification_selfies: verificationSelfies,
          share_profile_url: shareProfileUrl,
        },
      });
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
