import { and, count, eq, isNotNull, isNull, or } from 'drizzle-orm';
import { can } from '$lib/server/auth';
import { users } from '$lib/server/db/schema';
import { requireStaff } from '$lib/server/guards';
import { unreadConversationsForStaff } from '$lib/server/messages';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url, depends }) => {
	depends('ems:counts');
	const user = requireStaff(locals, url);
	const access = {
		people: can(user, 'people'),
		messages: can(user, 'messages'),
		site: can(user, 'site'),
		staff: can(user, 'staff'),
		analytics: can(user, 'analytics')
	};

	const [unread, toVerify] = await Promise.all([
		access.messages ? unreadConversationsForStaff(locals.db) : 0,
		access.people
			? locals.db
					.select({ n: count() })
					.from(users)
					.where(
						and(
							eq(users.role, 'player'),
							isNull(users.disabledAt),
							or(
								and(isNotNull(users.onlyfansHandle), isNull(users.onlyfansVerifiedAt)),
								and(isNotNull(users.loyalfansHandle), isNull(users.loyalfansVerifiedAt))
							)
						)
					)
					.get()
					.then((r) => r?.n ?? 0)
			: 0
	]);

	return { user, access, counts: { unread, toVerify } };
};
