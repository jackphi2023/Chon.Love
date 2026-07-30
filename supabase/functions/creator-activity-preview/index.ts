import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import { ImageMagick, initializeImageMagick } from "npm:@imagemagick/magick-wasm@0.0.37";

const wasmBytes = await Deno.readFile(
  new URL("magick.wasm", import.meta.resolve("npm:@imagemagick/magick-wasm@0.0.37")),
);
await initializeImageMagick(wasmBytes);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "authentication_required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "server_not_configured" }, 500);

  let payload: { post_id?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!payload.post_id) return json({ error: "post_id_required" }, 400);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: sourceRows, error: sourceError } = await userClient.rpc(
    "prepare_creator_activity_preview",
    { p_post_id: payload.post_id },
  );
  const source = sourceRows?.[0];
  if (sourceError || !source) return json({ error: "preview_source_not_available" }, 403);

  try {
    const { data: original, error: downloadError } = await adminClient.storage
      .from(source.storage_bucket)
      .download(source.storage_path);
    if (downloadError || !original) throw new Error("preview_download_failed");

    const input = new Uint8Array(await original.arrayBuffer());
    const output = ImageMagick.read(input, (image): Uint8Array => {
      image.resize(64, 64);
      image.blur(24, 6);
      return image.write((bytes) => bytes);
    });

    const previewPath = `${source.owner_id}/${payload.post_id}/preview.png`;
    const { error: uploadError } = await adminClient.storage
      .from("activity-previews")
      .upload(previewPath, output, {
        contentType: "image/png",
        cacheControl: "60",
        upsert: true,
      });
    if (uploadError) throw new Error("preview_upload_failed");

    const { error: updateError } = await adminClient
      .from("creator_post_media")
      .update({
        preview_bucket: "activity-previews",
        preview_path: previewPath,
        preview_width: 64,
        preview_height: 64,
        preview_status: "ready",
        preview_error_code: null,
      })
      .eq("post_id", payload.post_id)
      .eq("media_id", source.media_id);
    if (updateError) throw new Error("preview_state_update_failed");

    return json({ post_id: payload.post_id, status: "ready" });
  } catch (error) {
    await adminClient
      .from("creator_post_media")
      .update({ preview_status: "failed", preview_error_code: "preview_generation_failed" })
      .eq("post_id", payload.post_id);
    console.error("creator_activity_preview_failed", {
      post_id: payload.post_id,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return json({ error: "preview_generation_failed" }, 500);
  }
});
