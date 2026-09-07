from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one anchor, found {count}: {old[:100]!r}")
    target.write_text(text.replace(old, new, 1))


liveness = "supabase/functions/member-face-liveness/index.ts"
replace_once(
    liveness,
    "const RATE_LIMIT_RETRY_SECONDS = 30 * 60;",
    "const RATE_LIMIT_RETRY_SECONDS = Math.ceil(RATE_WINDOW_MS / 1000);",
)
replace_once(
    liveness,
    "function bytesToBase64(bytes: Uint8Array): string {",
    """function detectImageMimeType(bytes: Uint8Array): 'image/jpeg' | 'image/png' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {""",
)
old_reference = """    const referenceImageSha256 = await sha256Hex(referenceBytes);
    await updateLivenessSession(server, bound.id, {
      state: 'completed',
      aws_status: awsStatus,
      confidence,
      reference_image_sha256: referenceImageSha256,
      completed_at: new Date().toISOString(),
      error_code: null,
    });"""
new_reference = """    const referenceMimeType = detectImageMimeType(referenceBytes);
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
    });"""
replace_once(liveness, old_reference, new_reference)
replace_once(liveness, "        mimeType: 'image/jpeg',", "        mimeType: referenceMimeType,")

comparison = "supabase/functions/member-photo-verification/index.ts"
replace_once(
    comparison,
    "function pageLimit(value: unknown): number {",
    """function detectImageMimeType(bytes: Uint8Array): 'image/jpeg' | 'image/png' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  return null;
}

function pageLimit(value: unknown): number {""",
)
replace_once(
    comparison,
    """    if (typeof body.selfieBase64 !== 'string' || body.mimeType !== 'image/jpeg') {
      return respond(400, { error: 'jpeg_selfie_required' });
    }

    const selfieBytes = decodeBase64Image(body.selfieBase64);""",
    """    if (typeof body.selfieBase64 !== 'string' || (body.mimeType !== 'image/jpeg' && body.mimeType !== 'image/png')) {
      return respond(400, { error: 'supported_selfie_image_required' });
    }

    const selfieBytes = decodeBase64Image(body.selfieBase64);
    const detectedSelfieMimeType = detectImageMimeType(selfieBytes);
    if (!detectedSelfieMimeType || detectedSelfieMimeType !== body.mimeType) {
      return respond(400, { error: 'selfie_image_type_mismatch' });
    }""",
)
replace_once(
    comparison,
    """    const selfieStoragePath = `${actorId}/${attemptId}/selfie.jpg`;
    const { error: uploadError } = await server.storage
      .from('member-verification')
      .upload(selfieStoragePath, selfieBytes, { contentType: 'image/jpeg', cacheControl: '0', upsert: false });""",
    """    const selfieExtension = detectedSelfieMimeType === 'image/png' ? 'png' : 'jpg';
    const selfieStoragePath = `${actorId}/${attemptId}/selfie.${selfieExtension}`;
    const { error: uploadError } = await server.storage
      .from('member-verification')
      .upload(selfieStoragePath, selfieBytes, { contentType: detectedSelfieMimeType, cacheControl: '0', upsert: false });""",
)

validator = "scripts/validate-session-d-face-liveness.mjs"
replace_once(
    validator,
    "requireText(gateway, 'face_liveness_session_expired', 'expired liveness fails closed');",
    """requireText(gateway, 'face_liveness_session_expired', 'expired liveness fails closed');
requireText(gateway, 'detectImageMimeType', 'AWS ReferenceImage format is detected from bytes instead of assumed');
requireText(gateway, 'RATE_LIMIT_RETRY_SECONDS = Math.ceil(RATE_WINDOW_MS / 1000)', 'rate-limit retry metadata matches the enforcement window');""",
)
replace_once(
    validator,
    "requireText(comparison, 'livenessVerified: true', 'moderation audit records liveness proof without exposing confidence to the member');",
    """requireText(comparison, 'livenessVerified: true', 'moderation audit records liveness proof without exposing confidence to the member');
requireText(comparison, 'selfie_image_type_mismatch', 'CompareFaces storage MIME must match the cryptographically-bound image bytes');""",
)
