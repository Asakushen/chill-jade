const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PBKDF2_ITERATIONS = 100_000;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derive(password: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt.buffer as ArrayBuffer, iterations },
    material,
    256,
  );
  return new Uint8Array(bits);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a[index] ^ b[index];
  return result === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const digest = await derive(password, salt);
  return `${PBKDF2_ITERATIONS}:${bytesToBase64Url(salt)}:${bytesToBase64Url(digest)}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [iterationsRaw, saltRaw, digestRaw] = encoded.split(":");
  const iterations = Number(iterationsRaw);
  if (!iterations || !saltRaw || !digestRaw) return false;
  try {
    return timingSafeEqual(await derive(password, base64UrlToBytes(saltRaw), iterations), base64UrlToBytes(digestRaw));
  } catch {
    return false;
  }
}

async function hmac(data: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

export async function createSessionToken(secret: string, expiresAt: number): Promise<string> {
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({ exp: expiresAt, nonce: crypto.randomUUID() })));
  return `${payload}.${bytesToBase64Url(await hmac(payload, secret))}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): Promise<{ exp: number; nonce: string } | null> {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  try {
    const expected = await hmac(payload, secret);
    if (!timingSafeEqual(expected, base64UrlToBytes(signature))) return null;
    const parsed = JSON.parse(decoder.decode(base64UrlToBytes(payload))) as { exp?: number; nonce?: string };
    if (typeof parsed.exp !== "number" || typeof parsed.nonce !== "string" || parsed.exp < now) return null;
    return { exp: parsed.exp, nonce: parsed.nonce };
  } catch {
    return null;
  }
}
