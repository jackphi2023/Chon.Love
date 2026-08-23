import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2.57.4';
import { CompareFacesCommand, RekognitionClient } from 'npm:@aws-sdk/client-rekognition@3.1097.0';
import {
  compareWithLocalWorker,
  localWorkerState,
  type LocalWorkerComparison,
} from './local-face-worker.ts';

type JsonBody = Record<string, unknown> & {
  action?: string;
  selfieBase64?: string;
  mimeType?: string;
  declaredGender?: string;
  caseId?: string;
  decision?: string;
  reason?: string;
  requestId?: string;
  limit?: number;
  offset?: number;
};

type VerificationState = 'not_started' | 'pending_review' | 'approved' | 'hidden';

type MediaRow = {
  id: string;
  storage_bucket: string;
  storage_path: string;
  visibility: string;
  moderation_status: string;
  mime_type: string | null;
  uploaded_at: string | null;
};

type CaseRow = {
  id: string;
  reported_user_id: string | null;
  status: string;
  decision: string | null;
  automated_score_json: Record<string, unknown> | null;
  created_at: string;
};

type AwsProviderState = {
  client: RekognitionClient | null;
  missing: string[];
};

type ProviderKind = 'aws' | 'local_worker';

type SelectedProvider = {
  kind: ProviderKind;
  name: string;
  configured: boolean;
  missing: string[];
  awsClient: RekognitionClient | null;
};

type PendingPresentation = {
  message: string;
  maxSimilarity: number | null;
  reason: string | null;
  retryable: boolean;
};

type LocalAggregate = {
  maxCosineSimilarity: number | null;
  matchedMediaId: string | null;
  top3MedianCosine: number | null;
  strongMatchCount: number;
  usableProfileCount: number;
  passed: boolean;
};

const RULE_CODE = 'member_photo_verification';
const FACE_SIMILARITY_THRESHOLD = 60;
const REKOGNITION_REQUEST_THRESHOLD = 0;
const LOCAL_FACE_DEFAULT_COSINE_THRESHOLD = 0.363;
const LOCAL_FACE_DEFAULT_MIN_STRONG_MATCHES = 2;
const MAX_PROFILE_IMAGES = 5;
const MAX_SELFIE_BYTES = 5 * 1024 * 1024;
const GENERIC_PENDING_MESSAGE = 'Ảnh xác minh cần được kiểm tra thêm trước khi hồ sơ có thể kích hoạt.';
const SIMILARITY_PENDING_MESSAGE = `Ảnh selfie chưa đạt ngưỡng tương đồng trên ${FACE_SIMILARITY_THRESHOLD}% với ảnh hồ sơ. Chon.Love sẽ kiểm tra thêm trước khi kích hoạt.`;
const LOCAL_SIMILARITY_PENDING_MESSAGE = 'Ảnh selfie chưa đạt ngưỡng xác minh khuôn mặt theo mô hình local AI. Chon.Love sẽ kiểm tra thêm trước khi kích hoạt.';
const LOCAL_REFERENCE_PENDING_MESSAGE = 'Chưa có đủ ảnh hồ sơ rõ mặt để tự động xác minh. Hãy bổ sung thêm ảnh hồ sơ rồi thử lại, hoặc Chon.Love sẽ kiểm tra thủ công.';
const PROVIDER_PENDING_MESSAGE = 'Dịch vụ so sánh khuôn mặt đang tạm thời chưa sẵn sàng. Điểm tương đồng chưa được tính; hồ sơ được giữ ở trạng thái chờ để tránh từ chối nhầm.';
const PROVIDER_RECOVERED_MESSAGE = 'Dịch vụ so sánh khuôn mặt đã sẵn sàng trở lại. Hãy chụp lại selfie để hệ thống xác minh.';
const QUALITY_PENDING_MESSAGE = 'Hệ thống chưa tính được kết quả xác minh đáng tin cậy từ ảnh hiện tại. Hãy chụp lại selfie rõ mặt, đủ sáng và nhìn gần thẳng camera.';
const PROFILE_CHANGED_MESSAGE = 'Thông tin hồ sơ đã thay đổi trong lúc xác minh. Chon.Love sẽ kiểm tra thêm trước khi kích hoạt.';

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

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function pageLimit(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value)
    ? Math.min(Math.max(value, 1), 200)
    : 100;
}

function pageOffset(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) ? Math.max(value, 0) : 0;
}

function decodeBase64Image(value: string): Uint8Array {
  const raw = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value;
  const normalized = raw.replace(/\s/gu, '');
  if (!normalized || normalized.length > Math.ceil(MAX_SELFIE_BYTES * 4 / 3) + 16) {
    throw new Error('invalid_selfie_size');
  }
  const binary = atob(normalized);
  if (binary.length <= 0 || binary.length > MAX_SELFIE_BYTES) {
    throw new Error('invalid_selfie_size');
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function verificationState(profileStatus: string | null, latestCase: CaseRow | null): VerificationState {
  if (profileStatus === 'active') return 'approved';
  if (profileStatus === 'deactivated' || profileStatus === 'suspended') return 'hidden';
  if (!latestCase) return 'not_started';
  if (latestCase.status === 'resolved' && latestCase.decision === 'approve') return 'approved';
  if (latestCase.status === 'resolved' && latestCase.decision && latestCase.decision !== 'approve') return 'hidden';
  if (['open', 'queued', 'in_review'].includes(latestCase.status)) return 'pending_review';
  return 'not_started';
}

function rekognitionProvider(): AwsProviderState {
  const region = Deno.env.get('AWS_REGION');
  const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
  const sessionToken = Deno.env.get('AWS_SESSION_TOKEN') ?? undefined;
  const missing = [
    !region ? 'AWS_REGION' : null,
    !accessKeyId ? 'AWS_ACCESS_KEY_ID' : null,
    !secretAccessKey ? 'AWS_SECRET_ACCESS_KEY' : null,
  ].filter((value): value is string => Boolean(value));
  if (missing.length > 0 || !region || !accessKeyId || !secretAccessKey) return { client: null, missing };
  return {
    client: new RekognitionClient({
      region,
      credentials: { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) },
    }),
    missing: [],
  };
}

function selectedProvider(): SelectedProvider {
  const mode = (Deno.env.get('FACE_COMPARISON_PROVIDER') ?? 'aws').trim().toLowerCase();
  const aws = rekognitionProvider();
  const local = localWorkerState();

  if (mode === 'local_worker') {
    return {
      kind: 'local_worker',
      name: local.configured ? 'local_face_worker_sface' : 'unconfigured',
      configured: local.configured,
      missing: local.missing,
      awsClient: null,
    };
  }
  if (mode === 'auto') {
    if (local.configured) {
      return { kind: 'local_worker', name: 'local_face_worker_sface', configured: true, missing: [], awsClient: null };
    }
    if (aws.client) {
      return { kind: 'aws', name: 'aws_rekognition_compare_faces', configured: true, missing: [], awsClient: aws.client };
    }
    return {
      kind: 'local_worker',
      name: 'unconfigured',
      configured: false,
      missing: [...local.missing, ...aws.missing],
      awsClient: null,
    };
  }
  if (mode !== 'aws') {
    return { kind: 'aws', name: 'unconfigured', configured: false, missing: ['FACE_COMPARISON_PROVIDER'], awsClient: null };
  }
  return {
    kind: 'aws',
    name: aws.client ? 'aws_rekognition_compare_faces' : 'unconfigured',
    configured: Boolean(aws.client),
    missing: aws.missing,
    awsClient: aws.client,
  };
}

function localCosineThreshold(): number {
  const parsed = Number(Deno.env.get('LOCAL_FACE_COSINE_THRESHOLD'));
  return Number.isFinite(parsed) && parsed >= -1 && parsed <= 1 ? parsed : LOCAL_FACE_DEFAULT_COSINE_THRESHOLD;
}

function localMinimumStrongMatches(): number {
  const parsed = Number(Deno.env.get('LOCAL_FACE_MIN_STRONG_MATCHES'));
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_PROFILE_IMAGES
    ? parsed
    : LOCAL_FACE_DEFAULT_MIN_STRONG_MATCHES;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function aggregateLocalComparison(
  comparison: LocalWorkerComparison,
  cosineThreshold: number,
  minimumStrongMatches: number,
): LocalAggregate {
  const sorted = [...comparison.profileScores].sort((left, right) => right.cosineSimilarity - left.cosineSimilarity);
  const top3 = sorted.slice(0, 3).map((item) => item.cosineSimilarity);
  const top3MedianCosine = median(top3);
  const strongMatchCount = sorted.filter((item) => item.cosineSimilarity >= cosineThreshold).length;
  const usableProfileCount = sorted.length;
  const maxCosineSimilarity = sorted[0]?.cosineSimilarity ?? null;
  const matchedMediaId = sorted[0]?.mediaId ?? null;
  const passed = usableProfileCount >= minimumStrongMatches
    && strongMatchCount >= minimumStrongMatches
    && top3MedianCosine != null
    && top3MedianCosine >= cosineThreshold;
  return {
    maxCosineSimilarity,
    matchedMediaId,
    top3MedianCosine,
    strongMatchCount,
    usableProfileCount,
    passed,
  };
}

function pendingPresentation(caseRow: CaseRow | null, providerConfigured: boolean): PendingPresentation {
  const score = caseRow?.automated_score_json ?? {};
  const reason = typeof score.pendingReason === 'string' ? score.pendingReason : null;
  const storedSimilarity = typeof score.maxSimilarity === 'number' && Number.isFinite(score.maxSimilarity)
    ? score.maxSimilarity
    : null;

  if (reason === 'face_comparison_provider_not_configured' || score.provider === 'unconfigured') {
    return {
      message: providerConfigured ? PROVIDER_RECOVERED_MESSAGE : PROVIDER_PENDING_MESSAGE,
      maxSimilarity: null,
      reason: 'face_comparison_provider_not_configured',
      retryable: providerConfigured,
    };
  }
  if (reason === 'face_comparison_quality_or_provider_error') {
    return {
      message: QUALITY_PENDING_MESSAGE,
      maxSimilarity: null,
      reason,
      retryable: providerConfigured,
    };
  }
  if (reason === 'face_reference_photos_insufficient_for_auto_approval') {
    return {
      message: LOCAL_REFERENCE_PENDING_MESSAGE,
      maxSimilarity: null,
      reason,
      retryable: providerConfigured,
    };
  }
  if (reason === 'face_similarity_not_above_local_threshold') {
    return {
      message: LOCAL_SIMILARITY_PENDING_MESSAGE,
      maxSimilarity: null,
      reason,
      retryable: false,
    };
  }
  if (reason === 'face_similarity_not_above_threshold') {
    return {
      message: SIMILARITY_PENDING_MESSAGE,
      maxSimilarity: storedSimilarity,
      reason,
      retryable: false,
    };
  }
  if (reason === 'declared_gender_changed_during_verification') {
    return { message: PROFILE_CHANGED_MESSAGE, maxSimilarity: null, reason, retryable: false };
  }
  return { message: GENERIC_PENDING_MESSAGE, maxSimilarity: storedSimilarity, reason, retryable: false };
}

async function latestVerificationCase(server: SupabaseClient, userId: string): Promise<CaseRow | null> {
  const { data, error } = await server
    .from('moderation_cases')
    .select('id,reported_user_id,status,decision,automated_score_json,created_at')
    .eq('reported_user_id', userId)
    .contains('rule_codes', [RULE_CODE])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`verification_case_lookup_failed:${error.code}`);
  return data as CaseRow | null;
}

async function profileMedia(server: SupabaseClient, userId: string): Promise<MediaRow[]> {
  const { data, error } = await server
    .from('media_assets')
    .select('id,storage_bucket,storage_path,visibility,moderation_status,mime_type,uploaded_at')
    .eq('owner_id', userId)
    .in('visibility', ['avatar', 'public'])
    .in('moderation_status', ['pending_review', 'approved'])
    .is('deleted_at', null)
    .not('uploaded_at', 'is', null)
    .order('uploaded_at', { ascending: false })
    .limit(MAX_PROFILE_IMAGES);
  if (error) throw new Error(`profile_media_lookup_failed:${error.code}`);
  return (data ?? []) as MediaRow[];
}

async function downloadMedia(server: SupabaseClient, media: Pick<MediaRow, 'storage_bucket' | 'storage_path'>): Promise<Uint8Array> {
  const { data, error } = await server.storage.from(media.storage_bucket).download(media.storage_path);
  if (error || !data) throw new Error('profile_media_download_failed');
  return new Uint8Array(await data.arrayBuffer());
}

async function compareAgainstProfileImages(
  client: RekognitionClient,
  selfie: Uint8Array,
  media: MediaRow[],
  server: SupabaseClient,
): Promise<{ maxSimilarity: number | null; matchedMediaId: string | null; errors: string[]; scoredComparisons: number }> {
  let maxSimilarity: number | null = null;
  let matchedMediaId: string | null = null;
  let scoredComparisons = 0;
  const errors: string[] = [];

  for (const item of media) {
    if (item.mime_type !== 'image/jpeg' && item.mime_type !== 'image/png') {
      errors.push(`${item.id}:unsupported_media_type`);
      continue;
    }
    try {
      const target = await downloadMedia(server, item);
      const result = await client.send(new CompareFacesCommand({
        SourceImage: { Bytes: selfie },
        TargetImage: { Bytes: target },
        SimilarityThreshold: REKOGNITION_REQUEST_THRESHOLD,
        QualityFilter: 'AUTO',
      }));
      const similarities = (result.FaceMatches ?? [])
        .map((match) => Number(match.Similarity))
        .filter(Number.isFinite);
      if (similarities.length === 0) {
        errors.push(`${item.id}:no_similarity_score`);
        continue;
      }
      const candidate = Math.max(...similarities);
      scoredComparisons += 1;
      if (maxSimilarity == null || candidate > maxSimilarity) {
        maxSimilarity = candidate;
        matchedMediaId = item.id;
      }
    } catch (error) {
      const name = error instanceof Error ? error.name : 'unknown_error';
      errors.push(`${item.id}:${name}`);
    }
  }

  return { maxSimilarity, matchedMediaId, errors, scoredComparisons };
}

async function saveVerificationCase(
  server: SupabaseClient,
  existingCase: CaseRow | null,
  input: {
    userId: string;
    status: 'queued' | 'resolved';
    priority: 'normal' | 'high';
    decision?: 'approve';
    notes?: string;
    score: Record<string, unknown>;
  },
): Promise<CaseRow> {
  const resolved = input.status === 'resolved';
  if (existingCase) {
    const { data, error } = await server
      .from('moderation_cases')
      .update({
        status: input.status,
        priority: input.priority,
        automated_score_json: input.score,
        decision: input.decision ?? null,
        decision_notes: input.notes ?? null,
        resolved_at: resolved ? new Date().toISOString() : null,
      })
      .eq('id', existingCase.id)
      .select('id,reported_user_id,status,decision,automated_score_json,created_at')
      .single();
    if (error || !data) throw new Error(`verification_case_update_failed:${error?.code ?? 'no_result'}`);
    return data as CaseRow;
  }

  const { data, error } = await server
    .from('moderation_cases')
    .insert({
      reported_user_id: input.userId,
      source: 'automated_scan',
      status: input.status,
      priority: input.priority,
      rule_codes: [RULE_CODE],
      automated_score_json: input.score,
      decision: input.decision ?? null,
      decision_notes: input.notes ?? null,
      resolved_at: resolved ? new Date().toISOString() : null,
    })
    .select('id,reported_user_id,status,decision,automated_score_json,created_at')
    .single();
  if (error || !data) throw new Error(`verification_case_insert_failed:${error?.code ?? 'no_result'}`);
  return data as CaseRow;
}

async function createSignedReviewPayload(server: SupabaseClient, caseRow: CaseRow) {
  const score = caseRow.automated_score_json ?? {};
  const selfieStoragePath = typeof score.selfieStoragePath === 'string' ? score.selfieStoragePath : null;
  const profileMediaIds = Array.isArray(score.profileMediaIds)
    ? score.profileMediaIds.filter((id): id is string => typeof id === 'string' && validUuid(id))
    : [];

  let selfieUrl: string | null = null;
  if (selfieStoragePath) {
    const { data } = await server.storage.from('member-verification').createSignedUrl(selfieStoragePath, 60);
    selfieUrl = data?.signedUrl ?? null;
  }

  const referenceImages: Array<{ mediaId: string; signedUrl: string }> = [];
  if (profileMediaIds.length > 0) {
    const { data: mediaRows, error } = await server
      .from('media_assets')
      .select('id,storage_bucket,storage_path')
      .in('id', profileMediaIds);
    if (error) throw new Error(`review_media_lookup_failed:${error.code}`);
    for (const media of mediaRows ?? []) {
      const { data } = await server.storage.from(media.storage_bucket).createSignedUrl(media.storage_path, 60);
      if (data?.signedUrl) referenceImages.push({ mediaId: media.id, signedUrl: data.signedUrl });
    }
  }

  return { selfieUrl, referenceImages, expiresInSeconds: 60 };
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
    const actorId = userData.user.id;
    const action = body.action ?? 'status';

    if (action === 'admin_list') {
      const { data, error } = await server.rpc('admin_list_member_photo_verifications', {
        p_actor_user_id: actorId,
        p_limit: pageLimit(body.limit),
        p_offset: pageOffset(body.offset),
      });
      if (error) return respond(error.code === '42501' ? 403 : 500, { error: 'admin_verification_list_failed' });
      return respond(200, { items: data ?? [] });
    }

    if (action === 'admin_detail') {
      if (!validUuid(body.caseId)) return respond(400, { error: 'invalid_case_id' });
      const { error: roleError } = await server.rpc('admin_list_member_photo_verifications', {
        p_actor_user_id: actorId,
        p_limit: 1,
        p_offset: 0,
      });
      if (roleError) return respond(roleError.code === '42501' ? 403 : 500, { error: 'admin_authorization_failed' });
      const { data, error } = await server
        .from('moderation_cases')
        .select('id,reported_user_id,status,decision,automated_score_json,created_at')
        .eq('id', body.caseId)
        .contains('rule_codes', [RULE_CODE])
        .single();
      if (error || !data) return respond(404, { error: 'verification_case_not_found' });
      const signed = await createSignedReviewPayload(server, data as CaseRow);
      return respond(200, { item: data, ...signed });
    }

    if (action === 'admin_review') {
      if (!validUuid(body.caseId)) return respond(400, { error: 'invalid_case_id' });
      if (body.decision !== 'approve' && body.decision !== 'hide') return respond(400, { error: 'invalid_decision' });
      const rid = validUuid(body.requestId) ? body.requestId : crypto.randomUUID();
      const { data, error } = await server.rpc('admin_review_member_photo_verification', {
        p_actor_user_id: actorId,
        p_case_id: body.caseId,
        p_action: body.decision,
        p_reason: typeof body.reason === 'string' ? body.reason : null,
        p_request_id: rid,
      });
      if (error) return respond(error.code === '42501' ? 403 : 500, { error: 'admin_verification_review_failed' });
      return respond(200, { result: data?.[0] ?? null, requestId: rid });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authorization } },
    });
    const { data: onboardingRows, error: onboardingError } = await userClient.rpc('get_my_onboarding_status');
    if (onboardingError || !onboardingRows?.[0]) return respond(403, { error: 'onboarding_status_unavailable' });
    const onboarding = onboardingRows[0];

    const { data: profile, error: profileError } = await server
      .from('profiles')
      .select('id,gender,profile_status,discovery_enabled,deleted_at,province_id,looking_for,lifestyle_tags,headline,bio')
      .eq('id', actorId)
      .single();
    if (profileError || !profile || profile.deleted_at) return respond(404, { error: 'profile_not_found' });

    const latestCase = await latestVerificationCase(server, actorId);
    const state = verificationState(profile.profile_status, latestCase);
    const provider = selectedProvider();
    const currentPending = pendingPresentation(latestCase, provider.configured);
    const providerMetric = provider.kind === 'local_worker' ? 'cosine' : 'percent';

    if (action === 'status') {
      const currentReferencePhotoCount = provider.kind === 'local_worker'
        && currentPending.reason === 'face_reference_photos_insufficient_for_auto_approval'
        ? (await profileMedia(server, actorId)).length
        : null;
      return respond(200, {
        state,
        profileStatus: profile.profile_status,
        threshold: FACE_SIMILARITY_THRESHOLD,
        provider: provider.name,
        providerConfigured: provider.configured,
        providerMetric,
        localCosineThreshold: provider.kind === 'local_worker' ? localCosineThreshold() : null,
        localMinimumStrongMatches: provider.kind === 'local_worker' ? localMinimumStrongMatches() : null,
        currentReferencePhotoCount,
        maxSimilarity: state === 'pending_review' ? currentPending.maxSimilarity : null,
        message: state === 'pending_review' ? currentPending.message : null,
        reason: state === 'pending_review' ? currentPending.reason : null,
        retryable: state === 'pending_review' && currentPending.retryable,
      });
    }

    if (action !== 'submit') return respond(400, { error: 'unsupported_action' });
    if (state === 'approved') return respond(200, { state: 'approved', threshold: FACE_SIMILARITY_THRESHOLD, provider: provider.name, providerMetric });
    if (state === 'hidden') return respond(403, { state: 'hidden', error: 'account_not_eligible' });
    const retryCase = state === 'pending_review' && currentPending.retryable ? latestCase : null;
    if (state === 'pending_review' && !retryCase) {
      return respond(200, {
        state: 'pending_review',
        threshold: FACE_SIMILARITY_THRESHOLD,
        provider: provider.name,
        providerMetric,
        maxSimilarity: currentPending.maxSimilarity,
        message: currentPending.message,
        reason: currentPending.reason,
        retryable: currentPending.retryable,
      });
    }

    if (onboarding.account_status !== 'active' || !onboarding.age_verified || !onboarding.policies_accepted) {
      return respond(403, { error: 'adult_onboarding_required' });
    }
    if (profile.profile_status !== 'pending_review' && profile.profile_status !== 'incomplete') {
      return respond(403, { error: 'profile_not_eligible_for_selfie_verification' });
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
    if (!profileCopyComplete) return respond(422, { error: 'signup_profile_details_required' });

    if (typeof body.selfieBase64 !== 'string' || body.mimeType !== 'image/jpeg') {
      return respond(400, { error: 'jpeg_selfie_required' });
    }

    const selfieBytes = decodeBase64Image(body.selfieBase64);
    const media = await profileMedia(server, actorId);
    if (media.length === 0) return respond(422, { error: 'profile_photo_required' });

    const { error: profilePendingError } = await server
      .from('profiles')
      .update({ profile_status: 'pending_review', discovery_enabled: false, nearby_enabled: false })
      .eq('id', actorId);
    if (profilePendingError) throw new Error(`profile_pending_update_failed:${profilePendingError.code}`);

    const attemptId = crypto.randomUUID();
    const selfieStoragePath = `${actorId}/${attemptId}/selfie.jpg`;
    const { error: uploadError } = await server.storage
      .from('member-verification')
      .upload(selfieStoragePath, selfieBytes, { contentType: 'image/jpeg', cacheControl: '0', upsert: false });
    if (uploadError) throw new Error(`selfie_storage_failed:${uploadError.message}`);

    const declaredGender = String(profile.gender);
    const declaredGenderConsistent = typeof body.declaredGender !== 'string' || body.declaredGender === declaredGender;
    let maxSimilarity: number | null = null;
    let maxCosineSimilarity: number | null = null;
    let top3MedianCosine: number | null = null;
    let strongMatchCount = 0;
    let usableProfileCount = 0;
    let matchedMediaId: string | null = null;
    let providerErrors: string[] = [];
    let scoredComparisons = 0;
    let workerVersion: string | null = null;
    let workerElapsedMs: number | null = null;
    let pendingReason: string | null = null;
    let approvalPassed = false;
    const localThreshold = localCosineThreshold();
    const localMinStrongMatches = localMinimumStrongMatches();

    if (!declaredGenderConsistent) {
      pendingReason = 'declared_gender_changed_during_verification';
    } else if (!provider.configured) {
      pendingReason = 'face_comparison_provider_not_configured';
    } else if (provider.kind === 'local_worker') {
      try {
        const comparison = await compareWithLocalWorker(server, selfieStoragePath, media, attemptId);
        const aggregate = aggregateLocalComparison(comparison, localThreshold, localMinStrongMatches);
        maxCosineSimilarity = aggregate.maxCosineSimilarity;
        top3MedianCosine = aggregate.top3MedianCosine;
        strongMatchCount = aggregate.strongMatchCount;
        usableProfileCount = aggregate.usableProfileCount;
        matchedMediaId = aggregate.matchedMediaId;
        providerErrors = comparison.errors;
        scoredComparisons = aggregate.usableProfileCount;
        workerVersion = comparison.version;
        workerElapsedMs = comparison.workerElapsedMs;
        if (aggregate.usableProfileCount === 0) {
          pendingReason = 'face_comparison_quality_or_provider_error';
        } else if (aggregate.usableProfileCount < localMinStrongMatches) {
          pendingReason = 'face_reference_photos_insufficient_for_auto_approval';
        } else if (!aggregate.passed) {
          pendingReason = 'face_similarity_not_above_local_threshold';
        } else {
          approvalPassed = true;
        }
      } catch (error) {
        providerErrors = [error instanceof Error ? error.message.split(':')[0] : 'local_worker_error'];
        pendingReason = 'face_comparison_quality_or_provider_error';
      }
    } else if (provider.awsClient) {
      const comparison = await compareAgainstProfileImages(provider.awsClient, selfieBytes, media, server);
      maxSimilarity = comparison.maxSimilarity;
      matchedMediaId = comparison.matchedMediaId;
      providerErrors = comparison.errors;
      scoredComparisons = comparison.scoredComparisons;
      if (scoredComparisons === 0 || maxSimilarity == null) {
        pendingReason = 'face_comparison_quality_or_provider_error';
      } else if (maxSimilarity <= FACE_SIMILARITY_THRESHOLD) {
        pendingReason = 'face_similarity_not_above_threshold';
      } else {
        approvalPassed = true;
      }
    } else {
      pendingReason = 'face_comparison_provider_not_configured';
    }

    const score: Record<string, unknown> = {
      provider: provider.configured ? provider.name : 'unconfigured',
      providerConfigured: provider.configured,
      providerConfigMissing: provider.missing,
      providerMetric,
      requestSimilarityThreshold: provider.kind === 'aws' ? REKOGNITION_REQUEST_THRESHOLD : null,
      threshold: FACE_SIMILARITY_THRESHOLD,
      localCosineThreshold: provider.kind === 'local_worker' ? localThreshold : null,
      localMinimumStrongMatches: provider.kind === 'local_worker' ? localMinStrongMatches : null,
      maxSimilarity: maxSimilarity == null ? null : Number(maxSimilarity.toFixed(2)),
      maxCosineSimilarity: maxCosineSimilarity == null ? null : Number(maxCosineSimilarity.toFixed(6)),
      top3MedianCosine: top3MedianCosine == null ? null : Number(top3MedianCosine.toFixed(6)),
      strongMatchCount,
      usableProfileCount,
      matchedMediaId,
      profileMediaIds: media.map((item) => item.id),
      selfieStoragePath,
      declaredGenderSnapshot: declaredGender,
      declaredGenderConsistent,
      genderCheckMode: 'declared_profile_consistency_only',
      providerErrors,
      workerVersion,
      workerElapsedMs,
      scoredComparisons,
      attemptedComparisons: media.length,
      pendingReason,
      submittedAt: new Date().toISOString(),
    };

    if (!pendingReason && approvalPassed) {
      const approvalNote = provider.kind === 'local_worker'
        ? `Auto-approved by local SFace policy: ${strongMatchCount} strong matches, top-3 median ${top3MedianCosine?.toFixed(4) ?? 'n/a'} >= ${localThreshold}.`
        : `Auto-approved: face similarity ${maxSimilarity?.toFixed(2) ?? 'n/a'}% > ${FACE_SIMILARITY_THRESHOLD}%.`;
      const approvedCase = await saveVerificationCase(server, retryCase, {
        userId: actorId,
        status: 'resolved',
        priority: 'normal',
        decision: 'approve',
        notes: approvalNote,
        score,
      });
      const { data: activationRows, error: activateError } = await server.rpc('activate_verified_signup_profile_v2', {
        p_user_id: actorId,
      });
      if (activateError || !activationRows?.[0]) {
        throw new Error(`profile_activation_failed:${activateError?.code ?? 'no_result'}`);
      }
      return respond(200, {
        state: 'approved',
        caseId: approvedCase.id,
        threshold: FACE_SIMILARITY_THRESHOLD,
        provider: provider.name,
        providerMetric,
        maxSimilarity: maxSimilarity == null ? null : Number(maxSimilarity.toFixed(2)),
      });
    }

    const queuedPresentation = pendingPresentation({
      id: retryCase?.id ?? '',
      reported_user_id: actorId,
      status: 'queued',
      decision: null,
      automated_score_json: score,
      created_at: retryCase?.created_at ?? new Date().toISOString(),
    }, provider.configured);
    const queuedCase = await saveVerificationCase(server, retryCase, {
      userId: actorId,
      status: 'queued',
      priority: 'high',
      notes: queuedPresentation.message,
      score,
    });
    return respond(200, {
      state: 'pending_review',
      caseId: queuedCase.id,
      threshold: FACE_SIMILARITY_THRESHOLD,
      provider: provider.name,
      providerMetric,
      maxSimilarity: queuedPresentation.maxSimilarity,
      message: queuedPresentation.message,
      reason: queuedPresentation.reason,
      retryable: queuedPresentation.retryable,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'member_photo_verification_failed';
    console.error(message.split(':')[0]);
    if (message === 'invalid_selfie_size') return respond(400, { error: message });
    return respond(500, { error: 'member_photo_verification_failed' });
  }
});
