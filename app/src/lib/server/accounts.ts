import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from './db';
import { plays, users, type Role } from './db/schema';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from './crypto';
import { regenerateRecoveryCodes } from './auth';
import { logActivity } from './activity';

export async function findUserByUsername(db: Db, username: string) {
	return db.select().from(users).where(eq(users.username, username.trim().toLowerCase())).get();
}

export async function createAccount(
	db: Db,
	input: { username: string; password: string; role?: Role; displayName?: string }
) {
	const username = input.username.trim();
	const user = await db
		.insert(users)
		.values({
			username: username.toLowerCase(),
			usernameDisplay: username,
			displayName: input.displayName ?? username,
			passwordHash: await hashPassword(input.password),
			role: input.role ?? 'player',
			ageConfirmedAt: new Date()
		})
		.onConflictDoNothing()
		.returning()
		.get();
	if (!user) return null;

	const codes = await regenerateRecoveryCodes(db, user.id);
	if (user.role === 'player') await logActivity(db, user.id, 'signed_up');
	return { user, codes };
}

/** Returns the user if the credentials match. Always does one hash so timing doesn't reveal usernames. */
export async function checkCredentials(db: Db, username: string, password: string) {
	const user = await findUserByUsername(db, username);
	const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
	if (!user || !ok || user.disabledAt) return null;
	return user;
}

export async function setPassword(db: Db, userId: string, password: string) {
	await db
		.update(users)
		.set({ passwordHash: await hashPassword(password) })
		.where(eq(users.id, userId));
}

/** Moves anonymous guest plays onto the account after signup or login. */
export async function claimGuestPlays(db: Db, guestId: string | undefined, userId: string) {
	if (!guestId) return;
	await db
		.update(plays)
		.set({ userId })
		.where(and(eq(plays.guestId, guestId), isNull(plays.userId)));
}

export async function touchLastSeen(db: Db, userId: string) {
	await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, userId));
}
