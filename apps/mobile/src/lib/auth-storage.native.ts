import type { SupabaseAuthStorage } from '@myfan/supabase';
import * as SecureStore from 'expo-secure-store';

const KEY_PREFIX = 'myfan.auth.';
const CHUNK_SIZE = 400;

type ChunkMetadata = {
  version: 1;
  generation: string;
  count: number;
};

function normalizeKey(key: string): string {
  return `${KEY_PREFIX}${key.replace(/[^A-Za-z0-9._-]/gu, '_')}`;
}

function metadataKey(baseKey: string): string {
  return `${baseKey}.meta`;
}

function chunkKey(baseKey: string, generation: string, index: number): string {
  return `${baseKey}.${generation}.${index}`;
}

async function readMetadata(baseKey: string): Promise<ChunkMetadata | null> {
  const raw = await SecureStore.getItemAsync(metadataKey(baseKey));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ChunkMetadata>;
    if (value.version !== 1 || !value.generation || !Number.isInteger(value.count) || (value.count ?? 0) < 1) {
      return null;
    }
    return value as ChunkMetadata;
  } catch {
    return null;
  }
}

async function removeGeneration(baseKey: string, metadata: ChunkMetadata | null): Promise<void> {
  if (!metadata) return;
  await Promise.all(
    Array.from({ length: metadata.count }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(baseKey, metadata.generation, index)),
    ),
  );
}

async function getItem(key: string): Promise<string | null> {
  const baseKey = normalizeKey(key);
  const metadata = await readMetadata(baseKey);
  if (!metadata) {
    // Backward-compatible cleanup path for any pre-BR-11 single-value entry.
    return SecureStore.getItemAsync(baseKey);
  }
  const chunks = await Promise.all(
    Array.from({ length: metadata.count }, (_, index) =>
      SecureStore.getItemAsync(chunkKey(baseKey, metadata.generation, index)),
    ),
  );
  if (chunks.some((chunk) => chunk === null)) return null;
  return chunks.join('');
}

async function setItem(key: string, value: string): Promise<void> {
  const baseKey = normalizeKey(key);
  const previous = await readMetadata(baseKey);
  const generation = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'gsu')) ?? [''];

  await Promise.all(
    chunks.map((chunk, index) =>
      SecureStore.setItemAsync(chunkKey(baseKey, generation, index), chunk),
    ),
  );
  await SecureStore.setItemAsync(
    metadataKey(baseKey),
    JSON.stringify({ version: 1, generation, count: chunks.length } satisfies ChunkMetadata),
  );
  await SecureStore.deleteItemAsync(baseKey);
  await removeGeneration(baseKey, previous);
}

async function removeItem(key: string): Promise<void> {
  const baseKey = normalizeKey(key);
  const metadata = await readMetadata(baseKey);
  await SecureStore.deleteItemAsync(metadataKey(baseKey));
  await SecureStore.deleteItemAsync(baseKey);
  await removeGeneration(baseKey, metadata);
}

/**
 * Supabase native auth storage backed by Android Keystore / iOS Keychain via
 * Expo SecureStore. Values are chunked to avoid historical platform payload
 * limits for larger PKCE session payloads.
 */
export const mobileAuthStorage: SupabaseAuthStorage = {
  getItem,
  setItem,
  removeItem,
};
