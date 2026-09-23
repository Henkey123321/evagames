<script lang="ts">
	import '$lib/styles/home.css';

	import LocalTime from '$lib/ui/LocalTime.svelte';

	let { data } = $props();

	const number = (i: number) => String(i + 1).padStart(2, '0');
	// A lone last tile spans the full row, like the original "More coming soon" slot.
	const placeholderWide = $derived(data.tiles.length % 2 === 0);
</script>

<svelte:head>
	<title>Eva Games | Eva de Vil</title>
	<meta name="description" content="Eva de Vil's games hub." />
	<meta property="og:title" content="Eva Games | Eva de Vil" />
	<meta property="og:type" content="website" />
</svelte:head>

{#if data.forYou.length}
	<section class="for-you" aria-labelledby="for-you-heading">
		<h2 id="for-you-heading">For you</h2>
		<ul>
			{#each data.forYou as g (g.id)}
				<li>
					<a href="/play/{g.slug}?a={g.id}">
						<span class="fy-title">{g.title}</span>
						{#if g.message}<span class="fy-message">{g.message}</span>{/if}
						<span class="fy-rules">
							{#each g.targets as t (t)}<span>{t}</span>{/each}
							{#if g.deadline}<span>Due <LocalTime value={g.deadline} /></span>{/if}
							{#if g.attemptsLeft !== null}<span
									>{g.attemptsLeft} {g.attemptsLeft === 1 ? 'try' : 'tries'} left</span
								>{/if}
						</span>
						<span class="status">{g.started ? 'Continue' : 'Play'}</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<section class="games-section" aria-labelledby="games-heading">
	<h1 id="games-heading" class="sr-only">Eva Games</h1>

	<div class="games-layout">
		<img class="body-art body-art-left" src={data.settings.hubArtLeft} alt="" aria-hidden="true" />

		<div class="game-grid" aria-label="Game launcher">
			{#each data.tiles as tile, i (tile.slug)}
				<article class={['game-tile', tile.available ? 'game-tile-available' : 'game-tile-queued']}>
					<span class="tile-number">{number(i)}</span>
					<h2>
						{#if tile.available}
							<a class="game-card-link" href="/play/{tile.slug}">{tile.title}</a>
						{:else}
							{tile.title}
						{/if}
					</h2>
					<span class="status"
						>{tile.label}{tile.membersOnly && tile.available ? ' · Members' : ''}</span
					>
				</article>
			{/each}

			<article class={['game-tile', 'empty', placeholderWide && 'game-tile-wide']}>
				<span class="tile-number">{number(data.tiles.length)}</span>
				<h2>{data.settings.hubComingSoonTitle}</h2>
				<span class="status">{data.settings.hubComingSoonLabel}</span>
			</article>
		</div>

		<img
			class="body-art body-art-right"
			src={data.settings.hubArtRight}
			alt=""
			aria-hidden="true"
		/>
	</div>
</section>

<style>
	.for-you {
		width: min(100%, 760px);
		margin: 0 auto clamp(1.5rem, 4vw, 2.5rem);
	}

	.for-you h2 {
		margin: 0 0 0.6rem;
		font-size: 0.72rem;
		font-weight: 850;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--eva-red);
	}

	.for-you ul {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--line);
		border-left: 1px solid var(--line);
		list-style: none;
	}

	.for-you a {
		display: grid;
		gap: 0.5rem;
		height: 100%;
		padding: 1rem 1.1rem;
		border-right: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		border-left: 0.3rem solid var(--eva-red);
		text-decoration: none;
		background: var(--panel);
		transition: background-color 150ms ease-out;
	}

	.for-you a:hover {
		background: var(--panel-muted);
	}

	.for-you a:focus-visible {
		outline: none;
		box-shadow: var(--focus-ring);
	}

	.fy-title {
		font-size: clamp(1.4rem, 3vw, 2rem);
		font-weight: 900;
		line-height: 0.95;
		letter-spacing: -0.05em;
	}

	.fy-message {
		font-weight: 700;
		line-height: 1.35;
		color: var(--ink-soft);
	}

	.fy-rules {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.fy-rules span {
		padding: 0.15rem 0.4rem;
		border: 1px solid var(--line);
		font-size: 0.72rem;
		font-weight: 800;
	}

	.for-you .status {
		width: fit-content;
		padding: 0.32rem 0.5rem;
		border: 1px solid currentColor;
		font-size: 0.7rem;
		font-weight: 850;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--eva-red);
	}
</style>
