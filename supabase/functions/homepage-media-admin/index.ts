import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const responseHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
};

const allowedFields = new Set([
  'hero_slider_desktop',
  'hero_slider_mobile',
  'section2_left_image_url',
  'section2_right_image_url',
  'section3_background_image_url',
  'section4_image_url',
]);
const extensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

type Body = {
  action?: unknown;
  field?: unknown;
  contentType?: unknown;
  path?: unknown;
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function safeString(value: unknown, max = 300): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: 'method_not_allowed' });

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return respond(401, { error: 'authentication_required' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return respond(500, { error: 'supabase_server_configuration_missing' });
  }

  const token = authorization.slice(7);
  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await service.auth.getUser(token);
  if (userError || !userData.user) return respond(401, { error: 'invalid_access_token' });

  // Authorize with the caller JWT, not the service-role client. This keeps the
  // existing public.is_super_admin() function as the single source of truth.
  const caller = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: isAdmin, error: adminError } = await caller.rpc('is_super_admin');
  if (adminError || isAdmin !== true) return respond(403, { error: 'super_admin_required' });

  let body: Body;
  try {
    body = await request.json() as Body;
  } catch {
    return respond(400, { error: 'invalid_json' });
  }

  const action = safeString(body.action, 40);
  const actorId = userData.user.id;
  const bucket = service.storage.from('homepage-public');

  if (action === 'create_upload') {
    const field = safeString(body.field, 80);
    const contentType = safeString(body.contentType, 80).toLowerCase();
    const extension = extensions[contentType];
    if (!allowedFields.has(field) || !extension) {
      return respond(400, { error: 'invalid_homepage_image_request' });
    }

    const path = `${actorId}/homepage/${field}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { data, error } = await bucket.createSignedUploadUrl(path, { upsert: false });
    if (error || !data?.token) return respond(400, { error: 'signed_upload_creation_failed' });
    return respond(200, { path, token: data.token });
  }

  if (action === 'delete_upload') {
    const path = safeString(body.path, 500);
    const prefix = `${actorId}/homepage/`;
    if (!path.startsWith(prefix) || path.includes('..')) {
      return respond(400, { error: 'invalid_homepage_image_path' });
    }
    const { error } = await bucket.remove([path]);
    if (error) return respond(400, { error: 'homepage_image_cleanup_failed' });
    return respond(200, { deleted: true });
  }

  return respond(400, { error: 'unsupported_action' });
});