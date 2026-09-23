// Test-only dependency (reference RFC 8188 implementation) without bundled types.
declare module 'http_ece' {
	const ece: {
		decrypt(buffer: Buffer, params: Record<string, unknown>): Buffer;
		encrypt(buffer: Buffer, params: Record<string, unknown>): Buffer;
	};
	export default ece;
}
