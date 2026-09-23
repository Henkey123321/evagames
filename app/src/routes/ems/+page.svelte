<script lang="ts">
	import { ago, describeActivity, plural } from '$lib/format';
	import PlaysChart from '$lib/ui/ems/PlaysChart.svelte';

	let { data } = $props();

	const hour = new Date().getHours();
	const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
	const queueSize = $derived(
		(data.queue?.unread.length ?? 0) + (data.queue?.unverified.length ?? 0)
	);
</script>

<svelte:head><title>Home | EMS</title></svelte:head>

<div class="ems-page">
	<header class="ems-head">
		<div>
			<h1>{greeting}, {data.user.displayName}.</h1>
			<p>
				{#if data.queue}
					{queueSize === 0
						? 'Nothing is waiting for you.'
						: `${plural(queueSize, 'thing')} waiting for you.`}
				{:else}
					Here is what is happening.
				{/if}
			</p>
		</div>
	</header>

	{#if data.queue && queueSize > 0}
		<section class="ems-section" aria-labelledby="needs-you">
			<h2 id="needs-you">Needs you</h2>
			<ul class="ems-rows">
				{#each data.queue.unread as item (item.userId)}
					<li>
						<a class="ems-row" href="/ems/inbox/{item.userId}">
							<span class="ems-dot" aria-hidden="true"></span>
							<span class="ems-row-main">
								<span class="ems-row-title">
									{#if item.favorite}<span class="fav-mark" aria-label="Favourite">★</span>{/if}
									{item.displayName} messaged you{item.unread > 1 ? ` (${item.unread})` : ''}
								</span>
								<span class="ems-row-sub">{item.preview}</span>
							</span>
							<span class="ems-row-meta">{ago(item.at)}</span>
						</a>
					</li>
				{/each}
				{#each data.queue.unverified as item (item.userId)}
					<li>
						<a class="ems-row" href="/ems/people/{item.userId}">
							<span class="ems-dot ems-dot-quiet" aria-hidden="true"></span>
							<span class="ems-row-main">
								<span class="ems-row-title">
									{#if item.favorite}<span class="fav-mark" aria-label="Favourite">★</span>{/if}
									Verify {item.displayName}'s {item.handles.map((h) => h.platform).join(' and ')} name
								</span>
								<span class="ems-row-sub">
									{item.handles.map((h) => `${h.platform} @${h.handle}`).join(', ')}
								</span>
							</span>
							<span class="ems-row-meta">{ago(item.at)}</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.stats}
		<section class="ems-section" aria-labelledby="this-week">
			<h2 id="this-week">This week</h2>
			<div class="ems-panel ems-panel-pad week">
				<dl class="ems-figures">
					<div>
						<dt>fans in total</dt>
						<dd>{data.stats.fans}</dd>
					</div>
					<div>
						<dt>new fans</dt>
						<dd>{data.stats.newFans}</dd>
					</div>
					<div>
						<dt>active fans</dt>
						<dd>{data.stats.activeFans}</dd>
					</div>
					<div>
						<dt>games finished</dt>
						<dd>{data.stats.plays}</dd>
					</div>
					<div>
						<dt>completions</dt>
						<dd>{data.stats.completions}</dd>
					</div>
				</dl>
				{#if data.days}<PlaysChart days={data.days} />{/if}
			</div>
		</section>
	{/if}

	{#if data.access.people}
		<section class="ems-section" aria-labelledby="latest">
			<div class="ems-section-head">
				<h2 id="latest">Latest from your fans</h2>
				<a class="ems-small" href="/ems/people">All people</a>
			</div>
			{#if data.feed.length === 0}
				<p class="ems-panel ems-empty">
					No activity yet. When fans join, play or message you, it shows up here.
				</p>
			{:else}
				<ul class="ems-rows">
					{#each data.feed as item (item.id)}
						<li>
							<a class="ems-row feed-row" href="/ems/people/{item.userId}">
								<span class="ems-row-main">
									<span class="ems-row-sub feed-line">
										<strong>{item.displayName}</strong>
										{describeActivity(item.kind, item.data)}
									</span>
								</span>
								<span class="ems-row-meta">{ago(item.createdAt)}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>

<style>
	.fav-mark {
		margin-right: 0.3rem;
		color: var(--ems-fav);
	}

	.week {
		display: grid;
		gap: 1.25rem;
	}

	.feed-row {
		grid-template-columns: minmax(0, 1fr) auto;
		padding-block: 0.55rem;
	}

	.feed-line {
		white-space: normal;
		color: var(--ems-text);
	}
</style>
