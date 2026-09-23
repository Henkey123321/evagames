/* WebCrypto helpers. Workers cap PBKDF2 at 100k iterations. */

const encoder = new TextEncoder();
const PBKDF2_ITERATIONS = 100_000;

export function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	return out;
}

export function base64UrlEncode(bytes: Uint8Array): string {
	let binary = '';
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(input: string): Uint8Array {
	const base64 = input
		.replace(/-/g, '+')
		.replace(/_/g, '/')
		.padEnd(Math.ceil(input.length / 4) * 4, '=');
	const binary = atob(base64);
	return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function randomBytes(length: number): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(length));
}

/** URL-safe random token (default 160 bits). */
export function randomToken(bytes = 20): string {
	return base64UrlEncode(randomBytes(bytes));
}

export async function sha256Hex(input: string): Promise<string> {
	return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(input))));
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
	return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(password.normalize('NFKC')),
		'PBKDF2',
		false,
		['deriveBits']
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
		key,
		256
	);
	return new Uint8Array(bits);
}

/** Returns `pbkdf2-sha256$<iterations>$<salt hex>$<hash hex>`. */
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
	return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [scheme, iterations, saltHex, hashHex] = stored.split('$');
	if (scheme !== 'pbkdf2-sha256' || !iterations || !saltHex || !hashHex) return false;
	const hash = await pbkdf2(password, hexToBytes(saltHex), Number(iterations));
	return timingSafeEqual(hash, hexToBytes(hashHex));
}

/** A hash to compare against when the user doesn't exist, so timing doesn't leak usernames. */
export const DUMMY_PASSWORD_HASH =
	'pbkdf2-sha256$100000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'; // no 0/O, 1/I/L, U

/** Human-friendly one-time code like `K7QM-3XWD-9PRA`. */
export function recoveryCode(): string {
	const bytes = randomBytes(12);
	const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
	return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

/** Normalises user-typed codes (case, spaces, dashes) before hashing. */
export function normalizeRecoveryCode(input: string): string {
	return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
