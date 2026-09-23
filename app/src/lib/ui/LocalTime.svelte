<script lang="ts">
	// Dates render on the server in UTC (Workers have no local timezone), then switch to the
	// viewer's own timezone in the browser, so deadlines always read in local time.
	import { onMount } from 'svelte';

	let { value, withWeekday = true }: { value: Date | string | number; withWeekday?: boolean } =
		$props();

	const options = (timeZone?: string): Intl.DateTimeFormatOptions => ({
		weekday: withWeekday ? 'short' : undefined,
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
		timeZone
	});

	const date = $derived(new Date(value));
	let local = $state(false);
	onMount(() => (local = true));

	const text = $derived(
		local
			? new Intl.DateTimeFormat('en-GB', options()).format(date)
			: `${new Intl.DateTimeFormat('en-GB', options('UTC')).format(date)} UTC`
	);
</script>

<time datetime={date.toISOString()}>{text}</time>
