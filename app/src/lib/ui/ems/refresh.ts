import { invalidate } from '$app/navigation';

/**
 * Layout data (unread counts, conversation list) loads in parallel with the page, so it can
 * predate the page marking a thread read. Refresh it once when that happened.
 */
export function refreshAfterRead(justRead: boolean) {
	if (!justRead) return;
	void invalidate('ems:counts');
	void invalidate('ems:inbox');
}
