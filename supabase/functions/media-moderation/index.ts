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

type ModerationAction = "approve" | "reject" | "quarantine" | "restore" | "delete";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let copied: { bucket: string; path: string } | null = null;
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
    const { data: canModerate, error: roleError } = await userClient.rpc("can_moderate_content");
    if (roleError || canModerate !== true) return json({ error: "moderator_role_required" }, 403);

    const body = await req.json() as {
      mediaId?: string;
      action?: ModerationAction;
      reasonCode?: string;
      notes?: string | null;
      requestId?: string;
    };
    if (!body.mediaId || !/^[0-9a-f-]{36}$/i.test(body.mediaId)) return json({ error: "invalid_media_id" }, 400);
    if (!body.action || !["approve", "reject", "quarantine", "restore", "delete"].includes(body.action)) return json({ error: "invalid_action" }, 400);
    if (!body.reasonCode || !/^[a-z][a-z0-9_]{1,63}$/.test(body.reasonCode)) return json({ error: "invalid_reason_code" }, 400);
    const requestId = body.requestId && /^[0-9a-f-]{36}$/i.test(body.requestId) ? body.requestId : crypto.randomUUID();

    const { data: media, error: mediaError } = await adminClient
      .from("media_assets")
      .select("id,owner_id,storage_bucket,storage_path,mime_type,moderation_status,visibility,deleted_at")
      .eq("id", body.mediaId)
      .maybeSingle();
    if (mediaError || !media) return json({ error: "media_not_found" }, 404);

    let destinationBucket: string | null = null;
    let destinationPath: string | null = null;

    if (body.action === "approve") {
      if (!["pending_review", "quarantined"].includes(media.moderation_status) || media.storage_bucket !== "pending-media") {
        if (media.moderation_status === "approved") return json({ mediaId: media.id, moderationStatus: media.moderation_status, requestId });
        return json({ error: "media_not_approvable" }, 409);
      }
      const extension = media.storage_path.split(".").pop()?.toLowerCase();
      if (!extension || !["jpg", "png", "webp"].includes(extension)) return json({ error: "unsupported_media_extension" }, 400);
      destinationBucket = "profile-media";
      destinationPath = `${media.owner_id}/${media.id}/approved.${extension}`;

      const { data: source, error: downloadError } = await adminClient.storage.from(media.storage_bucket).download(media.storage_path);
      if (downloadError || !source) return json({ error: "source_media_unavailable" }, 409);

      await adminClient.storage.from(destinationBucket).remove([destinationPath]);
      const { error: uploadError } = await adminClient.storage.from(destinationBucket).upload(destinationPath, source, {
        contentType: media.mime_type,
        cacheControl: "300",
        upsert: false,
      });
      if (uploadError) return json({ error: "approved_copy_failed" }, 500);
      copied = { bucket: destinationBucket, path: destinationPath };
    }

    const { data: moderated, error: moderationError } = await userClient.rpc("moderate_media", {
      p_media_id: media.id,
      p_action: body.action,
      p_reason_code: body.reasonCode,
      ...(body.notes == null ? {} : { p_notes: body.notes }),
      ...(destinationBucket ? { p_destination_bucket: destinationBucket } : {}),
      ...(destinationPath ? { p_destination_path: destinationPath } : {}),
      p_request_id: requestId,
    });
    if (moderationError) {
      if (copied) await adminClient.storage.from(copied.bucket).remove([copied.path]);
      return json({ error: "moderation_failed" }, 409);
    }

    if (body.action === "approve" || body.action === "delete") {
      await adminClient.storage.from(media.storage_bucket).remove([media.storage_path]);
    }

    return json({ mediaId: moderated.id, moderationStatus: moderated.moderation_status, requestId });
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
});
