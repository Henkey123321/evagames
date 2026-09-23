import { error, fail } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { findUserByUsername } from '$lib/server/accounts';
import { audit } from '$lib/server/activity';
import { auditLog, PERMISSIONS, users, type Permission } from '$lib/server/db/schema';
import { requireStaff } from '$lib/server/guards';
import {
	PERMISSION_LABELS,
	createStaff,
	listStaff,
	setPermissions,
	setStaffDisabled,
	staffResetCode
} from '$lib/server/staff';
import { displayName, username } from '$lib/validation';
import type { Actions, PageServerLoad } from './$types';

const permissionsFrom = (form: FormData) =>
	form
		.getAll('permissions')
		.map(String)
		.filter((p): p is Permission => (PERMISSIONS as readonly string[]).includes(p));

async function requireStaffTarget(db: App.Locals['db'], id: string) {
	const row = await db.select({ role: users.role }).from(users).where(eq(users.id, id)).get();
	if (row?.role !== 'staff') error(404, 'Staff member not found');
}

export const load: PageServerLoad = async ({ locals, url }) => {
	requireStaff(locals, url, 'staff');
	const [staff, log] = await Promise.all([
		listStaff(locals.db),
		locals.db
			.select({
				id: auditLog.id,
				action: auditLog.action,
				entityType: auditLog.entityType,
				data: auditLog.data,
				createdAt: auditLog.createdAt,
				actorName: users.displayName
			})
			.from(auditLog)
			.leftJoin(users, eq(auditLog.actorId, users.id))
			.orderBy(desc(auditLog.createdAt))
			.limit(100)
	]);
	return {
		staff,
		log,
		permissions: PERMISSIONS.map((p) => ({ id: p, label: PERMISSION_LABELS[p] }))
	};
};

export const actions: Actions = {
	create: async ({ request, locals, url }) => {
		const me = requireStaff(locals, url, 'staff');
		const form = await request.formData();
		const parsed = z
			.object({ username, displayName })
			.safeParse({ username: form.get('username'), displayName: form.get('displayName') });
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });
		if (await findUserByUsername(locals.db, parsed.data.username)) {
			return fail(400, { error: 'That username is taken' });
		}
		const permissions = permissionsFrom(form);
		const created = await createStaff(locals.db, me.id, { ...parsed.data, permissions });
		if (!created) return fail(400, { error: 'That username is taken' });
		await audit(locals.db, me.id, 'staff_created', 'user', created.id, {
			username: parsed.data.username,
			permissions
		});
		return { setupCode: created.code, forName: parsed.data.displayName };
	},

	permissions: async ({ request, locals, url }) => {
		const me = requireStaff(locals, url, 'staff');
		const form = await request.formData();
		const id = String(form.get('id'));
		await requireStaffTarget(locals.db, id);
		const permissions = permissionsFrom(form);
		await setPermissions(locals.db, id, permissions);
		await audit(locals.db, me.id, 'staff_permissions_changed', 'user', id, { permissions });
		return { savedId: id };
	},

	disable: async ({ request, locals, url }) => {
		const me = requireStaff(locals, url, 'staff');
		const form = await request.formData();
		const id = String(form.get('id'));
		if (id === me.id) return fail(400, { error: "You can't disable your own account" });
		await requireStaffTarget(locals.db, id);
		const disabled = form.get('disabled') === '1';
		await setStaffDisabled(locals.db, id, disabled);
		await audit(locals.db, me.id, disabled ? 'staff_disabled' : 'staff_enabled', 'user', id);
		return { savedId: id };
	},

	resetCode: async ({ request, locals, url }) => {
		const me = requireStaff(locals, url, 'staff');
		const id = String((await request.formData()).get('id'));
		await requireStaffTarget(locals.db, id);
		const code = await staffResetCode(locals.db, id, me.id);
		if (!code) error(404, 'Staff member not found');
		await audit(locals.db, me.id, 'staff_reset_code_issued', 'user', id);
		const target = await locals.db
			.select({ name: users.displayName })
			.from(users)
			.where(eq(users.id, id))
			.get();
		return { setupCode: code, forName: target?.name ?? 'them' };
	}
};
