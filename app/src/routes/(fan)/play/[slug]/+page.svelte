<script lang="ts">
	import GameHost from '$lib/ui/GameHost.svelte';

	let { data } = $props();
	const game = $derived(data.game);
</script>

<svelte:head>
	<title>{game.title} | Eva Games | Eva de Vil</title>
	<meta name="description" content="Play {game.title} on Eva Games." />
	<meta property="og:title" content="{game.title} | Eva Games | Eva de Vil" />
</svelte:head>

<div class="game-main">
	<div class="game-layout">
		{#if game.artLeft}
			<img class="game-body-art game-body-art-left" src={game.artLeft} alt="" aria-hidden="true" />
		{:else}<span></span>{/if}

		<section class="game-stage" aria-labelledby="game-title">
			<div class="game-copy">
				<h1 id="game-title">{game.title}</h1>
				{#if game.instructions}<p class="game-instructions">{game.instructions}</p>{/if}
			</div>
			{#key game.slug}
				<GameHost slug={game.slug} type={game.type} config={game.config} signedIn={!!data.user} />
			{/key}
		</section>

		{#if game.artRight}
			<img
				class="game-body-art game-body-art-right"
				src={game.artRight}
				alt=""
				aria-hidden="true"
			/>
		{/if}
	</div>
</div>
