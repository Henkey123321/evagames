/* Small display helpers shared by fan pages and the EMS. */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const dateShort = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const dateLong = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'short',
	year: 'numeric'
});
const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

/** "just now", "12 min", "3 h", "yesterday", "4 days", "12 Mar", "12 Mar 2025". */
export function ago(date: Date | string | number | null | undefined, now = Date.now()): string {
	if (date == null) return 'never';
	const d = new Date(date);
	const diff = now - d.getTime();
	if (diff < MINUTE) return 'just now';
	if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
	if (diff < DAY) return `${Math.floor(diff / HOUR)} h ago`;
	if (diff < 2 * DAY) return 'yesterday';
	if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} days ago`;
	return new Date(now).getFullYear() === d.getFullYear() ? dateShort.format(d) : dateLong.format(d);
}

export function fullDate(date: Date | string | number | null | undefined): string {
	if (date == null) return '';
	const d = new Date(date);
	return `${dateLong.format(d)}, ${time.format(d)}`;
}

export function duration(ms: number | null | undefined): string {
	if (!ms || ms < 0) return '';
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
	return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export function plural(n: number, one: string, many = `${one}s`) {
	return `${n} ${n === 1 ? one : many}`;
}

/** Human line for an activity-feed entry. */
export function describeActivity(kind: string, data: Record<string, unknown>): string {
	switch (kind) {
		case 'signed_up':
			return 'joined';
		case 'completed':
			return `completed ${data.presetTitle ?? 'a game'}`;
		case 'played':
			return `played ${data.presetTitle ?? 'a game'}`;
		case 'handle_added': {
			const parts = [
				data.onlyfans ? `OnlyFans @${data.onlyfans}` : null,
				data.loyalfans ? `LoyalFans @${data.loyalfans}` : null
			].filter(Boolean);
			return `added ${parts.join(' and ') || 'a handle'}`;
		}
		case 'messaged':
			return 'sent you a message';
		case 'profile_updated':
			return 'updated their profile';
		case 'reward_unlocked':
			return data.pending
				? `earned ${data.rewardName ?? 'a reward'} (waiting for your approval)`
				: `unlocked ${data.rewardName ?? 'a reward'}`;
		case 'badge_earned':
			return `earned the ${data.badgeName ?? ''} badge`.replace('  ', ' ');
		case 'proof_submitted':
			return `sent proof for ${data.rewardName ?? 'a task'}`;
		case 'points_granted':
			return `received ${data.delta ?? ''} points`.replace('  ', ' ');
		default:
			return kind.replace(/_/g, ' ');
	}
}
