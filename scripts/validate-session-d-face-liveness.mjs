import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function requireText(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`Session D Face Liveness contract missing: ${label}`);
}

const gateway = read('supabase/functions/member-face-liveness/index.ts');
const comparison = read('supabase/functions/member-photo-verification/index.ts');
const migration = read('supabase/migrations/20260907163000_session_d_face_liveness_sessions.sql');
const client = read('apps/mobile/src/lib/member-face-liveness.ts');
const webCapture = read('apps/mobile/src/components/aws-face-liveness.web.tsx');
const nativeBoundary = read('apps/mobile/src/components/aws-face-liveness.tsx');
const config = read('supabase/config.toml');

requireText(gateway, 'CreateFaceLivenessSessionCommand', 'server creates AWS Face Liveness sessions');
requireText(gateway, 'GetFaceLivenessSessionResultsCommand', 'server retrieves authoritative AWS liveness results');
requireText(gateway, 'AssumeRoleCommand', 'server issues temporary scoped client credentials');
requireText(gateway, "Action: ['rekognition:StartFaceLivenessSession']", 'temporary client policy is limited to StartFaceLivenessSession');
requireText(gateway, 'SESSION_TTL_MS = 3 * 60 * 1000', 'AWS session binding expires after three minutes');
requireText(gateway, 'MAX_SESSIONS_PER_WINDOW = 5', 'member-level liveness rate limiting');
requireText(gateway, 'reference_image_sha256', 'AWS ReferenceImage is cryptographically bound to the liveness proof');
requireText(gateway, 'face_liveness_not_above_threshold', 'low liveness fails closed');
requireText(gateway, 'face_liveness_session_expired', 'expired liveness fails closed');

requireText(comparison, 'livenessSessionId', 'CompareFaces submission carries an authenticated liveness session id');
requireText(comparison, 'face_liveness_required', 'CompareFaces cannot auto-approve without liveness proof');
requireText(comparison, 'reference_image_sha256', 'CompareFaces verifies the submitted bytes against the AWS ReferenceImage digest');
requireText(comparison, 'livenessVerified: true', 'moderation audit records liveness proof without exposing confidence to the member');

requireText(migration, 'private.member_face_liveness_sessions', 'private liveness session ledger');
requireText(migration, 'reference_image_sha256', 'ReferenceImage hash database column');
requireText(migration, 'revoke all on table private.member_face_liveness_sessions from anon, authenticated', 'client roles cannot access liveness audit rows');

requireText(client, "functions.invoke('member-face-liveness'", 'member client uses authenticated Supabase Edge gateway');
requireText(webCapture, 'FaceLivenessDetectorCore', 'web Step 8 renders real AWS Amplify Face Liveness');
requireText(webCapture, 'credentialProvider', 'web capture receives temporary credentials through a provider');
requireText(nativeBoundary, 'browser-only Amplify UI', 'native bundle is isolated from web-only Amplify Liveness');
requireText(config, '[functions.member-face-liveness]\nverify_jwt = true', 'Face Liveness Edge Function requires JWT');

if (webCapture.includes('AWS_ACCESS_KEY_ID') || webCapture.includes('AWS_SECRET_ACCESS_KEY')) {
  throw new Error('Session D Face Liveness contract violation: static AWS credentials must never be referenced by the web client');
}

console.log('Session D Face Liveness source contract passed.');
