<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import EditorFields from '$lib/ui/ems/EditorFields.svelte';

	let { data, form } = $props();
	const p = $derived(data.preset);
	let confirmDelete = $state(false);
</script>

<svelte:head><title>{p.title} | Games | EMS</title></svelte:head>

<div class="ems-page">
	<header class="ems-head">
		<div>
			<p class="ems-small"><a href="/ems/games">Games</a></p>
			<h1>{p.title}</h1>
			<p>
				{data.typeName} game. Fans play it at
				<a href="/play/{p.slug}" target="_blank" rel="noopener">/play/{p.slug}</a>.
			</p>
		</div>
		<div class="ems-actions">
			<a class="ems-btn" href="/play/{p.slug}" target="_blank" rel="noopener">Try it</a>
			<a class="ems-btn ems-btn-primary" href="/ems/games/{p.id}/send">Send to fans</a>
		</div>
	</header>

	{#if page.url.searchParams.get('created')}
		<p class="ems-flash" role="status">
			Game created. It's hidden until you choose who can play it.
		</p>
	{/if}
	{#if form?.error}<p class="ems-flash ems-flash-error" role="alert">{form.error}</p>{/if}

	<form
		class="ems-form"
		method="POST"
		action="?/save"
		use:enhance={() =>
			async ({ update }) =>
				update({ reset: false })}
	>
		<section class="ems-section" aria-labelledby="basics">
			<h2 id="basics">Basics</h2>
			<div class="ems-panel ems-panel-pad grid">
				<label class="ems-field">
					<span class="ems-label">Name</span>
					<input class="ems-input" name="title" maxlength="60" required value={p.title} />
				</label>
				<label class="ems-field">
					<span class="ems-label">Web address</span>
					<span class="prefixed"
						><span class="ems-muted">/play/</span><input
							class="ems-input"
							name="slug"
							maxlength="60"
							value={p.slug}
						/></span
					>
				</label>
				<label class="ems-field full">
					<span class="ems-label">Instructions shown above the game</span>
					<textarea class="ems-textarea" name="instructions" maxlength="600"
						>{p.instructions}</textarea
					>
				</label>
			</div>
		</section>

		<section class="ems-section" aria-labelledby="who">
			<h2 id="who">Who can play, and where it shows</h2>
			<div class="ems-panel ems-panel-pad grid">
				<label class="ems-field">
					<span class="ems-label">Who can play</span>
					<select class="ems-select" name="visibility">
						<option value="public" selected={p.visibility === 'public'}
							>Everyone, including guests</option
						>
						<option value="members" selected={p.visibility === 'members'}>Signed-in fans</option>
						<option value="hidden" selected={p.visibility === 'hidden'}
							>Only fans I send it to, or who unlock it</option
						>
					</select>
				</label>
				<label class="ems-field">
					<span class="ems-label">On the hub</span>
					<select class="ems-select" name="hubState">
						<option value="available" selected={p.hubState === 'available'}>Show as playable</option
						>
						<option value="coming_soon" selected={p.hubState === 'coming_soon'}
							>Show as coming soon</option
						>
						<option value="off" selected={p.hubState === 'off'}>Not on the hub</option>
					</select>
				</label>
				<label class="ems-field">
					<span class="ems-label">Hub button text</span>
					<input class="ems-input" name="hubLabel" maxlength="24" value={p.hubLabel} />
				</label>
				<label class="ems-field">
					<span class="ems-label">Points for completing it</span>
					<input
						class="ems-input"
						type="number"
						name="pointsOnComplete"
						min="0"
						max="100000"
						value={p.pointsOnComplete}
					/>
					<span class="ems-small ems-muted">Given once per fan, the first time.</span>
				</label>
				<label class="ems-check full">
					<input type="checkbox" name="leaderboardEnabled" checked={p.leaderboardEnabled} />
					Show a leaderboard under the game (only fans who opted in appear)
				</label>
				<label class="ems-field">
					<span class="ems-label">Left figure</span>
					<select class="ems-select" name="artLeft">
						<option value="">None</option>
						{#each data.art as a (a.value)}<option value={a.value} selected={a.value === p.artLeft}
								>{a.label}</option
							>{/each}
					</select>
				</label>
				<label class="ems-field">
					<span class="ems-label">Right figure</span>
					<select class="ems-select" name="artRight">
						<option value="">None</option>
						{#each data.art as a (a.value)}<option value={a.value} selected={a.value === p.artRight}
								>{a.label}</option
							>{/each}
					</select>
				</label>
			</div>
		</section>

		<section class="ems-section" aria-labelledby="settings">
			<h2 id="settings">{data.typeName} settings</h2>
			<div class="ems-panel ems-panel-pad">
				<EditorFields fields={data.fields} values={data.values} />
			</div>
		</section>

		<div class="ems-actions">
			<button class="ems-btn ems-btn-primary" type="submit">Save game</button>
			{#if form && 'saved' in form}<span class="ems-small ems-muted" role="status"
					>Saved. Changes are live.</span
				>{/if}
		</div>
	</form>

	<section class="ems-section">
		<div class="ems-actions">
			<form method="POST" action="?/duplicate">
				<button class="ems-btn ems-btn-small" type="submit">Duplicate as a new version</button>
			</form>
			{#if confirmDelete}
				<form
					method="POST"
					action="?/delete"
					use:enhance={() =>
						async ({ update }) => {
							await update();
							confirmDelete = false;
						}}
				>
					<button class="ems-btn ems-btn-small ems-btn-danger" type="submit"
						>Delete "{p.title}"</button
					>
				</form>
				<button class="ems-btn ems-btn-small" type="button" onclick={() => (confirmDelete = false)}
					>Keep it</button
				>
			{:else}
				<button class="ems-btn ems-btn-small" type="button" onclick={() => (confirmDelete = true)}
					>Delete</button
				>
			{/if}
		</div>
	</section>
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 0.85rem 1rem;
	}

	.full {
		grid-column: 1 / -1;
	}

	.prefixed {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}
</style>
