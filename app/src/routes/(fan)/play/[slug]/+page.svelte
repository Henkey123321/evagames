<script lang="ts">
	import GameHost from '$lib/ui/GameHost.svelte';
	import Leaderboard from '$lib/ui/Leaderboard.svelte';
	import LocalTime from '$lib/ui/LocalTime.svelte';

	import type { FinishResponse } from '$lib/games/sdk/types';

	let { data } = $props();
	const game = $derived(data.game);
	const sent = $derived(data.assignment);
	// Attempts left after rounds played on this page (the game stays mounted to show results).
	let liveAttemptsLeft: number | null | undefined = $state(undefined);
	const attemptsLeft = $derived(
		liveAttemptsLeft === undefined ? sent?.attemptsLeft : liveAttemptsLeft
	);

	function onfinish(r: FinishResponse) {
		if (r.assignment) liveAttemptsLeft = r.assignment.attemptsLeft;
	}

	const CLOSED: Record<string, string> = {
		completed: 'You completed this one. Well done.',
		failed: 'You used all your attempts for this one.',
		expired: 'The deadline for this game has passed.',
		cancelled: 'Eva withdrew this game.'
	};
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
			{#if sent}
				<aside class="sent" aria-label="Sent by Eva">
					<p class="sent-title">
						Eva sent you this game{sent.title !== game.title ? `: ${sent.title}` : ''}
					</p>
					{#if sent.message}<p class="sent-message">{sent.message}</p>{/if}
					<ul class="sent-rules">
						{#each sent.targets as t (t)}<li>{t}</li>{/each}
						{#if sent.deadline}<li>Before <LocalTime value={sent.deadline} /></li>{/if}
						{#if attemptsLeft !== null && attemptsLeft !== undefined}
							<li>{attemptsLeft} {attemptsLeft === 1 ? 'attempt' : 'attempts'} left</li>
						{/if}
						{#if sent.points}<li>{sent.points} points when you complete it</li>{/if}
					</ul>
				</aside>
			{/if}
			{#if sent && !sent.playable}
				<p class="notice">{CLOSED[sent.status] ?? 'This game is not available.'}</p>
			{:else}
				{#key game.slug + (sent?.id ?? '')}
					<GameHost
						slug={game.slug}
						type={game.type}
						config={game.config}
						signedIn={!!data.user}
						assignmentId={sent?.id ?? null}
						{onfinish}
					/>
				{/key}
			{/if}
			{#if data.leaderboard}
				<Leaderboard
					title="Best scores"
					rows={data.leaderboard.map((r) => ({ name: r.name, value: r.score, isMe: r.isMe }))}
					empty="No scores yet. Be the first."
				/>
			{/if}
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

<style>
	.sent {
		display: grid;
		gap: 0.4rem;
		margin-bottom: clamp(0.75rem, 2vw, 1rem);
		padding: 0.85rem 1rem;
		border: 1px solid var(--line);
		border-left: 0.3rem solid var(--eva-red);
		background: var(--panel);
	}

	.sent p {
		margin: 0;
	}

	.sent-title {
		font-size: 0.72rem;
		font-weight: 850;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--eva-red);
	}

	.sent-message {
		font-weight: 700;
		white-space: pre-wrap;
	}

	.sent-rules {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.sent-rules li {
		padding: 0.2rem 0.5rem;
		border: 1px solid var(--line);
		font-size: 0.8rem;
		font-weight: 800;
		background: oklch(97% 0.012 336);
	}
</style>
