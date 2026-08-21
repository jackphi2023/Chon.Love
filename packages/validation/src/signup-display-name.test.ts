import { describe, expect, it } from 'vitest';
import { signupDisplayNameSchema } from './index';

describe('Signup V2 display name', () => {
  it('accepts 6-50 trimmed characters and rejects values outside the range', () => {
    expect(signupDisplayNameSchema.safeParse('Member').success).toBe(true);
    expect(signupDisplayNameSchema.safeParse('Short').success).toBe(false);
    expect(signupDisplayNameSchema.safeParse('A'.repeat(50)).success).toBe(true);
    expect(signupDisplayNameSchema.safeParse('A'.repeat(51)).success).toBe(false);
  });
});
