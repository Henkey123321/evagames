// Generates a VAPID key pair for web push.
// Put the public key in wrangler.jsonc vars (VAPID_PUBLIC_KEY) and the private key in
// .dev.vars locally / `npx wrangler secret put VAPID_PRIVATE_KEY` for deployed environments.
const { publicKey, privateKey } = await crypto.subtle.generateKey(
	{ name: 'ECDSA', namedCurve: 'P-256' },
	true,
	['sign', 'verify']
);
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey));
const jwk = await crypto.subtle.exportKey('jwk', privateKey);
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
console.log(`VAPID_PUBLIC_KEY=${b64url(raw)}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
