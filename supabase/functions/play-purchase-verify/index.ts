import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.57.4';

type ProductLineItem = {
  productId?: string;
  consumptionState?: string;
  productOfferDetails?: { quantity?: number };
};

type ProductPurchaseV2 = {
  productLineItem?: ProductLineItem[];
  purchaseStateContext?: { purchaseState?: string };
  testPurchaseContext?: Record<string, unknown>;
  orderId?: string;
  obfuscatedExternalAccountId?: string;
  regionCode?: string;
  acknowledgementState?: string;
};

type VerifyBody = { purchaseToken?: string; googleProductId?: string; requestId?: string };

const jsonHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };
const encoder = new TextEncoder();

function respond(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function pemToBytes(pem: string): Uint8Array {
  const normalized = pem.replaceAll('\\n', '\n');
  const base64 = normalized.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/gu, '');
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function serviceAccountAccessToken(email: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(encoder.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = base64Url(encoder.encode(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })));
  const signingInput = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(signingInput)));
  const assertion = `${signingInput}.${base64Url(signature)}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const payload = await response.json() as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !payload.access_token) throw new Error(`google_oauth_failed:${payload.error ?? response.status}:${payload.error_description ?? ''}`);
  return payload.access_token;
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return respond(405, { error: 'method_not_allowed' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const serviceAccountEmail = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL');
  const serviceAccountPrivateKey = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY');
  const packageName = Deno.env.get('GOOGLE_PLAY_PACKAGE_NAME');
  if (!supabaseUrl || !serviceKey) return respond(500, { error: 'supabase_server_configuration_missing' });
  if (!serviceAccountEmail || !serviceAccountPrivateKey || !packageName) {
    return respond(503, { error: 'google_play_server_configuration_missing' });
  }
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return respond(401, { error: 'authentication_required' });
  const userClient = createClient(supabaseUrl, serviceKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: userData, error: userError } = await userClient.auth.getUser(authorization.slice(7));
  if (userError || !userData.user) return respond(401, { error: 'invalid_access_token' });
  let body: VerifyBody;
  try { body = await request.json() as VerifyBody; } catch { return respond(400, { error: 'invalid_json' }); }
  const purchaseToken = body.purchaseToken?.trim();
  const googleProductId = body.googleProductId?.trim();
  const requestId = body.requestId?.trim();
  if (!purchaseToken || purchaseToken.length > 4096 || !googleProductId || !/^[a-z0-9][a-z0-9._]{2,99}$/u.test(googleProductId)) {
    return respond(400, { error: 'invalid_purchase_request' });
  }
  const idempotencyKey = requestId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(requestId)
    ? requestId
    : crypto.randomUUID();
  try {
    const accessToken = await serviceAccountAccessToken(serviceAccountEmail, serviceAccountPrivateKey);
    const verifyUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/productsv2/tokens/${encodeURIComponent(purchaseToken)}`;
    const verifyResponse = await fetch(verifyUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const googlePurchase = await verifyResponse.json() as ProductPurchaseV2 & { error?: unknown };
    if (!verifyResponse.ok) return respond(502, { error: 'google_play_verification_failed', googleStatus: verifyResponse.status });
    if (googlePurchase.purchaseStateContext?.purchaseState !== 'PURCHASED') {
      return respond(409, { error: 'purchase_not_completed', purchaseState: googlePurchase.purchaseStateContext?.purchaseState ?? 'UNSPECIFIED' });
    }
    const lineItems = googlePurchase.productLineItem ?? [];
    if (lineItems.length !== 1 || lineItems[0]?.productId !== googleProductId) return respond(409, { error: 'google_product_mismatch' });
    const expectedAccountId = await sha256Hex(userData.user.id);
    if (googlePurchase.obfuscatedExternalAccountId !== expectedAccountId) return respond(403, { error: 'purchase_account_mismatch' });
    const tokenHash = await sha256Hex(purchaseToken);
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: creditRows, error: creditError } = await admin.rpc('record_verified_play_purchase', {
      p_user_id: userData.user.id,
      p_google_product_id: googleProductId,
      p_purchase_token_hash: tokenHash,
      p_google_order_id: googlePurchase.orderId ?? '',
      p_obfuscated_external_account_id: expectedAccountId,
      p_country_code: googlePurchase.regionCode ?? null,
      p_is_test_purchase: googlePurchase.testPurchaseContext != null,
      p_idempotency_key: idempotencyKey,
      p_raw_response_encrypted: null,
    });
    if (creditError || !creditRows?.[0]) throw new Error(`purchase_credit_failed:${creditError?.message ?? 'no_result'}`);
    const consumeUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(googleProductId)}/tokens/${encodeURIComponent(purchaseToken)}:consume`;
    const consumeResponse = await fetch(consumeUrl, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: '{}' });
    if (!consumeResponse.ok && consumeResponse.status !== 409) {
      return respond(502, { error: 'purchase_credited_consume_retry_required', purchaseId: creditRows[0].purchase_id, googleStatus: consumeResponse.status });
    }
    const { error: consumedError } = await admin.rpc('mark_play_purchase_consumed', { p_purchase_token_hash: tokenHash });
    if (consumedError) throw new Error(`purchase_consume_record_failed:${consumedError.message}`);
    return respond(200, {
      purchaseId: creditRows[0].purchase_id,
      heartUnits: creditRows[0].heart_units,
      balanceAfterUnits: creditRows[0].balance_after_units,
      purchaseState: 'consumed',
      alreadyRecorded: creditRows[0].already_recorded,
      requestId: idempotencyKey,
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'play_purchase_verification_failed');
    return respond(500, { error: 'play_purchase_verification_failed' });
  }
});
