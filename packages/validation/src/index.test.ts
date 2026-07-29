import { describe, expect, it } from 'vitest';
import { adultDateOfBirthSchema, emailSchema, isAtLeastAge, usernameSchema } from './index';

describe('shared validation', () => {
  it('normalizes email addresses', () => {
    expect(emailSchema.parse(' Adult@Example.COM ')).toBe('adult@example.com');
  });

  it('rejects unsafe usernames', () => {
    expect(usernameSchema.safeParse('bad name').success).toBe(false);
  });

  it('checks the 18th birthday boundary', () => {
    const now = new Date('2026-07-29T00:00:00.000Z');
    expect(isAtLeastAge('2008-07-29', 18, now)).toBe(true);
    expect(isAtLeastAge('2008-07-30', 18, now)).toBe(false);
    expect(adultDateOfBirthSchema.safeParse('2010-01-01').success).toBe(false);
  });
});
