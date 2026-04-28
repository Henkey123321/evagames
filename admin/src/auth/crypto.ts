/**
 * Password hashing using Web Crypto API (PBKDF2).
 * Works in Cloudflare Workers without Node.js crypto.
 */

const ITERATIONS = 100_000;
const KEY_LENGTH = 64; // bytes
const HASH_ALGO = "SHA-256";

export function generateSalt(): string {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return arrayToHex(buffer);
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: ITERATIONS, hash: HASH_ALGO },
    keyMaterial,
    KEY_LENGTH * 8,
  );

  return arrayToHex(new Uint8Array(bits));
}

export async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password, salt);
  // Constant-time comparison
  if (computed.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return diff === 0;
}

function arrayToHex(arr: Uint8Array): string {
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── JWT using Web Crypto (HMAC-SHA256) ──

interface JWTPayload {
  sub: number;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

function base64UrlEncode(data: string): string {
  return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(data: string): string {
  const padded = data + "===".slice(0, (4 - (data.length % 4)) % 4);
  return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
}

async function getSigningKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signJWT(payload: Omit<JWTPayload, "iat" | "exp">, secret: string, expiresInHours = 24): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = { ...payload, iat: now, exp: now + expiresInHours * 3600 };

  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(fullPayload));
  const unsigned = `${header}.${body}`;

  const key = await getSigningKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(unsigned));
  const signature = base64UrlEncode(String.fromCharCode(...new Uint8Array(sig)));

  return `${unsigned}.${signature}`;
}

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const unsigned = `${header}.${body}`;

  const key = await getSigningKey(secret);
  const sigBytes = Uint8Array.from(base64UrlDecode(signature), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(unsigned));

  if (!valid) return null;

  const payload: JWTPayload = JSON.parse(base64UrlDecode(body));
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}
