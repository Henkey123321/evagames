import { describe, expect, it } from 'vitest';
import { hashPassword, normalizeRecoveryCode, recoveryCode, verifyPassword } from './crypto';

describe('password hashing', () => {
	it('verifies the right password and rejects the wrong one', async () => {
		const hash = await hashPassword('correct horse battery');
		expect(hash).toMatch(/^pbkdf2-sha256\$100000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
		expect(await verifyPassword('correct horse battery', hash)).toBe(true);
		expect(await verifyPassword('correct horse batterY', hash)).toBe(false);
	});

	it('salts every hash', async () => {
		expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
	});

	it('rejects malformed stored hashes', async () => {
		expect(await verifyPassword('x', 'garbage')).toBe(false);
	});
});

describe('recovery codes', () => {
	it('are formatted in three groups and normalise loosely typed input', () => {
		const code = recoveryCode();
		expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
		expect(normalizeRecoveryCode(` ${code.toLowerCase().replace(/-/g, ' ')} `)).toBe(
			code.replace(/-/g, '')
		);
	});
});
