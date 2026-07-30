import { describe, expect, it } from 'vitest';
import { getReadableLocationError } from './location-errors';

describe('location errors', () => {
  it('keeps Nearby usable when permission is denied', () => {
    expect(getReadableLocationError(new Error('location_permission_denied'))).toContain(
      'vẫn hiển thị nhưng không có khoảng cách',
    );
  });

  it('handles browser timeout without exposing coordinates', () => {
    expect(getReadableLocationError(new Error('location_timeout'))).toContain('thử lại');
  });
});
