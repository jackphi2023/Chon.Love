import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2.57.4';
import {
  CreateFaceLivenessSessionCommand,
  GetFaceLivenessSessionResultsCommand,
  RekognitionClient,
} from 'npm:@aws-sdk/client-rekognition@3.1097.0';
import { AssumeRoleCommand, STSClient } from 'npm:@aws-sdk/client-sts@3.1097.0';

type JsonBody = Record<string, unknown> & {
  action?: string;
  sessionId?: string;
};

type StaticCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

type ProviderConfig = {
  region: string;
  credentials: StaticCredentials;
  roleArn: string;
};

type LivenessSessionRow = {
  id: string;
  user_id: string;
  aws_session_id: string;
  region: string;
  state: 'created' | 'completed' | 'failed' | 'expired';
  confidence: number | null;
  threshold: number;
  challenge_type: 'FaceMovementAndLightChallenge' | 'FaceMovementChallenge';
  reference_image_sha256: string | null;
  reference_image_stored: boolean;
  error_code: string | null;
  expires_at: string;
};

const RULE_CODE = 'member_photo_verification';
const DEFAULT_LIVENESS_THRESHOLD = 80;
const SESSION_TTL_MS = 3 * 60 * 1000;
const RATE_WINDOW_MS = 3 * 60 * 1000;
const MAX_SESSIONS_PER_WINDOW = 5;
const RATE_LIMIT_RETRY_SECONDS = Math.ceil(RATE_WINDOW_MS / 1000);
const GENERIC_PENDING_MESSAGE = 'Xác minh người thật cần được kiểm tra thêm trước khi hồ sơ có thể kích hoạt.';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
};

function respond(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function validAwsSessionId(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

function livenessThreshold(): number {
  const value = Number(Deno.env.get('AWS_FACE_LIVENESS_THRESHOLD') ?? DEFAULT_LIVENESS_THRESHOLD);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : DEFAULT_LIVENESS_THRESHOLD;
}

function challengeType(): 'FaceMovementAndLightChallenge' | 'FaceMovementChallenge' {
  return Deno.env.get('AWS_FACE_LIVENESS_CHALLENGE') === 'FaceMovementChallenge'
    ? 'FaceMovementChallenge'
    : 'FaceMovementAndLightChallenge';
}

function providerConfig(): ProviderConfig | null {
  const region = Deno.env.get('AWS_REGION');
  const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
  const sessionToken = Deno.env.get('AWS_SESSION_TOKEN') ?? undefined;
  const roleArn = Deno.env.get('AWS_FACE_LIVENESS_ROLE_ARN');
  if (!region || !accessKeyId || !secretAccessKey || !roleArn) return null;
  return {
    region,
    roleArn,
    credentials: { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) },
  };
}

function detectImageMimeType(bytes: Uint8Array): 'image/jpeg' | 'image/png' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

async function markProfilePending(server: SupabaseClient, userId: string): Promise<void> {
  const { error } = await server
    .from('profiles')
    .update({ profile_status: 'pending_review', discovery_enabled: false, nearby_enabled: false })
    .eq('id', userId);
  if (error) throw new Error(`liveness_profile_pending_failed:${error.code}`);
}

async function latestOpenVerificationCase(server: SupabaseClient, userId: string) {
  const { data, error } = await server
    .from('moderation_cases')
    .select('id,status')
    .eq('reported_user_id', userId)
    .contains('rule_codes', [RULE_CODE])
    .in('status', ['open', 'queued', 'in_review'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`liveness_case_lookup_failed:${error.code}`);
  return data as { id: string; status: string } | null;
}

async function queuePendingReview(
  server: SupabaseClient,
  userId: string,
  score: Record<string, unknown>,
  reason: string,
): Promise<string> {
  await markProfilePending(server, userId);
  const existing = await latestOpenVerificationCase(server, userId);
  if (existing) {
    const { data, error } = await server
      .from('moderation_cases')
      .update({
        status: 'queued',
        priority: 'high',
        automated_score_json: score,
        decision: null,
        decision_notes: reason,
        resolved_at: null,
      })
      .eq('id', existing.id)
      .select('id')
      .single();
    if (error || !data) throw new Error(`liveness_case_update_failed:${error?.code ?? 'no_result'}`);
    return String(data.id);
  }

  const { data, error } = await server
    .from('moderation_cases')
    .insert({
      reported_user_id: userId,
      source: 'automated_scan',
      status: 'queued',
      priority: 'high',
      rule_codes: [RULE_CODE],
      automated_score_json: score,
      decision_notes: reason,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`liveness_case_insert_failed:${error?.code ?? 'no_result'}`);
  return String(data.id);
}

async function currentProfile(server: SupabaseClient, userId: string) {
  const { data, error } = await server
    .from('profiles')
    .select('id,gender,profile_status,deleted_at,province_id,looking_for,lifestyle_tags,headline,bio')
    .eq('id', userId)
    .single();
  if (error || !data || data.deleted_at) throw new Error('profile_not_found');
  return data;
}

async function assertOnboardingEligibility(
  server: SupabaseClient,
  anonKey: string,
  authorization: string,
  userId: string,
): Promise<{ gender: string }> {
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: onboardingRows, error: onboardingError } = await userClient.rpc('get_my_onboarding_status');
  if (onboardingError || !onboardingRows?.[0]) throw new Error('onboarding_status_unavailable');
  const onboarding = onboardingRows[0];
  if (onboarding.account_status !== 'active' || !onboarding.age_verified || !onboarding.policies_accepted) {
    throw new Error('adult_onboarding_required');
  }

  const profile = await currentProfile(server, userId);
  if (profile.profile_status !== 'pending_review' && profile.profile_status !== 'incomplete') {
    throw new Error('profile_not_eligible_for_liveness_verification');
  }

  const headlineLength = typeof profile.headline === 'string' ? profile.headline.trim().length : 0;
  const bioLength = typeof profile.bio === 'string' ? profile.bio.trim().length : 0;
  const lookingForLength = typeof profile.looking_for === 'string' ? profile.looking_for.trim().length : 0;
  const lifestyleTagCount = Array.isArray(profile.lifestyle_tags) ? profile.lifestyle_tags.length : 0;
  const headlineValid = headlineLength === 0 || (headlineLength >= 10 && headlineLength <= 50);
  const profileCopyComplete = profile.province_id != null
    && lookingForLength >= 50
    && lookingForLength <= 4000
    && lifestyleTagCount >= 1
    && lifestyleTagCount <= 7
    && headlineValid
    && bioLength >= 50
    && bioLength <= 4000;
  if (!profileCopyComplete) throw new Error('signup_profile_details_required');
  return { gender: String(profile.gender) };
}

async function issueScopedStreamingCredentials(
  config: ProviderConfig,
  userId: string,
): Promise<{ accessKeyId: string; secretAccessKey: string; sessionToken: string; expiration: string }> {
  const sts = new STSClient({ region: config.region, credentials: config.credentials });
  const sessionName = `chon-liveness-${userId.slice(0, 8)}-${Date.now()}`;
  const sessionPolicy = JSON.stringify({
    Version: '2012-10-17',
    Statement: [{ Effect: 'Allow', Action: ['rekognition:StartFaceLivenessSession'], Resource: '*' }],
  });
  const result = await sts.send(new AssumeRoleCommand({
    RoleArn: config.roleArn,
    RoleSessionName: sessionName,
    DurationSeconds: 900,
    Policy: sessionPolicy,
  }));
  const credentials = result.Credentials;
  if (!credentials?.AccessKeyId || !credentials.SecretAccessKey || !credentials.SessionToken || !credentials.Expiration) {
    throw new Error('liveness_temporary_credentials_unavailable');
  }
  return {
    accessKeyId: credentials.AccessKeyId,
    secretAccessKey: credentials.SecretAccessKey,
    sessionToken: credentials.SessionToken,
    expiration: credentials.Expiration.toISOString(),
  };
}

async function countRecentSessions(server: SupabaseClient, userId: string): Promise<number> {
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count, error } = await server
    .schema('private')
    .from('member_face_liveness_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);
  if (error) throw new Error(`liveness_rate_lookup_failed:${error.code}`);
  return count ?? 0;
}

async function createLivenessSession(
  server: SupabaseClient,
  config: ProviderConfig,
  userId: string,
) {
  const recentCount = await countRecentSessions(server, userId);
  if (recentCount >= MAX_SESSIONS_PER_WINDOW) {
    return respond(429, { error: 'liveness_rate_limited', retryAfterSeconds: RATE_LIMIT_RETRY_SECONDS });
  }

  const temporaryCredentials = await issueScopedStreamingCredentials(config, userId);
  const rekognition = new RekognitionClient({ region: config.region, credentials: config.credentials });
  const token = crypto.randomUUID().replaceAll('-', '');
  const challenge = challengeType();
  const threshold = livenessThreshold();
  const result = await rekognition.send(new CreateFaceLivenessSessionCommand({
    ClientRequestToken: token,
    Settings: {
      AuditImagesLimit: 0,
      ChallengePreferences: [{ Type: challenge }],
    },
  }));
  if (!result.SessionId || !validAwsSessionId(result.SessionId)) throw new Error('liveness_session_creation_failed');

  const now = Date.now();
  const expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
  const { error } = await server.schema('private').from('member_face_liveness_sessions').insert({
    user_id: userId,
    aws_session_id: result.SessionId,
    client_request_token: token,
    region: config.region,
    state: 'created',
    threshold,
    challenge_type: challenge,
    expires_at: expiresAt,
  });
  if (error) throw new Error(`liveness_session_binding_failed:${error.code}`);

  return respond(200, {
    sessionId: result.SessionId,
    region: config.region,
    credentials: temporaryCredentials,
    expiresAt,
  });
}

async function getBoundSession(server: SupabaseClient, userId: string, sessionId: string): Promise<LivenessSessionRow | null> {
  const { data, error } = await server
    .schema('private')
    .from('member_face_liveness_sessions')
    .select('id,user_id,aws_session_id,region,state,confidence,threshold,challenge_type,reference_image_sha256,reference_image_stored,error_code,expires_at')
    .eq('user_id', userId)
    .eq('aws_session_id', sessionId)
    .maybeSingle();
  if (error) throw new Error(`liveness_session_lookup_failed:${error.code}`);
  return data as LivenessSessionRow | null;
}

async function updateLivenessSession(
  server: SupabaseClient,
  rowId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await server
    .schema('private')
    .from('member_face_liveness_sessions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', rowId);
  if (error) throw new Error(`liveness_session_update_failed:${error.code}`);
}

async function invokePhotoVerification(
  supabaseUrl: string,
  anonKey: string,
  authorization: string,
  action: 'status' | 'submit',
  payload: Record<string, unknown> = {},
): Promise<Response> {
  return fetch(`${supabaseUrl}/functions/v1/member-photo-verification`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...payload }),
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: 'method_not_allowed' });

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return respond(401, { error: 'authentication_required' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceKey || !anonKey) return respond(500, { error: 'supabase_server_configuration_missing' });

  let body: JsonBody;
  try {
    body = await request.json() as JsonBody;
  } catch {
    return respond(400, { error: 'invalid_json' });
  }

  try {
    const server = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const token = authorization.slice(7);
    const { data: userData, error: userError } = await server.auth.getUser(token);
    if (userError || !userData.user) return respond(401, { error: 'invalid_access_token' });
    const userId = userData.user.id;
    const action = body.action ?? 'create';
    const config = providerConfig();
    if (!config) {
      return respond(503, {
        error: 'face_liveness_provider_not_configured',
        retryable: false,
      });
    }

    if (action === 'create') {
      await assertOnboardingEligibility(server, anonKey, authorization, userId);
      return await createLivenessSession(server, config, userId);
    }

    if (action !== 'complete') return respond(400, { error: 'unsupported_action' });
    if (!validAwsSessionId(body.sessionId)) return respond(400, { error: 'invalid_liveness_session_id' });

    const bound = await getBoundSession(server, userId, body.sessionId);
    if (!bound) return respond(404, { error: 'liveness_session_not_found' });

    if (bound.state === 'failed' || (bound.state === 'completed' && (bound.reference_image_stored || bound.error_code))) {
      const statusResponse = await invokePhotoVerification(supabaseUrl, anonKey, authorization, 'status');
      const payload = await statusResponse.json().catch(() => ({ state: 'pending_review' }));
      return respond(statusResponse.ok ? 200 : statusResponse.status, payload as Record<string, unknown>);
    }

    if (bound.state === 'expired' || new Date(bound.expires_at).getTime() <= Date.now()) {
      await updateLivenessSession(server, bound.id, { state: 'expired', error_code: 'session_expired' });
      const caseId = await queuePendingReview(server, userId, {
        provider: 'aws_rekognition_face_liveness',
        livenessStatus: 'EXPIRED',
        livenessThreshold: bound.threshold,
        pendingReason: 'face_liveness_session_expired',
        submittedAt: new Date().toISOString(),
      }, GENERIC_PENDING_MESSAGE);
      return respond(200, {
        state: 'pending_review',
        caseId,
        message: GENERIC_PENDING_MESSAGE,
        reason: 'face_liveness_session_expired',
        retryable: true,
      });
    }

    const rekognition = new RekognitionClient({ region: config.region, credentials: config.credentials });
    const result = await rekognition.send(new GetFaceLivenessSessionResultsCommand({ SessionId: body.sessionId }));
    const confidence = typeof result.Confidence === 'number' && Number.isFinite(result.Confidence)
      ? Number(result.Confidence.toFixed(2))
      : null;
    const awsStatus = result.Status ?? 'UNKNOWN';
    const succeeded = awsStatus === 'SUCCEEDED' && confidence != null;

    if (!succeeded) {
      await updateLivenessSession(server, bound.id, {
        state: 'failed',
        aws_status: awsStatus,
        confidence,
        error_code: 'analysis_incomplete',
      });
      const caseId = await queuePendingReview(server, userId, {
        provider: 'aws_rekognition_face_liveness',
        livenessStatus: awsStatus,
        livenessThreshold: bound.threshold,
        pendingReason: 'face_liveness_incomplete',
        submittedAt: new Date().toISOString(),
      }, GENERIC_PENDING_MESSAGE);
      return respond(200, {
        state: 'pending_review',
        caseId,
        message: GENERIC_PENDING_MESSAGE,
        reason: 'face_liveness_incomplete',
        retryable: true,
      });
    }

    if (confidence < bound.threshold) {
      await updateLivenessSession(server, bound.id, {
        state: 'completed',
        aws_status: awsStatus,
        confidence,
        completed_at: new Date().toISOString(),
        error_code: 'below_threshold',
      });
      const caseId = await queuePendingReview(server, userId, {
        provider: 'aws_rekognition_face_liveness',
        livenessStatus: awsStatus,
        livenessConfidence: confidence,
        livenessThreshold: bound.threshold,
        pendingReason: 'face_liveness_not_above_threshold',
        submittedAt: new Date().toISOString(),
      }, GENERIC_PENDING_MESSAGE);
      return respond(200, {
        state: 'pending_review',
        caseId,
        message: GENERIC_PENDING_MESSAGE,
        reason: 'face_liveness_not_above_threshold',
        retryable: true,
      });
    }

    const referenceBytes = result.ReferenceImage?.Bytes;
    if (!referenceBytes || referenceBytes.byteLength <= 0) {
      await updateLivenessSession(server, bound.id, {
        state: 'completed',
        aws_status: awsStatus,
        confidence,
        completed_at: new Date().toISOString(),
        error_code: 'reference_image_missing',
      });
      const caseId = await queuePendingReview(server, userId, {
        provider: 'aws_rekognition_face_liveness',
        livenessStatus: awsStatus,
        livenessConfidence: confidence,
        livenessThreshold: bound.threshold,
        pendingReason: 'face_liveness_reference_image_missing',
        submittedAt: new Date().toISOString(),
      }, GENERIC_PENDING_MESSAGE);
      return respond(200, {
        state: 'pending_review',
        caseId,
        message: GENERIC_PENDING_MESSAGE,
        reason: 'face_liveness_reference_image_missing',
        retryable: true,
      });
    }

    const referenceMimeType = detectImageMimeType(referenceBytes);
    if (!referenceMimeType) {
      await updateLivenessSession(server, bound.id, {
        state: 'completed',
        aws_status: awsStatus,
        confidence,
        completed_at: new Date().toISOString(),
        error_code: 'reference_image_unsupported_format',
      });
      const caseId = await queuePendingReview(server, userId, {
        provider: 'aws_rekognition_face_liveness',
        livenessStatus: awsStatus,
        livenessConfidence: confidence,
        livenessThreshold: bound.threshold,
        pendingReason: 'face_liveness_reference_image_unsupported_format',
        submittedAt: new Date().toISOString(),
      }, GENERIC_PENDING_MESSAGE);
      return respond(200, {
        state: 'pending_review',
        caseId,
        message: GENERIC_PENDING_MESSAGE,
        reason: 'face_liveness_reference_image_unsupported_format',
        retryable: true,
      });
    }

    const referenceImageSha256 = await sha256Hex(referenceBytes);
    await updateLivenessSession(server, bound.id, {
      state: 'completed',
      aws_status: awsStatus,
      confidence,
      reference_image_sha256: referenceImageSha256,
      completed_at: new Date().toISOString(),
      error_code: null,
    });
    const profile = await currentProfile(server, userId);
    const verificationResponse = await invokePhotoVerification(
      supabaseUrl,
      anonKey,
      authorization,
      'submit',
      {
        mimeType: referenceMimeType,
        selfieBase64: bytesToBase64(referenceBytes),
        declaredGender: String(profile.gender),
        livenessSessionId: body.sessionId,
      },
    );
    const verificationPayload = await verificationResponse.json().catch(() => ({ error: 'member_photo_verification_invalid_response' }));
    if (!verificationResponse.ok) {
      return respond(verificationResponse.status, verificationPayload as Record<string, unknown>);
    }
    await updateLivenessSession(server, bound.id, { reference_image_stored: true });
    return respond(200, verificationPayload as Record<string, unknown>);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'member_face_liveness_failed';
    console.error(message.split(':')[0]);
    if (message === 'profile_not_found') return respond(404, { error: message });
    if (message === 'onboarding_status_unavailable' || message === 'adult_onboarding_required') return respond(403, { error: message });
    if (message === 'profile_not_eligible_for_liveness_verification') return respond(409, { error: message });
    if (message === 'signup_profile_details_required') return respond(422, { error: message });
    return respond(503, { error: 'face_liveness_service_unavailable', retryable: true });
  }
});
