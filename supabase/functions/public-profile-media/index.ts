import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.57.4';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' };
function response(status: number, body: string) { return new Response(body, { status, headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=60, s-maxage=300', 'X-Content-Type-Options': 'nosniff' } }); }

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'GET') return response(405, 'method_not_allowed');
  const url = new URL(request.url);
  const code = (url.searchParams.get('code') ?? '').trim().toLowerCase();
  const mediaId = (url.searchParams.get('media') ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{6}$/u.test(code) || !/^[0-9a-f-]{36}$/u.test(mediaId)) return response(400, 'invalid_request');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return response(500, 'server_configuration_missing');
  const server = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: publicRows, error: publicError } = await server.rpc('get_public_chon_profile_v2', { p_code: code });
  if (publicError || !publicRows?.[0]?.public_profile_code) return response(404, 'profile_media_not_available');
  const allowedIds = new Set<string>(publicRows[0].public_media_ids ?? []);
  if (!allowedIds.has(mediaId)) return response(404, 'profile_media_not_available');

  const { data: profile, error: profileError } = await server.from('profiles').select('id').eq('public_profile_code', code).maybeSingle();
  if (profileError || !profile) return response(404, 'profile_media_not_available');
  const { data: media, error: mediaError } = await server.from('media_assets')
    .select('storage_bucket,storage_path,mime_type')
    .eq('id', mediaId).eq('owner_id', profile.id).eq('visibility', 'public').eq('moderation_status', 'approved')
    .is('deleted_at', null).not('uploaded_at', 'is', null).maybeSingle();
  if (mediaError || !media) return response(404, 'profile_media_not_available');

  const { data: blob, error: downloadError } = await server.storage.from(media.storage_bucket).download(media.storage_path);
  if (downloadError || !blob) return response(404, 'profile_media_not_available');
  const bytes = await blob.arrayBuffer();
  return new Response(bytes, { status: 200, headers: { ...corsHeaders, 'Content-Type': media.mime_type || blob.type || 'image/jpeg', 'Content-Length': String(bytes.byteLength), 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' } });
});
