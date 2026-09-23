import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { audit } from '$lib/server/activity';
import { requireStaff } from '$lib/server/guards';
import {
	PEOPLE_FILTERS,
	addToList,
	createList,
	deleteList,
	getLists,
	listPeople,
	moveToList,
	removeFromList,
	renameList,
	setFavorite,
	type PeopleFilter
} from '$lib/server/people';
import type { Actions, PageServerLoad } from './$types';

const listName = z
	.string()
	.trim()
	.min(1, 'Give the list a name')
	.max(40, 'Keep it under 40 characters');
const ids = (form: FormData) =>
	form
		.getAll('ids')
		.map(String)
		.filter((id) => /^[0-9a-f-]{36}$/.test(id));

export const load: PageServerLoad = async ({ locals, url }) => {
	const me = requireStaff(locals, url, 'people');
	const view = url.searchParams.get('list') ?? '';
	const filterParam = url.searchParams.get('filter') ?? 'all';
	const filter = (
		PEOPLE_FILTERS.some((f) => f.id === filterParam) ? filterParam : 'all'
	) as PeopleFilter;
	const q = url.searchParams.get('q')?.trim().slice(0, 60) ?? '';
	const page = Number(url.searchParams.get('page')) || 1;

	const allLists = await getLists(locals.db);
	const currentList = allLists.find((l) => l.id === view) ?? null;

	const result = await listPeople(locals.db, me.id, {
		listId: currentList?.id,
		favoritesOnly: view === 'favorites',
		q,
		filter,
		page
	});

	return {
		lists: allLists,
		view: currentList ? currentList.id : view === 'favorites' ? 'favorites' : '',
		currentList,
		filter,
		filters: PEOPLE_FILTERS,
		q,
		...result
	};
};

export const actions: Actions = {
	createList: async ({ request, locals, url }) => {
		const me = requireStaff(locals, url, 'people');
		const parsed = listName.safeParse((await request.formData()).get('name'));
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });
		const list = await createList(locals.db, parsed.data);
		await audit(locals.db, me.id, 'list_created', 'list', list.id, { name: parsed.data });
		return { createdListId: list.id };
	},

	renameList: async ({ request, locals, url }) => {
		const me = requireStaff(locals, url, 'people');
		const form = await request.formData();
		const parsed = listName.safeParse(form.get('name'));
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });
		await renameList(locals.db, String(form.get('listId')), parsed.data);
		await audit(locals.db, me.id, 'list_renamed', 'list', String(form.get('listId')), {
			name: parsed.data
		});
		return { ok: true };
	},

	deleteList: async ({ request, locals, url }) => {
		const me = requireStaff(locals, url, 'people');
		const listId = String((await request.formData()).get('listId'));
		await deleteList(locals.db, listId);
		await audit(locals.db, me.id, 'list_deleted', 'list', listId);
		return { deleted: true };
	},

	bulk: async ({ request, locals, url }) => {
		const me = requireStaff(locals, url, 'people');
		const form = await request.formData();
		const selected = ids(form);
		const op = String(form.get('op'));
		const target = String(form.get('target') ?? '');
		const from = String(form.get('from') ?? '');
		if (selected.length === 0) return fail(400, { error: 'Select at least one person first' });

		switch (op) {
			case 'favorite':
			case 'unfavorite':
				await setFavorite(locals.db, me.id, selected, op === 'favorite');
				break;
			case 'add':
				if (!target) return fail(400, { error: 'Pick a list' });
				await addToList(locals.db, target, selected);
				break;
			case 'move':
				if (!target) return fail(400, { error: 'Pick a list' });
				await moveToList(locals.db, selected, target, from || undefined);
				break;
			case 'remove':
				if (!from) return fail(400, { error: 'Open a list to remove people from it' });
				await removeFromList(locals.db, from, selected);
				break;
			default:
				return fail(400, { error: 'Unknown action' });
		}
		return { done: op, count: selected.length };
	}
};
