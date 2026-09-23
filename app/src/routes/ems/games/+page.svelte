<script lang="ts">
	import { enhance } from '$app/forms';
	import { plural } from '$lib/format';

	let { data, form } = $props();
	let creating = $state(false);

	const VIS: Record<string, string> = {
		public: 'Everyone',
		members: 'Signed-in fans',
		hidden: 'Only when sent'
	};
	const HUB: Record<string, string> = {
		available: 'On the hub',
		coming_soon: 'Coming soon',
		off: 'Not on the hub'
	};
</script>

<svelte:head><title>Games | EMS</title></svelte:head>

<div class="ems-page">
	<header class="ems-head">
		<div>
			<h1>Games</h1>
			<p>
				Each game here is a version with its own settings. Make as many versions as you like and
				send any of them.
			</p>
		</div>
		<div class="ems-actions">
			<a class="ems-btn" href="/ems/sent">Sent games</a>
			<button
				class="ems-btn ems-btn-primary"
				type="button"
				onclick={() => (creating = !creating)}
				aria-expanded={creating}
			>
				{creating ? 'Close' : 'New game'}
			</button>
		</div>
	</header>

	{#if form?.error}<p class="ems-flash ems-flash-error" role="alert">{form.error}</p>{/if}

	{#if creating}
		<form class="ems-panel ems-panel-pad ems-form" method="POST" action="?/create" use:enhance>
			<fieldset class="types">
				<legend class="ems-label">Game type</legend>
				{#each data.types as t, i (t.type)}
					<label class="type">
						<input type="radio" name="type" value={t.type} checked={i === 0} />
						<strong>{t.name}</strong>
						<span class="ems-small ems-muted">{t.description}</span>
					</label>
				{/each}
			</fieldset>
			<label class="ems-field">
				<span class="ems-label">Name</span>
				<input
					class="ems-input"
					name="title"
					maxlength="60"
					required
					placeholder="e.g. Memory: tease edition"
				/>
			</label>
			<div class="ems-actions">
				<button class="ems-btn ems-btn-primary" type="submit">Create and edit</button>
				<span class="ems-small ems-muted"
					>New games start hidden, so fans only see them once you're ready.</span
				>
			</div>
		</form>
	{/if}

	<ul class="ems-rows">
		{#each data.presets as p (p.id)}
			<li class="ems-row game-row">
				<a class="ems-row-main" href="/ems/games/{p.id}">
					<span class="ems-row-title">
						{p.title}
						<span class="ems-chip">{p.typeName}</span>
					</span>
					<span class="ems-row-sub">
						{HUB[p.hubState]}, {VIS[p.visibility].toLowerCase()} can play{p.pointsOnComplete
							? `, ${p.pointsOnComplete} points`
							: ''}. {plural(p.plays, 'round')} played.
					</span>
				</a>
				<span class="ems-actions">
					<a class="ems-btn ems-btn-small" href="/ems/games/{p.id}">Edit</a>
					<a class="ems-btn ems-btn-small ems-btn-primary" href="/ems/games/{p.id}/send">Send</a>
				</span>
			</li>
		{/each}
	</ul>
</div>

<style>
	.game-row {
		grid-template-columns: minmax(0, 1fr) auto;
	}

	.game-row .ems-row-main {
		text-decoration: none;
	}

	.game-row .ems-row-title {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}

	.game-row .ems-row-sub {
		white-space: normal;
	}

	.types {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.types legend {
		margin-bottom: 0.4rem;
	}

	.type {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.2rem 0.5rem;
		padding: 0.7rem 0.85rem;
		border: 1px solid var(--ems-line-strong);
		cursor: pointer;
	}

	.type span {
		grid-column: 2;
	}

	.type:has(input:checked) {
		border-color: var(--ems-accent);
		box-shadow: inset 3px 0 0 var(--ems-accent);
		background: var(--ems-hover);
	}

	.type input {
		accent-color: var(--ems-accent);
	}
</style>
