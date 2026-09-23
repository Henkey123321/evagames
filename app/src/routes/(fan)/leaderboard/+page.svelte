<script lang="ts">
	import Leaderboard from '$lib/ui/Leaderboard.svelte';

	let { data } = $props();
	const rows = $derived(
		data.rows.map((r) => ({
			name: r.name,
			value: `${r.points} points`,
			isMe: r.userId === data.user?.id
		}))
	);
</script>

<svelte:head><title>Leaderboard | Eva Games</title></svelte:head>

<div class="content">
	<h1 class="page-title">Leaderboard</h1>
	<p class="page-lede">Eva's most devoted, by points.</p>
	<Leaderboard
		title="Top fans"
		{rows}
		empty="Nobody is on the board yet. Earn points by completing games."
	/>
</div>
