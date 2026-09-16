/**
 * Client-side PIN hashing helpers built on the Web Crypto API.
 *
 * PINs are never stored or compared in plain text. Each credential gets a
 * random salt and is stretched with PBKDF2 (SHA-256, 100k iterations)
 * before being persisted, so a leaked/local-storage dump doesn't hand over
 * usable PINs.
 */

const PBKDF2_ITERATIONS = 100_000;
const DERIVED_KEY_BITS = 256;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] ?? 0);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomSaltBase64(byteLength: number = 16): string {
  const bytes = new Uint8Array(new ArrayBuffer(byteLength));
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

async function deriveBits(secret: string, saltBase64: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: base64ToBytes(saltBase64),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    DERIVED_KEY_BITS,
  );
  return bytesToBase64(new Uint8Array(bits));
}

/** Constant-time-ish string comparison to avoid trivial timing leaks. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function hashSecret(secret: string): Promise<{ salt: string; hash: string }> {
  const salt = randomSaltBase64();
  const hash = await deriveBits(secret, salt);
  return { salt, hash };
}

export async function verifySecret(secret: string, salt: string, hash: string): Promise<boolean> {
  const candidate = await deriveBits(secret, salt);
  return safeEqual(candidate, hash);
}
