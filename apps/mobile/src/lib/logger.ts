type LogMetadata = Readonly<Record<string, unknown>>;
const REDACTED_KEYS = new Set(['access_token', 'refresh_token', 'purchase_token', 'latitude', 'longitude']);

export const logger = {
  info(message: string, metadata?: LogMetadata): void {
    if (__DEV__) console.info(`[MyFan] ${message}`, sanitize(metadata));
  },
  error(message: string, error: unknown, metadata?: LogMetadata): void {
    console.error(`[MyFan] ${message}`, normalizeError(error), sanitize(metadata));
  },
};

function sanitize(metadata: LogMetadata | undefined): LogMetadata | undefined {
  if (!metadata) return undefined;
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [key, REDACTED_KEYS.has(key) ? '[REDACTED]' : value]),
  );
}

function normalizeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: 'UnknownError', message: String(error) };
}
