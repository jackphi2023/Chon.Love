type ErrorLike = {
  message?: unknown;
  issues?: unknown;
};

const VIETNAMESE_DIACRITIC_PATTERN = /[À-ỹ]/u;

function issueMessage(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = issueMessage(item);
      if (message) return message;
    }
    return null;
  }

  if (!value || typeof value !== 'object') return null;
  const candidate = value as ErrorLike;
  if (Array.isArray(candidate.issues)) {
    const message = issueMessage(candidate.issues);
    if (message) return message;
  }
  return typeof candidate.message === 'string' && candidate.message.trim()
    ? candidate.message.trim()
    : null;
}

function parseSerializedErrorMessage(raw: string): string | null {
  const normalized = raw.trim();
  if (!normalized || (!normalized.startsWith('[') && !normalized.startsWith('{'))) return null;
  try {
    return issueMessage(JSON.parse(normalized));
  } catch {
    return null;
  }
}

/**
 * Extract only text that is safe and useful to show directly in a form warning.
 * Technical PostgREST/RPC codes and serialized validation payloads never leak through.
 */
export function getUserFacingFormIssue(error: unknown): string | null {
  const structured = issueMessage(error);
  if (structured && structured !== (error instanceof Error ? error.message.trim() : '')) {
    return structured;
  }

  const raw = error instanceof Error
    ? error.message.trim()
    : typeof error === 'string'
      ? error.trim()
      : '';
  if (!raw) return null;

  const serialized = parseSerializedErrorMessage(raw);
  if (serialized) return serialized;

  if (
    VIETNAMESE_DIACRITIC_PATTERN.test(raw)
    && !raw.startsWith('[')
    && !raw.startsWith('{')
    && !/\b(postgrest|postgres|supabase|rpc|server|sqlstate|error code)\b/iu.test(raw)
  ) {
    return raw;
  }

  return null;
}
