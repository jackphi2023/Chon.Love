const decoder = new TextDecoder();

function decodeBase64(value: string): Uint8Array {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function importDecryptionKey(encoded: string): Promise<CryptoKey> {
  const bytes = decodeBase64(encoded.trim());
  if (bytes.length !== 32) throw new Error('invalid_pii_encryption_key_length');
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['decrypt']);
}

export async function decryptText(key: CryptoKey, encoded: string): Promise<string> {
  const parts = encoded.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') throw new Error('invalid_ciphertext_version');
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decodeBase64(parts[1]!) }, key, decodeBase64(parts[2]!));
  return decoder.decode(plaintext);
}
