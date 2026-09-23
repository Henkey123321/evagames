<script lang="ts">
	import { enhance } from '$app/forms';
	import { plural } from '$lib/format';

	let { data, form } = $props();

	type Badge = (typeof data.badges)[number];
	let editing = $state<Badge | 'new' | null>(null);
	let rule = $state('manual');

	function open(b: Badge | 'new') {
		editing = b;
		rule = b === 'new' ? 'completions' : b.rule;
	}

	const ruleText = (b: Badge) =>
		b.rule === 'manual'
			? 'Given by hand'
			: b.rule === 'completions'
				? `After ${plural(b.threshold ?? 0, 'completed game')}`
				: b.rule === 'points'
					? `At ${b.threshold} points`
					: `For completing ${b.presetTitle ?? 'a deleted game'}`;
	const current = $derived(editing && editing !== 'new' ? editing : null);
</script>

<svelte:head><title>Badges | Rewards | EMS</title></svelte:head>

<div class="ems-page">
	<header class="ems-head">
		<div>
			<p class="ems-small"><a href="/ems/rewards">Rewards</a></p>
			<h1>Badges</h1>
			<p>Badges show on a fan's profile. They can also unlock rewards.</p>
		</div>
		<button class="ems-btn ems-btn-primary" type="button" onclick={() => open('new')}
			>New badge</button
		>
	</header>

	{#if form && 'error' in form}<p class="ems-flash ems-flash-error" role="alert">
			{form.error}
		</p>{/if}

	{#if editing}
		<form
			class="ems-panel ems-panel-pad ems-form editor"
			method="POST"
			action="?/save"
			use:enhance={() =>
				async ({ update, result }) => {
					await update();
					if (result.type === 'success') editing = null;
				}}
		>
			{#if current}<input type="hidden" name="id" value={current.id} />{/if}
			<div class="grid">
				<label class="ems-field">
					<span class="ems-label">Mark</span>
					<input
						class="ems-input mark-input"
						name="mark"
						maxlength="8"
						value={current?.mark ?? '★'}
						required
					/>
				</label>
				<label class="ems-field">
					<span class="ems-label">Name</span>
					<input
						class="ems-input"
						name="name"
						maxlength="40"
						value={current?.name ?? ''}
						required
						placeholder="e.g. Devoted"
					/>
				</label>
			</div>
			<label class="ems-field">
				<span class="ems-label">Description</span>
				<input
					class="ems-input"
					name="description"
					maxlength="200"
					value={current?.description ?? ''}
					placeholder="Shown to the fan"
				/>
			</label>
			<div class="grid">
				<label class="ems-field">
					<span class="ems-label">Earned</span>
					<select class="ems-select" name="rule" bind:value={rule}>
						<option value="completions">After a number of completed games</option>
						<option value="points">At a points total</option>
						<option value="completed_preset">For completing a particular game</option>
						<option value="manual">Only when I give it</option>
					</select>
				</label>
				{#if rule === 'completions' || rule === 'points'}
					<label class="ems-field">
						<span class="ems-label">{rule === 'points' ? 'Points' : 'Completed games'}</span>
						<input
							class="ems-input"
							type="number"
							name="threshold"
							min="1"
							value={current?.threshold ?? ''}
							required
						/>
					</label>
				{:else if rule === 'completed_preset'}
					<label class="ems-field">
						<span class="ems-label">Game</span>
						<select class="ems-select" name="presetId">
							{#each data.presets as p (p.id)}<option
									value={p.id}
									selected={current?.presetId === p.id}>{p.title}</option
								>{/each}
						</select>
					</label>
				{/if}
			</div>
			<div class="ems-actions">
				<button class="ems-btn ems-btn-primary" type="submit"
					>{current ? 'Save badge' : 'Create badge'}</button
				>
				<button class="ems-btn" type="button" onclick={() => (editing = null)}>Cancel</button>
			</div>
		</form>
	{/if}

	{#if data.badges.length === 0}
		<p class="ems-panel ems-empty">No badges yet.</p>
	{:else}
		<ul class="ems-rows">
			{#each data.badges as b (b.id)}
				<li class="ems-row badge-row">
					<span class="mark" aria-hidden="true">{b.mark}</span>
					<span class="ems-row-main">
						<span class="ems-row-title">{b.name}</span>
						<span class="ems-row-sub">{ruleText(b)}{b.description ? `. ${b.description}` : ''}</span
						>
					</span>
					<span class="ems-actions">
						<span class="ems-small ems-muted">{plural(b.holders, 'fan')}</span>
						<button class="ems-btn ems-btn-small" type="button" onclick={() => open(b)}>Edit</button
						>
						<form method="POST" action="?/archive" use:enhance>
							<input type="hidden" name="id" value={b.id} />
							<button class="ems-btn ems-btn-small" type="submit">Archive</button>
						</form>
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: 7rem minmax(0, 1fr);
		gap: 0.85rem;
	}

	.grid:has(select) {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.mark-input {
		font-size: 1.2rem;
		text-align: center;
	}

	.badge-row {
		grid-template-columns: auto minmax(0, 1fr) auto;
	}

	.badge-row form {
		margin: 0;
	}

	.mark {
		display: grid;
		place-items: center;
		width: 2.4rem;
		height: 2.4rem;
		border: 1px solid var(--ems-accent);
		font-weight: 850;
		color: var(--ems-accent);
		background: var(--ems-hover);
	}

	@media (max-width: 600px) {
		.grid,
		.grid:has(select) {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
