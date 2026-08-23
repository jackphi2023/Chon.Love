import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2.57.4';

export type LocalWorkerMedia = {
  id: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
};

export type LocalWorkerState = {
  url: string | null;
  secret: string | null;
  missing: string[];
  configured: boolean;
};

export type LocalWorkerProfileScore = {
  mediaId: string;
  cosineSimilarity: number;
  faceCount: number | null;
  selectedFaceConfidence: number | null;
};

export type LocalWorkerComparison = {
  requestId: string;
  engine: string;
  version: string | null;
  profileScores: LocalWorkerProfileScore[];
  errors: string[];
  workerElapsedMs: number | null;
};

const SIGNED_URL_TTL_SECONDS = 180;
const WORKER_TIMEOUT_MS = 30_000;
const EXPECTED_ENGINE = 'opencv_yunet_sface_cpu';

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return bytesToHex(new Uint8Array(signature));
}

function workerUrlAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) return false;
    if (parsed.protocol === 'https:') return true;
    return Deno.env.get('FACE_WORKER_ALLOW_HTTP_FOR_TESTS') === 'true'
      && parsed.protocol === 'http:'
      && ['127.0.0.1', 'localhost', 'host.docker.internal'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

export function localWorkerState(): LocalWorkerState {
  const rawUrl = Deno.env.get('FACE_WORKER_URL')?.trim() ?? '';
  const secret = Deno.env.get('FACE_WORKER_HMAC_SECRET')?.trim() ?? '';
  const missing: string[] = [];
  if (!rawUrl) missing.push('FACE_WORKER_URL');
  else if (!workerUrlAllowed(rawUrl)) missing.push('FACE_WORKER_URL_HTTPS_REQUIRED');
  if (!secret) missing.push('FACE_WORKER_HMAC_SECRET');
  return {
    url: rawUrl && workerUrlAllowed(rawUrl) ? rawUrl.replace(/\/+$/u, '') : null,
    secret: secret || null,
    missing,
    configured: missing.length === 0,
  };
}

async function signedUrl(
  server: SupabaseClient,
  bucket: string,
  path: string,
): Promise<string> {
  const { data, error } = await server.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw new Error('local_worker_signed_url_failed');
  return data.signedUrl;
}

function parseProfileScores(value: unknown, expectedIds: Set<string>): LocalWorkerProfileScore[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: LocalWorkerProfileScore[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const mediaId = typeof row.mediaId === 'string' ? row.mediaId : '';
    const cosine = finiteNumber(row.cosineSimilarity);
    if (!mediaId || cosine == null || !expectedIds.has(mediaId) || seen.has(mediaId)) continue;
    if (cosine < -1 || cosine > 1) continue;
    seen.add(mediaId);
    result.push({
      mediaId,
      cosineSimilarity: cosine,
      faceCount: finiteNumber(row.faceCount),
      selectedFaceConfidence: finiteNumber(row.selectedFaceConfidence),
    });
  }
  return result;
}

export async function compareWithLocalWorker(
  server: SupabaseClient,
  selfieStoragePath: string,
  media: LocalWorkerMedia[],
  requestId: string,
): Promise<LocalWorkerComparison> {
  const state = localWorkerState();
  if (!state.configured || !state.url || !state.secret) throw new Error('local_worker_not_configured');

  const selfieUrl = await signedUrl(server, 'member-verification', selfieStoragePath);
  const profiles = await Promise.all(media.map(async (item) => ({
    id: item.id,
    url: await signedUrl(server, item.storage_bucket, item.storage_path),
    mimeType: item.mime_type ?? 'application/octet-stream',
  })));
  const body = JSON.stringify({
    requestId,
    selfie: { id: 'selfie', url: selfieUrl, mimeType: 'image/jpeg' },
    profiles,
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await hmacSha256Hex(state.secret, `${timestamp}.${requestId}.${body}`);

  const response = await fetch(`${state.url}/v1/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-chon-timestamp': timestamp,
      'x-chon-request-id': requestId,
      'x-chon-signature': signature,
    },
    body,
    signal: AbortSignal.timeout(WORKER_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`local_worker_http_${response.status}`);

  const payload = await response.json() as Record<string, unknown>;
  if (payload.requestId !== requestId) throw new Error('local_worker_request_id_mismatch');
  if (payload.engine !== EXPECTED_ENGINE) throw new Error('local_worker_engine_mismatch');
  const expectedIds = new Set(media.map((item) => item.id));
  const profileScores = parseProfileScores(payload.profileScores, expectedIds);
  const errors = Array.isArray(payload.errors)
    ? payload.errors.filter((item): item is string => typeof item === 'string').slice(0, 10)
    : [];

  return {
    requestId,
    engine: EXPECTED_ENGINE,
    version: typeof payload.version === 'string' ? payload.version : null,
    profileScores,
    errors,
    workerElapsedMs: finiteNumber(payload.elapsedMs),
  };
}
