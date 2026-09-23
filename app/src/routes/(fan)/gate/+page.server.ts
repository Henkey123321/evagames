import { redirect } from '@sveltejs/kit';
import { safeNext, setAgeCookie } from '$lib/server/age-gate';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.ageConfirmed) redirect(303, safeNext(url.searchParams.get('next')));
};

export const actions: Actions = {
	default: async ({ cookies, url }) => {
		setAgeCookie(cookies);
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
