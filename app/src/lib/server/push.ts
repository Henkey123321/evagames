/*
 * Web Push for Workers, on WebCrypto only.
 *  - Payload encryption: RFC 8291 (aes128gcm content coding, RFC 8188)
 *  - Server identification: RFC 8292 (VAPID, ES256 JWT)
 */
import { eq, sql } from 'drizzle-orm';
import type { Db } from './db';
import { pushSubscriptions } from './db/schema';
import { base64UrlDecode, base64UrlEncode } from './crypto';

export interface PushTarget {
	endpoint: string;
	p256dh: string;
	auth: string;
}

export interface VapidKeys {
	/** Uncompressed P-256 public key (65 bytes), base64url. */
	publicKey: string;
	/** P-256 private scalar `d` (32 bytes), base64url. */
	privateKey: string;
	/** mailto: or https: contact for the push service. */
	subject: string;
}

export interface PushMessage {
	title: string;
	body: string;
	url?: string;
	tag?: string;
}

const encoder = new TextEncoder();
const RECORD_SIZE = 4096;

function concat(...parts: Uint8Array[]): Uint8Array {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let offset = 0;
	for (const p of parts) {
		out.set(p, offset);
		offset += p.length;
	}
	return out;
}

async function hkdf(
	salt: Uint8Array,
	ikm: Uint8Array,
	info: Uint8Array,
	length: number
): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, [
		'deriveBits'
	]);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource },
		key,
		length * 8
	);
	return new Uint8Array(bits);
}

/** RFC 8291 §3.4: encrypts `plaintext` for one subscription as a single aes128gcm record. */
export async function encryptPayload(
	target: Pick<PushTarget, 'p256dh' | 'auth'>,
	plaintext: Uint8Array,
	salt: Uint8Array = crypto.getRandomValues(new Uint8Array(16))
): Promise<Uint8Array> {
	const uaPublic = base64UrlDecode(target.p256dh);
	const authSecret = base64UrlDecode(target.auth);
	if (uaPublic.length !== 65 || authSecret.length !== 16)
		throw new Error('Invalid push subscription keys');
	if (plaintext.length > RECORD_SIZE - 17 - 86) throw new Error('Push payload too large');

	const asKeys = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
		'deriveBits'
	])) as CryptoKeyPair;
	const asPublic = new Uint8Array(
		(await crypto.subtle.exportKey('raw', asKeys.publicKey)) as ArrayBuffer
	);
	const uaKey = await crypto.subtle.importKey(
		'raw',
		uaPublic as BufferSource,
		{ name: 'ECDH', namedCurve: 'P-256' },
		false,
		[]
	);
	const ecdhSecret = new Uint8Array(
		await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256)
	);

	const keyInfo = concat(encoder.encode('WebPush: info\0'), uaPublic, asPublic);
	const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
	const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
	const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12);

	// Single final record: data || 0x02 delimiter, no padding.
	const record = concat(plaintext, new Uint8Array([2]));
	const aesKey = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, [
		'encrypt'
	]);
	const ciphertext = new Uint8Array(
		await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv: nonce as BufferSource },
			aesKey,
			record as BufferSource
		)
	);

	const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
	header.set(salt, 0);
	new DataView(header.buffer).setUint32(16, RECORD_SIZE);
	header[20] = asPublic.length;
	header.set(asPublic, 21);
	return concat(header, ciphertext);
}

/** RFC 8292: `Authorization: vapid t=<jwt>, k=<public key>` for the endpoint's origin. */
export async function vapidAuthorization(
	endpoint: string,
	keys: VapidKeys,
	nowSeconds = Math.floor(Date.now() / 1000)
) {
	const publicBytes = base64UrlDecode(keys.publicKey);
	if (publicBytes.length !== 65)
		throw new Error('VAPID public key must be an uncompressed P-256 point');
	const jwk: JsonWebKey = {
		kty: 'EC',
		crv: 'P-256',
		d: keys.privateKey,
		x: base64UrlEncode(publicBytes.slice(1, 33)),
		y: base64UrlEncode(publicBytes.slice(33, 65)),
		ext: true
	};
	const signingKey = await crypto.subtle.importKey(
		'jwk',
		jwk,
		{ name: 'ECDSA', namedCurve: 'P-256' },
		false,
		['sign']
	);

	const header = base64UrlEncode(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
	const claims = base64UrlEncode(
		encoder.encode(
			JSON.stringify({
				aud: new URL(endpoint).origin,
				exp: nowSeconds + 12 * 60 * 60,
				sub: keys.subject
			})
		)
	);
	const signingInput = `${header}.${claims}`;
	// WebCrypto ECDSA returns raw r||s, which is exactly the JWS ES256 format.
	const signature = new Uint8Array(
		await crypto.subtle.sign(
			{ name: 'ECDSA', hash: 'SHA-256' },
			signingKey,
			encoder.encode(signingInput)
		)
	);
	return `vapid t=${signingInput}.${base64UrlEncode(signature)}, k=${keys.publicKey}`;
}

export type PushResult = 'sent' | 'gone' | 'failed';

export async function sendPush(
	target: PushTarget,
	message: PushMessage,
	keys: VapidKeys,
	ttlSeconds = 86400
) {
	const body = await encryptPayload(target, encoder.encode(JSON.stringify(message)));
	const res = await fetch(target.endpoint, {
		method: 'POST',
		headers: {
			Authorization: await vapidAuthorization(target.endpoint, keys),
			'Content-Encoding': 'aes128gcm',
			'Content-Type': 'application/octet-stream',
			TTL: String(ttlSeconds),
			Urgency: 'normal'
		},
		body: body as BodyInit
	});
	if (res.status === 404 || res.status === 410) return 'gone' as const;
	return res.ok ? ('sent' as const) : ('failed' as const);
}

export function vapidFromEnv(env: Env): VapidKeys | null {
	const publicKey = env.VAPID_PUBLIC_KEY;
	const privateKey = env.VAPID_PRIVATE_KEY;
	if (!publicKey || !privateKey) return null;
	return { publicKey, privateKey, subject: env.VAPID_SUBJECT || 'https://evagames.org' };
}

/**
 * Sends a notification to every device a user subscribed. Dead subscriptions are removed;
 * repeatedly failing ones are dropped after 5 failures.
 */
export async function notifyUser(db: Db, env: Env, userId: string, message: PushMessage) {
	const keys = vapidFromEnv(env);
	if (!keys) return { sent: 0, skipped: 'push not configured' as const };
	const subs = await db
		.select()
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.userId, userId));
	let sent = 0;
	for (const sub of subs) {
		const result = await sendPush(sub, message, keys).catch(() => 'failed' as const);
		if (result === 'sent') {
			sent += 1;
			if (sub.failureCount)
				await db
					.update(pushSubscriptions)
					.set({ failureCount: 0 })
					.where(eq(pushSubscriptions.id, sub.id));
		} else if (result === 'gone' || sub.failureCount >= 4) {
			await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
		} else {
			await db
				.update(pushSubscriptions)
				.set({ failureCount: sql`${pushSubscriptions.failureCount} + 1` })
				.where(eq(pushSubscriptions.id, sub.id));
		}
	}
	return { sent };
}
