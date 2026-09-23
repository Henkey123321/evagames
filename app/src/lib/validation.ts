/* Form validation shared by server actions and client hints. */
import { z } from 'zod';

export const USERNAME_RULES = '3–24 characters: letters, numbers, dot, dash or underscore.';
export const PASSWORD_RULES = 'At least 10 characters.';

export const username = z
	.string()
	.trim()
	.min(3, 'Username must be at least 3 characters')
	.max(24, 'Username must be at most 24 characters')
	.regex(/^[a-zA-Z0-9._-]+$/, 'Use only letters, numbers, dot, dash or underscore');

export const password = z
	.string()
	.min(10, 'Password must be at least 10 characters')
	.max(200, 'Password is too long');

export const displayName = z
	.string()
	.trim()
	.min(1, 'Display name is required')
	.max(40, 'Display name is too long');

/** OnlyFans / LoyalFans handles: stored without a leading @ or profile URL. */
export const handle = z
	.string()
	.trim()
	.max(60)
	.transform((v) =>
		v
			.replace(/^https?:\/\/(www\.)?(onlyfans|loyalfans)\.com\//i, '')
			.replace(/^@/, '')
			.replace(/\/.*$/, '')
	)
	.refine(
		(v) => v === '' || /^[a-zA-Z0-9._-]{1,50}$/.test(v),
		'That does not look like a valid handle'
	);

export const signupForm = z
	.object({
		username,
		password,
		confirm: z.string(),
		age: z.literal('on', { error: 'You must confirm you are 18 or older' })
	})
	.refine((f) => f.password === f.confirm, {
		message: 'Passwords do not match',
		path: ['confirm']
	});

export const loginForm = z.object({
	username: z.string().trim().min(1, 'Enter your username'),
	password: z.string().min(1, 'Enter your password')
});

export const recoverForm = z
	.object({
		username: z.string().trim().min(1, 'Enter your username'),
		code: z.string().trim().min(8, 'Enter a recovery code'),
		password,
		confirm: z.string()
	})
	.refine((f) => f.password === f.confirm, {
		message: 'Passwords do not match',
		path: ['confirm']
	});

export const profileForm = z.object({
	displayName,
	onlyfansHandle: handle,
	loyalfansHandle: handle,
	leaderboardOptIn: z
		.string()
		.optional()
		.transform((v) => v === 'on')
});

export const changePasswordForm = z
	.object({
		current: z.string().min(1, 'Enter your current password'),
		password,
		confirm: z.string()
	})
	.refine((f) => f.password === f.confirm, {
		message: 'Passwords do not match',
		path: ['confirm']
	});

/** Flattens zod issues into `{ field: message }` for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
	const out: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = String(issue.path[0] ?? 'form');
		out[key] ??= issue.message;
	}
	return out;
}
