<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';

	let { data, form } = $props();

	const r = $derived(data.reward);
	let kind = $state('link');
	// Re-sync the picker whenever a different reward is opened.
	$effect.pre(() => {
		kind = r?.kind && r.kind !== 'media' ? r.kind : 'link';
	});
	let triggerType = $state('preset_completed');
	let confirmArchive = $state(false);

	const KINDS = [
		{
			id: 'link',
			label: 'Link or code',
			help: 'Reveal a link (e.g. a free-trial or private post) and/or a code.'
		},
		{
			id: 'task',
			label: 'Task',
			help: 'Give the fan something to do. You can ask for written proof.'
		},
		{ id: 'game', label: 'Game', help: 'Unlock a game that is hidden from the hub.' },
		{
			id: 'manual',
			label: 'Something I send',
			help: 'You deliver it yourself (e.g. on OnlyFans), then tick it off.'
		}
	];
	const triggerLabel = (t: {
		type: string;
		threshold: number | null;
		presetTitle: string | null;
		badgeName: string | null;
	}) =>
		t.type === 'preset_completed'
			? `Completing ${t.presetTitle ?? 'a deleted game'}`
			: t.type === 'points_reached'
				? `Reaching ${t.threshold} points`
				: `Earning the ${t.badgeName ?? 'deleted'} badge`;
</script>

<svelte:head><title>{r ? r.name : 'New reward'} | Rewards | EMS</title></svelte:head>

<div class="ems-page">
	<header class="ems-head">
		<div>
			<p class="ems-small"><a href="/ems/rewards?view=library">Rewards</a></p>
			<h1>{r ? r.name : 'New reward'}</h1>
			{#if r}<p>Given to {r.granted} {r.granted === 1 ? 'fan' : 'fans'} so far.</p>{/if}
		</div>
	</header>

	{#if form && 'error' in form}<p class="ems-flash ems-flash-error" role="alert">
			{form.error}
		</p>{/if}
	{#if page.url.searchParams.get('created')}<p class="ems-flash" role="status">
			Reward created. Now choose when it unlocks.
		</p>{/if}

	<form
		class="ems-panel ems-panel-pad ems-form"
		method="POST"
		action="?/save"
		use:enhance={() =>
			async ({ update }) =>
				update({ reset: false })}
	>
		<fieldset class="kinds">
			<legend class="ems-label">What is it?</legend>
			{#each KINDS as k (k.id)}
				<label class={['kind', kind === k.id && 'on']}>
					<input type="radio" name="kind" value={k.id} bind:group={kind} />
					<strong>{k.label}</strong>
					<span class="ems-small ems-muted">{k.help}</span>
				</label>
			{/each}
		</fieldset>

		<label class="ems-field">
			<span class="ems-label">Name</span>
			<input
				class="ems-input"
				name="name"
				maxlength="80"
				required
				value={r?.name ?? ''}
				placeholder="e.g. VIP free trial"
			/>
		</label>

		<label class="ems-field">
			<span class="ems-label">Message the fan sees</span>
			<textarea
				class="ems-textarea"
				name="message"
				maxlength="2000"
				placeholder="Well done, pet. Here's your treat.">{r?.message ?? ''}</textarea
			>
		</label>

		{#if kind === 'link'}
			<div class="two">
				<label class="ems-field">
					<span class="ems-label">Link</span>
					<input
						class="ems-input"
						name="url"
						type="url"
						placeholder="https://"
						value={r?.content.url ?? ''}
					/>
				</label>
				<label class="ems-field">
					<span class="ems-label">Code</span>
					<input class="ems-input" name="code" maxlength="200" value={r?.content.code ?? ''} />
				</label>
			</div>
		{:else if kind === 'task'}
			<label class="ems-field">
				<span class="ems-label">Instructions</span>
				<textarea class="ems-textarea" name="instructions" maxlength="4000" required
					>{r?.content.instructions ?? ''}</textarea
				>
			</label>
			<label class="ems-field">
				<span class="ems-label">Proof</span>
				<select class="ems-select" name="proof">
					<option value="none" selected={(r?.content.proof ?? 'none') === 'none'}
						>No proof, I'll mark it done myself</option
					>
					<option value="text" selected={r?.content.proof === 'text'}
						>Written proof from the fan</option
					>
					<option disabled>Photo proof (coming with the media library)</option>
				</select>
			</label>
		{:else if kind === 'game'}
			<label class="ems-field">
				<span class="ems-label">Game it unlocks</span>
				<select class="ems-select" name="presetId" required>
					{#each data.presets as p (p.id)}
						<option value={p.id} selected={r?.content.presetId === p.id}>
							{p.title}{p.visibility === 'hidden' ? ' (hidden)' : ''}
						</option>
					{/each}
				</select>
				<span class="ems-small ems-muted"
					>Set the game to "Only when sent" on the Site page so only fans who unlock it can play.</span
				>
			</label>
		{:else if kind === 'manual'}
			<label class="ems-field">
				<span class="ems-label">Note for you and your staff</span>
				<input
					class="ems-input"
					name="staffNote"
					maxlength="1000"
					placeholder="e.g. Send the custom clip on OF"
					value={r?.content.staffNote ?? ''}
				/>
			</label>
		{/if}

		<label class="ems-check">
			<input type="checkbox" name="requiresApproval" checked={r?.requiresApproval ?? false} />
			I approve each one before the fan gets it
		</label>
		<span class="ems-small ems-muted"
			>Useful for scores that can't be fully checked, like 2048.</span
		>

		<div class="ems-actions">
			<button class="ems-btn ems-btn-primary" type="submit"
				>{r ? 'Save reward' : 'Create reward'}</button
			>
			{#if form && 'saved' in form}<span class="ems-small ems-muted" role="status">Saved</span>{/if}
		</div>
	</form>

	{#if r}
		<section class="ems-section" aria-labelledby="triggers">
			<h2 id="triggers">Unlocks automatically when</h2>
			{#if data.triggers.length === 0}
				<p class="ems-panel ems-empty">
					Nothing yet. Add a rule below, or give it to fans by hand from their People page.
				</p>
			{:else}
				<ul class="ems-rows">
					{#each data.triggers as t (t.id)}
						<li class="ems-row trig">
							<span class="ems-row-title">{triggerLabel(t)}</span>
							<form method="POST" action="?/removeTrigger" use:enhance>
								<input type="hidden" name="triggerId" value={t.id} />
								<button class="ems-btn ems-btn-small" type="submit">Remove</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}

			<form
				class="ems-panel ems-panel-pad ems-toolbar"
				method="POST"
				action="?/addTrigger"
				use:enhance
			>
				<select class="ems-select" name="type" bind:value={triggerType} aria-label="Rule">
					<option value="preset_completed">A fan completes a game</option>
					<option value="points_reached">A fan reaches a points total</option>
					<option value="badge_earned" disabled={data.badges.length === 0}
						>A fan earns a badge</option
					>
				</select>
				{#if triggerType === 'preset_completed'}
					<select class="ems-select" name="presetId" aria-label="Game">
						{#each data.presets as p (p.id)}<option value={p.id}>{p.title}</option>{/each}
					</select>
				{:else if triggerType === 'points_reached'}
					<input
						class="ems-input"
						type="number"
						name="threshold"
						min="1"
						placeholder="Points"
						aria-label="Points total"
					/>
				{:else}
					<select class="ems-select" name="badgeId" aria-label="Badge">
						{#each data.badges as b (b.id)}<option value={b.id}>{b.name}</option>{/each}
					</select>
				{/if}
				<button class="ems-btn" type="submit">Add rule</button>
			</form>
			<p class="ems-small ems-muted">Each rule gives the reward once per fan.</p>
		</section>

		<section class="ems-section">
			<div class="ems-actions">
				{#if confirmArchive}
					<form method="POST" action="?/archive">
						<button class="ems-btn ems-btn-danger" type="submit">Archive "{r.name}"</button>
					</form>
					<button class="ems-btn" type="button" onclick={() => (confirmArchive = false)}
						>Keep it</button
					>
					<span class="ems-small ems-muted"
						>Fans who already have it keep it. It stops unlocking for anyone new.</span
					>
				{:else}
					<button
						class="ems-btn ems-btn-small"
						type="button"
						onclick={() => (confirmArchive = true)}>Archive reward</button
					>
				{/if}
			</div>
		</section>
	{/if}
</div>

<style>
	.kinds {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.kinds legend {
		margin-bottom: 0.4rem;
	}

	.kind {
		display: grid;
		gap: 0.2rem;
		padding: 0.7rem 0.85rem;
		border: 1px solid var(--ems-line-strong);
		cursor: pointer;
	}

	.kind input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.kind.on {
		border-color: var(--ems-accent);
		box-shadow: inset 3px 0 0 var(--ems-accent);
		background: var(--ems-hover);
	}

	.kind:focus-within {
		outline: 2px solid var(--ems-accent);
		outline-offset: 1px;
	}

	.two {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.85rem;
	}

	.trig {
		grid-template-columns: minmax(0, 1fr) auto;
	}

	.trig form {
		margin: 0;
	}

	@media (max-width: 600px) {
		.two {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
