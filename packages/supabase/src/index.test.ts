import { describe, expect, it } from 'vitest';
import { parsePublicSupabaseEnvironment } from './index';

const safeAnonKey = 'sb_publishable_br06_local_test_key';

describe('parsePublicSupabaseEnvironment', () => {
  it('accepts HTTPS by default', () => {
    expect(
      parsePublicSupabaseEnvironment({
        url: 'https://example.supabase.co',
        anonKey: safeAnonKey,
      }),
    ).toEqual({
      url: 'https://example.supabase.co',
      anonKey: safeAnonKey,
    });
  });

  it('rejects localhost HTTP unless explicitly allowed', () => {
    expect(() =>
      parsePublicSupabaseEnvironment({
        url: 'http://localhost:54321',
        anonKey: safeAnonKey,
      }),
    ).toThrow('Supabase URL must use HTTPS unless local development explicitly allows localhost HTTP.');
  });

  it.each(['http://localhost:54321', 'http://127.0.0.1:54321'])(
    'accepts explicit local development HTTP for %s',
    (url) => {
      expect(
        parsePublicSupabaseEnvironment(
          { url, anonKey: safeAnonKey },
          { allowInsecureLocalhost: true },
        ),
      ).toEqual({ url, anonKey: safeAnonKey });
    },
  );

  it('rejects remote HTTP even when local development HTTP is enabled', () => {
    expect(() =>
      parsePublicSupabaseEnvironment(
        {
          url: 'http://192.168.1.20:54321',
          anonKey: safeAnonKey,
        },
        { allowInsecureLocalhost: true },
      ),
    ).toThrow('Supabase URL must use HTTPS unless local development explicitly allows localhost HTTP.');
  });

  it.each(['sb_secret_forbidden_browser_key', 'public_service_role_forbidden_key'])('
    rejects unsafe browser credential %s',
    (anonKey) => {
      expect(() =>
        parsePublicSupabaseEnvironment({
          url: 'https://example.supabase.co',
          anonKey,
        }),
      ).toThrow('Secret and service-role keys must never be used in a client bundle.');
    },
  );
});
