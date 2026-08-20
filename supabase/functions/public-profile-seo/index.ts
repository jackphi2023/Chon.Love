import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

function jsonResponse(status: number, body: Record<string, unknown>, head = false) {
  return new Response(head ? null : JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': status === 200 ? 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600' : 'public, max-age=30',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (!['GET', 'HEAD'].includes(request.method)) return jsonResponse(405, { error: 'method_not_allowed' });

  const code = (new URL(request.url).searchParams.get('code') ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{6}$/u.test(code)) return jsonResponse(400, { error: 'invalid_profile_code' }, request.method === 'HEAD');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return jsonResponse(500, { error: 'server_configuration_missing' }, request.method === 'HEAD');

  // This endpoint intentionally uses the anon capability because the underlying
  // RPC is already the audited public projection. Never elevate SEO crawlers to
  // service-role privileges merely to read public sharing metadata.
  const server = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await server.rpc('get_public_chon_profile', { p_code: code });
  const profile = Array.isArray(data) ? data[0] : null;
  if (error || !profile?.public_profile_code || !profile?.display_name) {
    return jsonResponse(404, { error: 'public_profile_not_found' }, request.method === 'HEAD');
  }

  const avatarUrl = profile.avatar_available
    ? `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/public-profile-avatar?code=${encodeURIComponent(code)}`
    : null;

  return jsonResponse(200, {
    public_profile_code: profile.public_profile_code,
    display_name: profile.display_name,
    avatar_url: avatarUrl,
  }, request.method === 'HEAD');
});