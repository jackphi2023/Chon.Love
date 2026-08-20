import { describe, expect, it } from 'vitest';
import {
  MEMBER_PHOTO_PENDING_MESSAGE,
  MEMBER_PHOTO_SIMILARITY_THRESHOLD,
} from './member-photo-verification';

describe('SU-09 member photo verification contract', () => {
  it('keeps automatic approval strictly above the 60% similarity threshold', () => {
    expect(MEMBER_PHOTO_SIMILARITY_THRESHOLD).toBe(60);
  });

  it('locks the requested below-threshold manual-review copy', () => {
    expect(MEMBER_PHOTO_PENDING_MESSAGE).toBe(
      'Chúng tôi thấy ảnh chụp chưa giống trên 60% ảnh bạn upload, chúng tôi sẽ kiểm tra để xác nhận.',
    );
  });
});
