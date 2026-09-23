import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { audit } from '$lib/server/activity';
import { can } from '$lib/server/auth';
import { requireStaff } from '$lib/server/guards';
import {
	awardBadge,
	awardPoints,
	evaluateProgress,
	grantReward,
	pointsHistory
} from '$lib/server/rewards';
import {
	badgesFor,
	listBadges,
	listRewards,
	resolveUserReward,
	rewardsForPerson
} from '$lib/server/rewards-admin';
import { logActivity } from '$lib/server/activity';
import { notifyUser } from '$lib/server/push';
import { assignmentsForPerson } from '$lib/server/assignments';
import { gamePresets } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';
import { getManifest } from '$lib/games/registry';
import { duration } from '$lib/format';
import { MESSAGE_MAX, getThread, markReadByStaff, sendStaffMessage } from '$lib/server/messages';
import {
	addNote,
	addToList,
	deleteNote,
	getLists,
	getPerson,
	issueResetCode,
	isPlayer,
	removeFromList,
	setDisabled,
	setFavorite,
	setHandleVerified
} from '$lib/server/people';
import type { Actions, PageServerLoad } from './$types';

const text = (max: number, empty: string) =>
	z.string().trim().min(1, empty).max(max, `Keep it under ${max} characters`);

/** Every action here targets a fan; staff and owner accounts are managed on the Staff page. */
async function requireFan(db: App.Locals['db'], id: string) {
	if (!(await isPlayer(db, id))) error(404, 'Person not found');
}

export const load: PageServerLoad = async ({ locals, url, params }) => {
	const me = requireStaff(locals, url, 'people');
	const person = await getPerson(locals.db, me.id, params.id);
	if (!person) error(404, 'Person not found');

	const canMessage = can(me, 'messages');
	const canReward = can(me, 'rewards');
	const canGames = can(me, 'games');
	const [lists, thread, rewardData, sentGames] = await Promise.all([
		getLists(locals.db),
		canMessage ? getThread(locals.db, params.id) : null,
		canReward
			? Promise.all([
					rewardsForPerson(locals.db, params.id),
					badgesFor(locals.db, params.id),
					pointsHistory(locals.db, params.id, 8),
					listRewards(locals.db),
					listBadges(locals.db)
				]).then(([granted, earned, history, library, allBadges]) => ({
					granted,
					earned,
					history,
					library: library.map((r) => ({ id: r.id, name: r.name })),
					badges: allBadges.map((b) => ({ id: b.id, name: b.name, mark: b.mark }))
				}))
			: null,
		canGames
			? Promise.all([
					assignmentsForPerson(locals.db, params.id),
					locals.db
						.select({ id: gamePresets.id, title: gamePresets.title })
						.from(gamePresets)
						.orderBy(asc(gamePresets.title))
				]).then(([sent, presets]) => ({ sent, presets }))
			: null
	]);
	const justRead = canMessage && !!thread?.conversation?.unreadForStaff;
	if (justRead) await markReadByStaff(locals.db, params.id);

	const plays = person.plays.map((p) => {
		const manifest = getManifest(p.type);
		const parsed = manifest?.resultSchema.safeParse(p.result);
		const metrics =
			manifest && parsed?.success
				? manifest.metrics.map((m) => `${m.label} ${m.value(parsed.data)}`)
				: [];
		if (p.durationMs) metrics.push(`took ${duration(p.durationMs)}`);
		return {
			id: p.id,
			title: p.title,
			completed: p.completed,
			rejected: p.verification === 'rejected',
			finishedAt: p.finishedAt,
			details: metrics.join(', ')
		};
	});

	return {
		person: { ...person, plays },
		lists,
		canMessage,
		rewards: rewardData,
		games: sentGames,
		justRead,
		thread: thread?.messages.slice(-12) ?? null
	};
};

export const actions: Actions = {
	favorite: async ({ request, locals, url, params }) => {
		const me = requireStaff(locals, url, 'people');
		await requireFan(locals.db, params.id);
		const on = (await request.formData()).get('on') === '1';
		await setFavorite(locals.db, me.id, [params.id], on);
		return { ok: true };
	},

	verify: async ({ request, locals, url, params }) => {
		const me = requireStaff(locals, url, 'people');
		await requireFan(locals.db, params.id);
		const form = await request.formData();
		const platform = form.get('platform') === 'loyalfans' ? 'loyalfans' : 'onlyfans';
		const verified = form.get('verified') === '1';
		await setHandleVerified(locals.db, params.id, platform, verified);
		await audit(
			locals.db,
			me.id,
			verified ? 'handle_verified' : 'handle_unverified',
			'user',
			params.id,
			{ platform }
		);
		return { ok: true };
	},

	note: async ({ request, locals, url, params }) => {
		const me = requireStaff(locals, url, 'people');
		await requireFan(locals.db, params.id);
		const parsed = text(2000, 'Write something first').safeParse(
			(await request.formData()).get('body')
		);
		if (!parsed.success) return fail(400, { noteError: parsed.error.issues[0].message });
		await addNote(locals.db, params.id, me.id, parsed.data);
		return { noteSaved: true };
	},

	deleteNote: async ({ request, locals, url, params }) => {
		requireStaff(locals, url, 'people');
		await requireFan(locals.db, params.id);
		await deleteNote(locals.db, String((await request.formData()).get('noteId')), params.id);
		return { ok: true };
	},

	lists: async ({ request, locals, url, params }) => {
		requireStaff(locals, url, 'people');
		await requireFan(locals.db, params.id);
		const form = await request.formData();
		const listId = String(form.get('listId'));
		if (form.get('member') === '1') await addToList(locals.db, listId, [params.id]);
		else await removeFromList(locals.db, listId, [params.id]);
		return { ok: true };
	},

	message: async ({ request, locals, url, params, platform }) => {
		const me = requireStaff(locals, url, 'messages');
		await requireFan(locals.db, params.id);
		const parsed = text(MESSAGE_MAX, 'Write a message first').safeParse(
			(await request.formData()).get('body')
		);
		if (!parsed.success) return fail(400, { messageError: parsed.error.issues[0].message });
		await sendStaffMessage(locals.db, platform!.env, (p) => platform!.ctx.waitUntil(p), {
			staffId: me.id,
			userId: params.id,
			body: parsed.data
		});
		return { messageSent: true };
	},

	resetCode: async ({ locals, url, params }) => {
		const me = requireStaff(locals, url, 'people');
		await requireFan(locals.db, params.id);
		const code = await issueResetCode(locals.db, params.id, me.id, 'player');
		if (!code) error(404, 'Person not found');
		await audit(locals.db, me.id, 'reset_code_issued', 'user', params.id);
		return { resetCode: code };
	},

	points: async ({ request, locals, url, params }) => {
		const me = requireStaff(locals, url, 'rewards');
		await requireFan(locals.db, params.id);
		const parsed = z
			.object({
				delta: z.coerce
					.number()
					.int()
					.min(-100_000)
					.max(100_000)
					.refine((n) => n !== 0, 'Enter a number other than 0'),
				note: z.string().trim().max(200).optional()
			})
			.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { rewardError: parsed.error.issues[0].message });
		const { delta, note } = parsed.data;
		await awardPoints(locals.db, {
			userId: params.id,
			delta,
			reason: 'manual',
			note,
			createdBy: me.id
		});
		await logActivity(locals.db, params.id, 'points_granted', { delta });
		const outcome = delta > 0 ? await evaluateProgress(locals.db, params.id) : null;
		await audit(locals.db, me.id, 'points_granted', 'user', params.id, { delta, note });
		return {
			rewardDone: `Points updated${outcome?.rewards.length ? `, and that unlocked ${outcome.rewards.map((r) => r.name).join(', ')}` : ''}.`
		};
	},

	giveBadge: async ({ request, locals, url, params }) => {
		const me = requireStaff(locals, url, 'rewards');
		await requireFan(locals.db, params.id);
		const badgeId = String((await request.formData()).get('badgeId'));
		const badge = await awardBadge(locals.db, params.id, badgeId, me.id);
		if (!badge) return fail(400, { rewardError: 'They already have that badge' });
		await evaluateProgress(locals.db, params.id);
		await audit(locals.db, me.id, 'badge_given', 'user', params.id, { badge: badge.name });
		return { rewardDone: `Gave the ${badge.name} badge.` };
	},

	giveReward: async ({ request, locals, url, params, platform }) => {
		const me = requireStaff(locals, url, 'rewards');
		await requireFan(locals.db, params.id);
		const rewardId = String((await request.formData()).get('rewardId'));
		const granted = await grantReward(locals.db, {
			userId: params.id,
			rewardId,
			source: `manual:${crypto.randomUUID()}`,
			grantedBy: me.id,
			skipApproval: true
		});
		if (!granted) return fail(400, { rewardError: 'That reward no longer exists' });
		platform!.ctx.waitUntil(
			notifyUser(locals.db, platform!.env, params.id, {
				title: 'Eva Games',
				body: `Eva gave you "${granted.name}".`,
				url: '/vault',
				tag: 'vault'
			}).catch(() => undefined)
		);
		await audit(locals.db, me.id, 'reward_given', 'user', params.id, { reward: granted.name });
		return { rewardDone: `Gave "${granted.name}".` };
	},

	markDone: async ({ request, locals, url, params }) => {
		const me = requireStaff(locals, url, 'rewards');
		await requireFan(locals.db, params.id);
		const id = String((await request.formData()).get('userRewardId'));
		const done = await resolveUserReward(locals.db, id, 'mark_done', me.id);
		if (!done || done.userId !== params.id)
			return fail(400, { rewardError: 'That was already handled' });
		return { rewardDone: `Marked "${done.rewardName}" as done.` };
	},

	disable: async ({ request, locals, url, params }) => {
		const me = requireStaff(locals, url, 'people');
		await requireFan(locals.db, params.id);
		const disabled = (await request.formData()).get('disabled') === '1';
		await setDisabled(locals.db, params.id, disabled);
		await audit(locals.db, me.id, disabled ? 'user_disabled' : 'user_enabled', 'user', params.id);
		return { ok: true };
	}
};
