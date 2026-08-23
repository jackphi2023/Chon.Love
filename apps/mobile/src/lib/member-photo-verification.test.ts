import { describe, expect, it } from 'vitest';
import {
  MEMBER_PHOTO_PENDING_MESSAGE,
  MEMBER_PHOTO_SIMILARITY_THRESHOLD,
  normalizeMemberPhotoVerificationResult,
} from './member-photo-verification';

describe('member photo verification contract', () => {
  it('keeps the AWS compatibility threshold at 60%', () => {
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

  it('preserves a real AWS sub-threshold percentage instead of collapsing it to zero', () => {
    const result = normalizeMemberPhotoVerificationResult({
      state: 'pending_review',
      threshold: 60,
      provider: 'aws_rekognition_compare_faces',
      providerMetric: 'percent',
      maxSimilarity: 57.42,
      reason: 'face_similarity_not_above_threshold',
      retryable: false,
    });

    expect(result.maxSimilarity).toBe(57.42);
    expect(result.providerMetric).toBe('percent');
    expect(result.threshold).toBe(MEMBER_PHOTO_SIMILARITY_THRESHOLD);
  });

  it('keeps local SFace cosine metadata separate from percentage similarity', () => {
    const result = normalizeMemberPhotoVerificationResult({
      state: 'pending_review',
      threshold: 60,
      provider: 'local_face_worker_sface',
      providerConfigured: true,
      providerMetric: 'cosine',
      localCosineThreshold: 0.363,
      localMinimumStrongMatches: 2,
      maxSimilarity: null,
      reason: 'face_similarity_not_above_local_threshold',
    });

    expect(result.provider).toBe('local_face_worker_sface');
    expect(result.providerConfigured).toBe(true);
    expect(result.providerMetric).toBe('cosine');
    expect(result.localCosineThreshold).toBe(0.363);
    expect(result.localMinimumStrongMatches).toBe(2);
    expect(result.maxSimilarity).toBeNull();
  });
});
