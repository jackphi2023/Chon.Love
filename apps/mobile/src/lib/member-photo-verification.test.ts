import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MEMBER_PHOTO_PENDING_MESSAGE,
  MEMBER_PHOTO_SIMILARITY_THRESHOLD,
  normalizeMemberPhotoVerificationResult,
} from './member-photo-verification';

describe('member photo verification contract', () => {
  it('keeps automatic approval strictly above the 60% business threshold', () => {
    expect(MEMBER_PHOTO_SIMILARITY_THRESHOLD).toBe(60);
  });

  it('uses neutral manual-review copy instead of claiming a false similarity result', () => {
    expect(MEMBER_PHOTO_PENDING_MESSAGE).toBe(
      'Ảnh xác minh cần được kiểm tra thêm trước khi hồ sơ có thể kích hoạt.',
    );
  });

  it('does not invent a 0% score when the provider did not calculate one', () => {
    const result = normalizeMemberPhotoVerificationResult({
      state: 'pending_review',
      threshold: 60,
      maxSimilarity: null,
      reason: 'face_comparison_provider_not_configured',
      retryable: false,
      message: 'Dịch vụ tạm thời chưa sẵn sàng.',
    });

    expect(result.maxSimilarity).toBeNull();
    expect(result.retryable).toBe(false);
  });

  it('preserves a real sub-threshold score instead of collapsing it to zero', () => {
    const result = normalizeMemberPhotoVerificationResult({
      state: 'pending_review',
      threshold: 60,
      maxSimilarity: 57.42,
      reason: 'face_similarity_not_above_threshold',
      retryable: false,
    });

    expect(result.maxSimilarity).toBe(57.42);
    expect(result.threshold).toBe(MEMBER_PHOTO_SIMILARITY_THRESHOLD);
  });

  it('keeps the Rekognition request threshold separate from the Chon.Love business threshold', () => {
    const source = readFileSync('supabase/functions/member-photo-verification/index.ts', 'utf8');
    expect(source).toContain('const REKOGNITION_REQUEST_THRESHOLD = 0;');
    expect(source).toContain('SimilarityThreshold: REKOGNITION_REQUEST_THRESHOLD');
    expect(source).toContain('maxSimilarity: maxSimilarity == null ? null');
    expect(source).toContain("pendingReason = 'face_comparison_provider_not_configured'");
  });
});
