import { describe, expect, it } from 'vitest';
import {
  RuntimeCircuitBreaker,
  normalizeRuntimeError,
  runtimeRetryDelayMs,
  sanitizeRuntimeMetadata,
  shouldRetryRuntimeRequest,
} from './runtime-observability';

describe('runtime observability privacy', () => {
  it('keeps only allowlisted primitive metadata', () => {
    expect(sanitizeRuntimeMetadata({
      feature: 'discovery',
      attempt: 2,
      retryable: true,
      access_token: 'secret',
      email: 'person@example.com',
      nested: { unsafe: true },
    })).toEqual({ feature: 'discovery', attempt: 2, retryable: true });
  });

  it('normalizes errors without retaining messages', () => {
    const error = Object.assign(new Error('fetch failed for person@example.com'), { status: 503, code: 'UPSTREAM DOWN' });
    expect(normalizeRuntimeError(error)).toEqual({
      name: 'Error',
      errorCode: 'upstream_down',
      httpStatus: 503,
      retryable: true,
    });
  });
});

describe('runtime resilience policy', () => {
  it('retries transient reads at most twice', () => {
    const error = Object.assign(new Error('timeout'), { status: 503 });
    expect(shouldRetryRuntimeRequest(0, error, 'read')).toBe(true);
    expect(shouldRetryRuntimeRequest(1, error, 'read')).toBe(true);
    expect(shouldRetryRuntimeRequest(2, error, 'read')).toBe(false);
  });

  it.each(['financial', 'non_idempotent_write', 'auth'] as const)(
    'never automatically retries %s operations',
    (operationClass) => {
      expect(shouldRetryRuntimeRequest(0, new TypeError('network request failed'), operationClass)).toBe(false);
    },
  );

  it('uses bounded exponential backoff with jitter', () => {
    expect(runtimeRetryDelayMs(0, () => 0)).toBe(400);
    expect(runtimeRetryDelayMs(3, () => 0.5)).toBe(4_000);
    expect(runtimeRetryDelayMs(20, () => 1)).toBe(9_600);
  });

  it('opens and recovers a circuit after transient failures', () => {
    let now = 1_000;
    const breaker = new RuntimeCircuitBreaker({ failureThreshold: 2, coolDownMs: 5_000, now: () => now });
    expect(breaker.canRequest()).toBe(true);
    breaker.recordFailure(new TypeError('network'));
    breaker.recordFailure(new TypeError('network'));
    expect(breaker.getState()).toBe('open');
    expect(breaker.canRequest()).toBe(false);
    now += 5_001;
    expect(breaker.getState()).toBe('half_open');
    expect(breaker.canRequest()).toBe(true);
    expect(breaker.canRequest()).toBe(false);
    breaker.recordSuccess();
    expect(breaker.getState()).toBe('closed');
  });
});
