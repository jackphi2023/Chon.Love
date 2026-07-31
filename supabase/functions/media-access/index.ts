import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
}

function readNamedKey(jsonName: string, legacyName: string): string {
  const raw = Deno.env.get(jsonName);
  if (raw) {
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }
  const legacy = Deno.env.get(legacyName);
  if (!legacy) throw new Error(`Missing ${jsonName}`);
  return legacy;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "authentication_required" }, 401);

    const token = authorization.slice("Bearer ".length);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");

    const userClient = createClient(supabaseUrl, readNamedKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(supabaseUrl, readNamedKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "authentication_required" }, 401);

    const body = await req.json() as { mediaId?: string; expiresIn?: number };
    if (!body.mediaId || !/^[0-9a-f-]{36}$/i.test(body.mediaId)) return json({ error: "invalid_media_id" }, 400);
    const expiresIn = Math.min(Math.max(Number.isFinite(body.expiresIn) ? Math.trunc(body.expiresIn!) : 120, 30), 300);

    const { data: authorized, error: accessError } = await userClient.rpc("can_view_media", { p_media_id: body.mediaId });
    if (accessError || authorized !== true) return json({ error: "media_not_available" }, 404);

    const { data: media, error: mediaError } = await adminClient
      .from("media_assets")
      .select("id,owner_id,storage_bucket,storage_path,visibility,moderation_status,deleted_at")
      .eq("id", body.mediaId)
      .maybeSingle();
    if (mediaError || !media) return json({ error: "media_not_available" }, 404);

    const isOwner = media.owner_id === userData.user.id;
    const ownerAllowedStatuses = new Set(["pending_upload", "pending_review", "approved", "rejected"]);
    if (
      media.visibility === "kyc" ||
      media.deleted_at !== null ||
      media.moderation_status === "deleted" ||
      media.moderation_status === "quarantined" ||
      (isOwner ? !ownerAllowedStatuses.has(media.moderation_status) : media.moderation_status !== "approved")
    ) return json({ error: "media_not_available" }, 404);

    const { data: signed, error: signedError } = await adminClient.storage
      .from(media.storage_bucket)
      .createSignedUrl(media.storage_path, expiresIn);
    if (signedError || !signed?.signedUrl) return json({ error: "media_access_failed" }, 500);

    return json({
      mediaId: media.id,
      signedUrl: signed.signedUrl,
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    });
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
});
