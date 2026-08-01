import { normalizeRuntimeError, sanitizeRuntimeMetadata } from '@myfan/supabase';

type LogMetadata = Readonly<Record<string, unknown>>;

export const logger = {
  info(message: string, metadata?: LogMetadata): void {
    if (process.env.NODE_ENV !== 'production') console.warn(`[MyFan] ${message}`, sanitizeRuntimeMetadata(metadata));
  },
  error(message: string, error: unknown, metadata?: LogMetadata): void {
    console.error(`[MyFan] ${message}`, normalizeRuntimeError(error), sanitizeRuntimeMetadata(metadata));
  },
};
