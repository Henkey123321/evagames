<script lang="ts">
	import '$lib/styles/home.css';

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
