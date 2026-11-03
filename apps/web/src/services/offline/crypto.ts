import type { OfflineStore } from './store';

/**
 * Cifrado en reposo de los datos locales (RNF23): AES-GCM con una clave por
 * cuenta no extraíble, guardada como `CryptoKey` en el mismo almacén. Protege
 * frente a leer el disco; no frente a XSS ni a una sesión del navegador abierta.
 */

export interface EncryptedPayload {
  iv: ArrayBuffer;
  data: ArrayBuffer;
}

const subtle = (): SubtleCrypto | null => globalThis.crypto?.subtle ?? null;

const keyName = (accountId: string) => `key:${accountId}`;

async function keyFor(
  store: OfflineStore,
  accountId: string,
  create: boolean
): Promise<CryptoKey | null> {
  const engine = subtle();
  if (!engine) return null;
  const existing = await store.get<CryptoKey>('meta', keyName(accountId));
  if (existing) return existing;
  if (!create) return null;
  const key = await engine.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  await store.put('meta', keyName(accountId), key);
  return key;
}

export async function encryptJson(
  store: OfflineStore,
  accountId: string,
  value: unknown
): Promise<EncryptedPayload | null> {
  const engine = subtle();
  const key = await keyFor(store, accountId, true);
  if (!engine || !key) return null;
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const data = await engine.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(value))
  );
  return { iv: iv.buffer as ArrayBuffer, data };
}

export async function decryptJson<T>(
  store: OfflineStore,
  accountId: string,
  payload: EncryptedPayload
): Promise<T | null> {
  const engine = subtle();
  const key = await keyFor(store, accountId, false);
  if (!engine || !key) return null;
  try {
    const plain = await engine.decrypt(
      { name: 'AES-GCM', iv: payload.iv },
      key,
      payload.data
    );
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    return null;
  }
}

/** Huella para nombrar entradas sin dejar a la vista rutas ni términos de búsqueda. */
export async function fingerprint(value: string): Promise<string | null> {
  const engine = subtle();
  if (!engine) return null;
  const digest = await engine.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
