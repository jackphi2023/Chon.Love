import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { getUserFacingFormIssue } from './readable-form-error';

describe('getUserFacingFormIssue', () => {
  it('extracts a clean Zod issue message instead of serialized issue JSON', () => {
    const schema = z.string().min(50, 'Hãy chia sẻ ít nhất 50 ký tự về người hoặc mối quan hệ bạn đang tìm kiếm.');
    let error: unknown;
    try {
      schema.parse('ngắn');
    } catch (caught) {
      error = caught;
    }

    expect(getUserFacingFormIssue(error)).toBe(
      'Hãy chia sẻ ít nhất 50 ký tự về người hoặc mối quan hệ bạn đang tìm kiếm.',
    );
  });

  it('extracts a message from Zod v4 serialized issue JSON', () => {
    const serialized = '[ { "origin": "string", "code": "too_small", "minimum": 50, "inclusive": true, "path": [], "message": "Hãy chia sẻ ít nhất 50 ký tự về người hoặc mối quan hệ bạn đang tìm kiếm." } ]';
    expect(getUserFacingFormIssue(new Error(serialized))).toBe(
      'Hãy chia sẻ ít nhất 50 ký tự về người hoặc mối quan hệ bạn đang tìm kiếm.',
    );
  });

  it('preserves a plain friendly Vietnamese warning', () => {
    expect(getUserFacingFormIssue(new Error('Chọn tối đa 7 mục tiêu / phong cách.')))
      .toBe('Chọn tối đa 7 mục tiêu / phong cách.');
  });

  it('does not expose technical server errors', () => {
    expect(getUserFacingFormIssue(new Error('PostgREST error code PGRST202 from RPC server'))).toBeNull();
  });
});
