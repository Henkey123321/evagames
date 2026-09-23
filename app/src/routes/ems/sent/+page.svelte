<script lang="ts">
	import { ago, plural } from '$lib/format';

	let { data } = $props();
</script>

<svelte:head><title>Sent games | EMS</title></svelte:head>

<div class="ems-page">
	<header class="ems-head">
		<div>
			<p class="ems-small"><a href="/ems/games">Games</a></p>
			<h1>Sent games</h1>
			<p>Games you sent to particular fans, and how they're doing.</p>
		</div>
		<a class="ems-btn ems-btn-primary" href="/ems/games">Send a game</a>
	</header>

	{#if data.sent.length === 0}
		<p class="ems-panel ems-empty">Nothing sent yet. Open a game and choose "Send".</p>
	{:else}
		<ul class="ems-rows">
			{#each data.sent as s (s.id)}
				<li>
					<a class="ems-row sent-row" href="/ems/sent/{s.id}">
						<span class="ems-row-main">
							<span class="ems-row-title">
								{s.title}
								{#if s.cancelledAt}<span class="ems-chip">Cancelled</span>{/if}
							</span>
							<span class="ems-row-sub">
								{s.presetTitle} to {plural(s.total, 'fan')}: {s.completed} completed, {s.playing} playing,
								{s.waiting} not started{s.failed ? `, ${s.failed} out of attempts` : ''}
							</span>
						</span>
						<span class="ems-row-meta">{ago(s.createdAt)}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.sent-row {
		grid-template-columns: minmax(0, 1fr) auto;
	}

	.sent-row .ems-row-title {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.sent-row .ems-row-sub {
		white-space: normal;
	}
</style>
