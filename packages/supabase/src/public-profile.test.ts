import { describe, expect, it } from 'vitest';
import { publicProfileCodeFromRouteId, toPublicMemberPath } from './public-profile';

describe('public Chọn.love member routes', () => {
  it('parses only canonical id-xxxxxx public codes', () => {
    expect(publicProfileCodeFromRouteId('id-a1b2c3')).toBe('a1b2c3');
    expect(publicProfileCodeFromRouteId('ID-A1B2C3')).toBe('a1b2c3');
    expect(publicProfileCodeFromRouteId('love16')).toBeNull();
    expect(publicProfileCodeFromRouteId('id-123')).toBeNull();
    expect(publicProfileCodeFromRouteId('id-12345678-1234-1234-1234-123456789abc')).toBeNull();
  });

  it('builds canonical public member paths without usernames or auth UUIDs', () => {
    expect(toPublicMemberPath('A1B2C3')).toBe('/thanh-vien/id-a1b2c3');
    expect(() => toPublicMemberPath('love16')).toThrow('invalid_public_profile_code');
  });
});