import { describe, expect, it } from 'vitest';
import { ago, describeActivity, duration, plural } from './format';

const NOW = new Date('2026-09-23T15:00:00Z').getTime();

describe('ago', () => {
	it('uses short relative times for recent events', () => {
		expect(ago(NOW - 10_000, NOW)).toBe('just now');
		expect(ago(NOW - 5 * 60_000, NOW)).toBe('5 min ago');
		expect(ago(NOW - 3 * 3_600_000, NOW)).toBe('3 h ago');
		expect(ago(NOW - 30 * 3_600_000, NOW)).toBe('yesterday');
		expect(ago(NOW - 4 * 86_400_000, NOW)).toBe('4 days ago');
	});

	it('falls back to dates, with the year only when it differs', () => {
		expect(ago(new Date('2026-03-12T10:00:00Z'), NOW)).toBe('12 Mar');
		expect(ago(new Date('2025-03-12T10:00:00Z'), NOW)).toBe('12 Mar 2025');
		expect(ago(null, NOW)).toBe('never');
	});
});

describe('describeActivity', () => {
	it('reads naturally after a name', () => {
		expect(describeActivity('completed', { presetTitle: 'Memory' })).toBe('completed Memory');
		expect(describeActivity('handle_added', { onlyfans: 'a', loyalfans: 'b' })).toBe(
			'added OnlyFans @a and LoyalFans @b'
		);
		expect(describeActivity('messaged', {})).toBe('sent you a message');
		expect(describeActivity('some_new_kind', {})).toBe('some new kind');
	});
});

describe('small helpers', () => {
	it('formats durations and plurals', () => {
		expect(duration(42_000)).toBe('42s');
		expect(duration(125_000)).toBe('2m 05s');
		expect(duration(null)).toBe('');
		expect(plural(1, 'fan')).toBe('1 fan');
		expect(plural(3, 'person', 'people')).toBe('3 people');
	});
});
