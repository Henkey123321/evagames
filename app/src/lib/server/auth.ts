import { dev } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from './db';
import {
	recoveryCodes,
	sessions,
	staffPermissions,
	users,
	type Permission,
	type User
} from './db/schema';
import type { SessionUser } from '$lib/types';
import { normalizeRecoveryCode, randomToken, recoveryCode, sha256Hex } from './crypto';

export const SESSION_COOKIE = 'eva_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_RENEW_MS = 15 * 24 * 60 * 60 * 1000;

export type { SessionUser };

export async function createSession(db: Db, userId: string) {
	const token = randomToken();
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
	await db.insert(sessions).values({ id: await sha256Hex(token), userId, expiresAt });
	return { token, expiresAt };
}

export async function validateSession(db: Db, token: string) {
	const sessionId = await sha256Hex(token);
	const row = await db
		.select({ session: sessions, user: users })
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, sessionId))
		.get();
	if (!row) return null;

	const { session, user } = row;
	if (session.expiresAt.getTime() < Date.now() || user.disabledAt) {
		await db.delete(sessions).where(eq(sessions.id, sessionId));
		return null;
	}

	let renewed: Date | null = null;
	if (session.expiresAt.getTime() - Date.now() < SESSION_TTL_MS - SESSION_RENEW_MS) {
		renewed = new Date(Date.now() + SESSION_TTL_MS);
		await db.update(sessions).set({ expiresAt: renewed }).where(eq(sessions.id, sessionId));
	}

	const permissions =
		user.role === 'staff'
			? (
					await db
						.select({ p: staffPermissions.permission })
						.from(staffPermissions)
						.where(eq(staffPermissions.userId, user.id))
				).map((r) => r.p)
			: [];

	return {
		user: toSessionUser(user, permissions),
		renewedUntil: renewed,
		lastSeenAt: user.lastSeenAt
	};
}

export function toSessionUser(user: User, permissions: Permission[] = []): SessionUser {
	return {
		id: user.id,
		username: user.usernameDisplay,
		displayName: user.displayName,
		role: user.role,
		permissions
	};
}

export async function invalidateSession(db: Db, token: string) {
	await db.delete(sessions).where(eq(sessions.id, await sha256Hex(token)));
}

export async function invalidateUserSessions(db: Db, userId: string) {
	await db.delete(sessions).where(eq(sessions.userId, userId));
}

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		expires: expiresAt
	});
}

export function clearSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/', secure: !dev });
}

/** Owner can do everything; staff need the specific permission. */
export function can(user: SessionUser | null, permission: Permission): boolean {
	if (!user) return false;
	if (user.role === 'owner') return true;
	return user.role === 'staff' && (user.permissions as Permission[]).includes(permission);
}

export const isStaff = (user: SessionUser | null) =>
	user?.role === 'owner' || user?.role === 'staff';

/* ── Recovery codes ─────────────────────────────────────────────────── */

export const RECOVERY_CODE_COUNT = 8;

/** Replaces a user's self-service recovery codes and returns the new plaintext codes (shown once). */
export async function regenerateRecoveryCodes(db: Db, userId: string): Promise<string[]> {
	const codes = Array.from({ length: RECOVERY_CODE_COUNT }, recoveryCode);
	const rows = await Promise.all(
		codes.map(async (code) => ({
			userId,
			kind: 'self' as const,
			codeHash: await sha256Hex(normalizeRecoveryCode(code))
		}))
	);
	await db.batch([
		db
			.delete(recoveryCodes)
			.where(and(eq(recoveryCodes.userId, userId), eq(recoveryCodes.kind, 'self'))),
		db.insert(recoveryCodes).values(rows)
	]);
	return codes;
}

/** Marks a matching unused, unexpired code as used. Returns true if one was consumed. */
export async function consumeRecoveryCode(db: Db, userId: string, input: string): Promise<boolean> {
	const codeHash = await sha256Hex(normalizeRecoveryCode(input));
	const code = await db
		.select()
		.from(recoveryCodes)
		.where(
			and(
				eq(recoveryCodes.userId, userId),
				eq(recoveryCodes.codeHash, codeHash),
				isNull(recoveryCodes.usedAt)
			)
		)
		.get();
	if (!code) return false;
	if (code.expiresAt && code.expiresAt.getTime() < Date.now()) return false;
	const updated = await db
		.update(recoveryCodes)
		.set({ usedAt: new Date() })
		.where(and(eq(recoveryCodes.id, code.id), isNull(recoveryCodes.usedAt)))
		.returning({ id: recoveryCodes.id });
	return updated.length === 1;
}

export async function remainingRecoveryCodes(db: Db, userId: string): Promise<number> {
	const rows = await db
		.select({ id: recoveryCodes.id })
		.from(recoveryCodes)
		.where(
			and(
				eq(recoveryCodes.userId, userId),
				eq(recoveryCodes.kind, 'self'),
				isNull(recoveryCodes.usedAt)
			)
		);
	return rows.length;
}
