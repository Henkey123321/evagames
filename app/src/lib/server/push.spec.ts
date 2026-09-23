import { describe, expect, it } from 'vitest';
import { createECDH, randomBytes } from 'node:crypto';
// Reference RFC 8188 implementation used by the `web-push` npm package.
import ece from 'http_ece';
import { encryptPayload, vapidAuthorization } from './push';
import { base64UrlDecode, base64UrlEncode } from './crypto';

describe('web push payload encryption (RFC 8291)', () => {
	it('produces a body the reference decoder can decrypt', async () => {
		const ua = createECDH('prime256v1');
		ua.generateKeys();
		const auth = randomBytes(16);
		const message = JSON.stringify({ title: 'Eva', body: 'A new game is waiting for you.' });

		const body = await encryptPayload(
			{ p256dh: base64UrlEncode(ua.getPublicKey()), auth: base64UrlEncode(auth) },
			new TextEncoder().encode(message)
		);

		const plaintext = ece.decrypt(Buffer.from(body), {
			version: 'aes128gcm',
			privateKey: ua,
			authSecret: auth
		});
		expect(plaintext.toString('utf8')).toBe(message);
	});
});

describe('VAPID authorization (RFC 8292)', () => {
	it('signs a JWT for the endpoint origin that verifies with the public key', async () => {
		const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
			'sign',
			'verify'
		])) as CryptoKeyPair;
		const publicKey = base64UrlEncode(
			new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer)
		);
		const privateKey = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d!;

		const header = await vapidAuthorization(
			'https://fcm.googleapis.com/fcm/send/abc123',
			{ publicKey, privateKey, subject: 'https://evagames.org' },
			1_000_000
		);
		const match = header.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
		expect(match).not.toBeNull();
		const [, h, c, sig, k] = match!;
		expect(k).toBe(publicKey);
		expect(JSON.parse(new TextDecoder().decode(base64UrlDecode(c)))).toEqual({
			aud: 'https://fcm.googleapis.com',
			exp: 1_000_000 + 43200,
			sub: 'https://evagames.org'
		});
		const valid = await crypto.subtle.verify(
			{ name: 'ECDSA', hash: 'SHA-256' },
			pair.publicKey,
			base64UrlDecode(sig) as BufferSource,
			new TextEncoder().encode(`${h}.${c}`)
		);
		expect(valid).toBe(true);
	});
});
