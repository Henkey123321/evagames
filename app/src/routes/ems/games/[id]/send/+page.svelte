<script lang="ts">
	import { enhance } from '$app/forms';
	import EditorFields from '$lib/ui/ems/EditorFields.svelte';
	import { TARGET_PREFIX } from '$lib/games/sdk/editor';

	let { data, form } = $props();

	type Fan = { id: string; displayName: string; username: string };
	let picked: Fan[] = $state([]);
	let query = $state('');
	let results: Fan[] = $state([]);
	let deadlineLocal = $state('');
	let sending = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect.pre(() => {
		picked = [...data.preselected];
	});

	const deadlineIso = $derived(deadlineLocal ? new Date(deadlineLocal).toISOString() : '');
	const minDeadline = new Date(
		Date.now() + 10 * 60 * 1000 - new Date().getTimezoneOffset() * 60 * 1000
	)
		.toISOString()
		.slice(0, 16);

	function search() {
		clearTimeout(timer);
		const q = query.trim();
		if (!q) {
			results = [];
			return;
		}
		timer = setTimeout(async () => {
			const res = await fetch(`/ems/api/people-search?q=${encodeURIComponent(q)}`);
			const found: Fan[] = res.ok ? await res.json() : [];
			results = found.filter((f) => !picked.some((p) => p.id === f.id));
		}, 200);
	}

	function add(fan: Fan) {
		picked = [...picked, fan];
		results = results.filter((r) => r.id !== fan.id);
		query = '';
		results = [];
	}
</script>

<svelte:head><title>Send {data.preset.title} | EMS</title></svelte:head>

<div class="ems-page">
	<header class="ems-head">
		<div>
			<p class="ems-small"><a href="/ems/games/{data.preset.id}">{data.preset.title}</a></p>
			<h1>Send {data.preset.title}</h1>
			<p>Fans get a message from you with a link. You can change the settings just for them.</p>
		</div>
	</header>

	{#if form?.error}<p class="ems-flash ems-flash-error" role="alert">{form.error}</p>{/if}

	<form
		class="ems-form"
		method="POST"
		use:enhance={() => {
			sending = true;
			return async ({ update }) => {
				await update({ reset: false });
				sending = false;
			};
		}}
	>
		<section class="ems-section" aria-labelledby="who">
			<h2 id="who">Who</h2>
			<div class="ems-panel ems-panel-pad ems-form">
				<div class="ems-field picker">
					<label class="ems-label" for="fan-search">Fans</label>
					<input
						id="fan-search"
						class="ems-input"
						type="search"
						autocomplete="off"
						placeholder="Search by name or OnlyFans / LoyalFans handle"
						bind:value={query}
						oninput={search}
					/>
					{#if results.length}
						<ul class="results" role="listbox" aria-label="Matching fans">
							{#each results as r (r.id)}
								<li>
									<button type="button" onclick={() => add(r)}>
										<strong>{r.displayName}</strong> <span class="ems-muted">@{r.username}</span>
									</button>
								</li>
							{/each}
						</ul>
					{/if}
					{#if picked.length}
						<div class="ems-chips">
							{#each picked as fan (fan.id)}
								<input type="hidden" name="ids" value={fan.id} />
								<span class="ems-chip">
									{fan.displayName}
									<button
										type="button"
										class="ems-link-button"
										aria-label="Remove {fan.displayName}"
										onclick={() => (picked = picked.filter((p) => p.id !== fan.id))}>×</button
									>
								</span>
							{/each}
						</div>
					{/if}
				</div>
				<label class="ems-field">
					<span class="ems-label">And/or a whole list</span>
					<select class="ems-select" name="listId">
						<option value="">No list</option>
						{#each data.lists as l (l.id)}<option value={l.id}>{l.name} ({l.members})</option
							>{/each}
					</select>
				</label>
			</div>
		</section>

		<section class="ems-section" aria-labelledby="settings">
			<h2 id="settings">{data.typeName} settings for this send</h2>
			<div class="ems-panel ems-panel-pad">
				<EditorFields fields={data.fields} values={data.values} />
			</div>
		</section>

		<section class="ems-section" aria-labelledby="rules">
			<h2 id="rules">Rules</h2>
			<div class="ems-panel ems-panel-pad grid">
				<label class="ems-field">
					<span class="ems-label">Deadline</span>
					<input
						class="ems-input"
						type="datetime-local"
						min={minDeadline}
						bind:value={deadlineLocal}
					/>
					<input type="hidden" name="deadlineIso" value={deadlineIso} />
					<span class="ems-small ems-muted">Leave empty for no deadline. Your local time.</span>
				</label>
				<label class="ems-field">
					<span class="ems-label">Attempts</span>
					<input
						class="ems-input"
						type="number"
						name="maxAttempts"
						min="1"
						max="100"
						placeholder="Unlimited"
					/>
				</label>
				{#each data.targets as t (t.key)}
					<label class="ems-field">
						<span class="ems-label">{t.label}{t.unit ? ` (${t.unit.trim()})` : ''}</span>
						<input
							class="ems-input"
							type="number"
							name={TARGET_PREFIX + t.key}
							min={t.min}
							max={t.max}
							placeholder="Optional"
						/>
					</label>
				{/each}
			</div>
		</section>

		<section class="ems-section" aria-labelledby="note">
			<h2 id="note">Message and reward</h2>
			<div class="ems-panel ems-panel-pad grid">
				<label class="ems-field">
					<span class="ems-label">Title fans see</span>
					<input class="ems-input" name="title" maxlength="80" required value={data.preset.title} />
				</label>
				<label class="ems-field">
					<span class="ems-label">Points for completing it</span>
					<input class="ems-input" type="number" name="points" min="0" max="100000" value="0" />
				</label>
				<label class="ems-field">
					<span class="ems-label">Reward for completing it</span>
					<select class="ems-select" name="rewardId">
						<option value="">No reward</option>
						{#each data.rewards as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
					</select>
				</label>
				<label class="ems-field full">
					<span class="ems-label">Your message</span>
					<textarea
						class="ems-textarea"
						name="message"
						maxlength="2000"
						placeholder="Show me what you can do."></textarea>
				</label>
				<label class="ems-field full">
					<span class="ems-label">Also save these settings as a new game (optional)</span>
					<input
						class="ems-input"
						name="saveAs"
						maxlength="60"
						placeholder="Name for the new version"
					/>
				</label>
			</div>
		</section>

		<div class="ems-actions">
			<button class="ems-btn ems-btn-primary" type="submit" disabled={sending}
				>{sending ? 'Sending…' : 'Send game'}</button
			>
			<span class="ems-small ems-muted"
				>Each fan gets it in their inbox and under "For you" on the hub.</span
			>
		</div>
	</form>
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: 0.85rem 1rem;
	}

	.full {
		grid-column: 1 / -1;
	}

	.picker {
		position: relative;
	}

	.results {
		position: absolute;
		top: 100%;
		right: 0;
		left: 0;
		z-index: 3;
		margin: 0;
		padding: 0;
		border: 1px solid var(--ems-line-strong);
		list-style: none;
		background: var(--ems-panel);
	}

	.results button {
		display: block;
		width: 100%;
		padding: 0.55rem 0.75rem;
		border: 0;
		font: inherit;
		text-align: left;
		color: inherit;
		background: none;
		cursor: pointer;
	}

	.results button:hover,
	.results button:focus-visible {
		background: var(--ems-hover);
	}

	.ems-chip .ems-link-button {
		margin-left: 0.2rem;
		text-decoration: none;
	}
</style>
