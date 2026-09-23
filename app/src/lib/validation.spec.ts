import { describe, expect, it } from 'vitest';
import { handle, signupForm } from './validation';

describe('handles', () => {
	it('strips @, profile URLs and trailing paths', () => {
		expect(handle.parse('@evafan')).toBe('evafan');
		expect(handle.parse('https://onlyfans.com/evafan/media')).toBe('evafan');
		expect(handle.parse('https://www.loyalfans.com/eva.fan')).toBe('eva.fan');
		expect(handle.parse('')).toBe('');
	});

	it('rejects junk', () => {
		expect(handle.safeParse('not a handle!').success).toBe(false);
	});
});

describe('signup', () => {
	const base = {
		username: 'devoted_one',
		password: 'long enough pw',
		confirm: 'long enough pw',
		age: 'on'
	};

	it('requires the 18+ confirmation and matching passwords', () => {
		expect(signupForm.safeParse(base).success).toBe(true);
		expect(signupForm.safeParse({ ...base, age: undefined }).success).toBe(false);
		expect(signupForm.safeParse({ ...base, confirm: 'different pw!' }).success).toBe(false);
		expect(signupForm.safeParse({ ...base, username: 'no spaces allowed' }).success).toBe(false);
	});
});
