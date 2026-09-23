import { requireStaff } from '$lib/server/guards';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	return { user: requireStaff(locals, url) };
};
