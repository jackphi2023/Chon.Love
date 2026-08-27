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

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

type MediaModerationStatus = "pending_upload" | "pending_review" | "approved" | "rejected" | "quarantined" | "deleted";
type ModerationAction = "approve" | "reject" | "quarantine" | "restore" | "delete";
type RequestAction = "list" | ModerationAction;

const listableStatuses: MediaModerationStatus[] = [
  "pending_review",
  "approved",
  "rejected",
  "quarantined",
  "deleted",
];

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
      action?: RequestAction;
      moderationStatus?: MediaModerationStatus;
      limit?: number;
      offset?: number;
      reasonCode?: string;
      notes?: string | null;
      requestId?: string;
    };

    if (body.action === "list") {
      const moderationStatus = listableStatuses.includes(body.moderationStatus ?? "pending_review")
        ? (body.moderationStatus ?? "pending_review")
        : "pending_review";
      const limit = boundedInteger(body.limit, 50, 1, 50);
      const offset = boundedInteger(body.offset, 0, 0, 100_000);

      let query = adminClient
        .from("media_assets")
        .select(
          "id,owner_id,storage_bucket,storage_path,mime_type,moderation_status,moderation_reason_code,visibility,created_at,updated_at,uploaded_at,deleted_at",
          { count: "exact" },
        )
        .eq("moderation_status", moderationStatus)
        .order(moderationStatus === "pending_review" ? "created_at" : "updated_at", {
          ascending: moderationStatus === "pending_review",
        })
        .range(offset, offset + limit - 1);

      if (moderationStatus !== "deleted") query = query.is("deleted_at", null);
      const { data: mediaRows, error: mediaError, count } = await query;
      if (mediaError) return json({ error: "media_queue_unavailable" }, 409);

      const rows = mediaRows ?? [];
      const ownerIds = [...new Set(rows.map((row) => row.owner_id))];
      const mediaIds = rows.map((row) => row.id);

      const profileByOwner = new Map<string, { username: string | null; display_name: string | null }>();
      if (ownerIds.length) {
        const { data: profileRows, error: profileError } = await adminClient
          .from("profiles")
          .select("id,username,display_name")
          .in("id", ownerIds);
        if (profileError) return json({ error: "media_queue_profile_lookup_failed" }, 409);
        for (const profile of profileRows ?? []) {
          profileByOwner.set(profile.id, {
            username: profile.username == null ? null : String(profile.username),
            display_name: profile.display_name ?? null,
          });
        }
      }

      const emailEntries = await Promise.all(ownerIds.map(async (ownerId) => {
        try {
          const { data, error } = await adminClient.auth.admin.getUserById(ownerId);
          return [ownerId, error ? null : (data.user?.email ?? null)] as const;
        } catch {
          return [ownerId, null] as const;
        }
      }));
      const emailByOwner = new Map<string, string | null>(emailEntries);

      const caseByMedia = new Map<string, {
        id: string;
        status: string;
        priority: string;
        rule_codes: string[] | null;
        created_at: string;
      }>();
      if (mediaIds.length) {
        const { data: caseRows, error: caseError } = await adminClient
          .from("moderation_cases")
          .select("id,media_id,status,priority,rule_codes,created_at")
          .in("media_id", mediaIds)
          .order("created_at", { ascending: false });
        if (caseError) return json({ error: "media_queue_case_lookup_failed" }, 409);
        for (const moderationCase of caseRows ?? []) {
          if (moderationCase.media_id && !caseByMedia.has(moderationCase.media_id)) {
            caseByMedia.set(moderationCase.media_id, {
              id: moderationCase.id,
              status: moderationCase.status,
              priority: moderationCase.priority,
              rule_codes: moderationCase.rule_codes,
              created_at: moderationCase.created_at,
            });
          }
        }
      }

      const previewEntries = await Promise.all(rows.map(async (media) => {
        try {
          const { data, error } = await adminClient.storage
            .from(media.storage_bucket)
            .createSignedUrl(media.storage_path, 300);
          return [media.id, error ? null : (data?.signedUrl ?? null)] as const;
        } catch {
          return [media.id, null] as const;
        }
      }));
      const previewByMedia = new Map<string, string | null>(previewEntries);

      return json({
        items: rows.map((media) => {
          const profile = profileByOwner.get(media.owner_id);
          const moderationCase = caseByMedia.get(media.id);
          return {
            media_id: media.id,
            owner_id: media.owner_id,
            owner_email: emailByOwner.get(media.owner_id) ?? null,
            owner_username: profile?.username ?? null,
            owner_display_name: profile?.display_name ?? null,
            visibility: media.visibility,
            moderation_status: media.moderation_status,
            moderation_reason_code: media.moderation_reason_code,
            mime_type: media.mime_type,
            created_at: media.created_at,
            updated_at: media.updated_at,
            uploaded_at: media.uploaded_at,
            preview_url: previewByMedia.get(media.id) ?? null,
            preview_expires_in_seconds: 300,
            case_id: moderationCase?.id ?? null,
            case_status: moderationCase?.status ?? null,
            priority: moderationCase?.priority ?? "normal",
            rule_codes: moderationCase?.rule_codes ?? [],
            case_created_at: moderationCase?.created_at ?? null,
          };
        }),
        total_count: count ?? rows.length,
        moderation_status: moderationStatus,
        limit,
        offset,
      });
    }

    if (!body.mediaId || !/^[0-9a-f-]{36}$/i.test(body.mediaId)) return json({ error: "invalid_media_id" }, 400);
    if (!body.action || !["approve", "reject", "quarantine", "restore", "delete"].includes(body.action)) {
      return json({ error: "invalid_action" }, 400);
    }
    if (!body.reasonCode || !/^[a-z][a-z0-9_]{1,63}$/.test(body.reasonCode)) return json({ error: "invalid_reason_code" }, 400);
    const requestId = body.requestId && /^[0-9a-f-]{36}$/i.test(body.requestId) ? body.requestId : crypto.randomUUID();

    const action = body.action as ModerationAction;
    const { data: media, error: mediaError } = await adminClient
      .from("media_assets")
      .select("id,owner_id,storage_bucket,storage_path,mime_type,moderation_status,visibility,deleted_at")
      .eq("id", body.mediaId)
      .maybeSingle();
    if (mediaError || !media) return json({ error: "media_not_found" }, 404);

    let destinationBucket: string | null = null;
    let destinationPath: string | null = null;

    if (action === "approve") {
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
      p_action: action,
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

    if (action === "approve" || action === "delete") {
      await adminClient.storage.from(media.storage_bucket).remove([media.storage_path]);
    }

    return json({ mediaId: moderated.id, moderationStatus: moderated.moderation_status, requestId });
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
});
