<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { ago, plural } from '$lib/format';

	let { data, form } = $props();

	let selected: string[] = $state([]);
	let confirmDelete = $state(false);
	let renaming = $state(false);

	const allSelected = $derived(
		data.people.length > 0 && data.people.every((p) => selected.includes(p.id))
	);
	const heading = $derived(
		data.currentList?.name ?? (data.view === 'favorites' ? 'Favourites' : 'Everyone')
	);

	function toggleAll() {
		selected = allSelected ? [] : data.people.map((p) => p.id);
	}

	function viewHref(list: string) {
		const params = new URLSearchParams();
		if (list) params.set('list', list);
		if (data.filter !== 'all') params.set('filter', data.filter);
		if (data.q) params.set('q', data.q);
		const qs = params.toString();
		return `/ems/people${qs ? `?${qs}` : ''}`;
	}

	function pageHref(n: number) {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('page', String(n));
		return `?${params}`;
	}

	const afterBulk =
		() =>
		async ({ update }: { update: () => Promise<void> }) => {
			await update();
			selected = [];
		};

	// Reset per-view UI state when switching list.
	$effect(() => {
		void data.view;
		selected = [];
		confirmDelete = false;
		renaming = false;
	});
</script>

<svelte:head><title>People | EMS</title></svelte:head>

<div class="ems-page">
	<header class="ems-head">
		<div>
			<h1>People</h1>
			<p>Favourites stay at the top. Everyone else is ordered by what they did most recently.</p>
		</div>
	</header>

	{#if form && 'error' in form}<p class="ems-flash ems-flash-error" role="alert">
			{form.error}
		</p>{/if}

	<div class="ems-split">
		<!-- Lists -->
		<nav class="ems-section" aria-label="Lists">
			<ul class="ems-rows lists">
				<li>
					<a
						class="ems-row list-link"
						href={viewHref('')}
						aria-current={data.view === '' ? 'page' : undefined}
					>
						<span class="ems-row-title">Everyone</span>
					</a>
				</li>
				<li>
					<a
						class="ems-row list-link"
						href={viewHref('favorites')}
						aria-current={data.view === 'favorites' ? 'page' : undefined}
					>
						<span class="ems-row-title"
							><span class="star" aria-hidden="true">★</span> Favourites</span
						>
					</a>
				</li>
				{#each data.lists as list (list.id)}
					<li>
						<a
							class="ems-row list-link"
							href={viewHref(list.id)}
							aria-current={data.view === list.id ? 'page' : undefined}
						>
							<span class="ems-row-title">{list.name}</span>
							<span class="ems-row-meta">{list.members}</span>
						</a>
					</li>
				{/each}
			</ul>

			<form class="ems-toolbar" method="POST" action="?/createList" use:enhance>
				<input
					class="ems-input"
					name="name"
					placeholder="New list, e.g. VIPs"
					maxlength="40"
					aria-label="New list name"
					required
				/>
				<button class="ems-btn" type="submit">Add list</button>
			</form>
		</nav>

		<!-- People -->
		<section class="ems-section" aria-labelledby="people-heading">
			<div class="ems-section-head">
				<h2 id="people-heading">{heading}</h2>
				{#if data.currentList}
					<div class="ems-actions">
						{#if renaming}
							<form
								class="ems-toolbar"
								method="POST"
								action="?/renameList"
								use:enhance={() =>
									async ({ update }) => {
										await update();
										renaming = false;
									}}
							>
								<input type="hidden" name="listId" value={data.currentList.id} />
								<input
									class="ems-input"
									name="name"
									value={data.currentList.name}
									maxlength="40"
									aria-label="List name"
									required
								/>
								<button class="ems-btn ems-btn-small" type="submit">Save</button>
								<button
									class="ems-btn ems-btn-small"
									type="button"
									onclick={() => (renaming = false)}>Cancel</button
								>
							</form>
						{:else}
							<button class="ems-btn ems-btn-small" type="button" onclick={() => (renaming = true)}
								>Rename</button
							>
							{#if confirmDelete}
								<form
									method="POST"
									action="?/deleteList"
									use:enhance={() =>
										async ({ update }) => {
											await update();
											window.location.href = '/ems/people';
										}}
								>
									<input type="hidden" name="listId" value={data.currentList.id} />
									<button class="ems-btn ems-btn-small ems-btn-danger" type="submit"
										>Delete "{data.currentList.name}"</button
									>
								</form>
								<button
									class="ems-btn ems-btn-small"
									type="button"
									onclick={() => (confirmDelete = false)}>Keep it</button
								>
							{:else}
								<button
									class="ems-btn ems-btn-small"
									type="button"
									onclick={() => (confirmDelete = true)}>Delete list</button
								>
							{/if}
						{/if}
					</div>
				{/if}
			</div>

			<form class="ems-toolbar" method="GET" data-sveltekit-keepfocus>
				{#if data.view}<input type="hidden" name="list" value={data.view} />{/if}
				<input
					class="ems-input"
					type="search"
					name="q"
					value={data.q}
					placeholder="Search names and OnlyFans / LoyalFans handles"
					aria-label="Search people"
				/>
				<select
					class="ems-select"
					name="filter"
					aria-label="Filter"
					onchange={(e) => e.currentTarget.form?.requestSubmit()}
				>
					{#each data.filters as f (f.id)}
						<option value={f.id} selected={f.id === data.filter}>{f.label}</option>
					{/each}
				</select>
				<button class="ems-btn" type="submit">Search</button>
			</form>

			{#if selected.length > 0}
				<form
					class="ems-panel ems-panel-pad bulk"
					method="POST"
					action="?/bulk"
					use:enhance={afterBulk}
				>
					{#each selected as id (id)}<input type="hidden" name="ids" value={id} />{/each}
					{#if data.currentList}<input type="hidden" name="from" value={data.currentList.id} />{/if}
					<strong>{plural(selected.length, 'person', 'people')} selected</strong>
					<div class="ems-toolbar">
						{#if data.lists.length > 0}
							<select class="ems-select" name="target" aria-label="List">
								{#each data.lists.filter((l) => l.id !== data.currentList?.id) as list (list.id)}
									<option value={list.id}>{list.name}</option>
								{/each}
							</select>
							<button class="ems-btn ems-btn-small" name="op" value="add">Add to list</button>
							{#if data.currentList}
								<button class="ems-btn ems-btn-small" name="op" value="move">Move to list</button>
							{/if}
						{/if}
						{#if data.currentList}
							<button class="ems-btn ems-btn-small" name="op" value="remove"
								>Remove from {data.currentList.name}</button
							>
						{/if}
						<button class="ems-btn ems-btn-small" name="op" value="favorite">Favourite</button>
						<button class="ems-btn ems-btn-small" name="op" value="unfavorite">Unfavourite</button>
						<button class="ems-btn ems-btn-small" type="button" onclick={() => (selected = [])}
							>Clear</button
						>
					</div>
				</form>
			{/if}

			{#if data.people.length === 0}
				<p class="ems-panel ems-empty">
					{#if data.q || data.filter !== 'all'}
						Nobody matches. Try a different search or filter.
					{:else if data.currentList}
						This list is empty. Select people in Everyone and use "Add to list".
					{:else if data.view === 'favorites'}
						No favourites yet. Tap the star next to someone to pin them here and at the top of every
						list.
					{:else}
						No fans have joined yet.
					{/if}
				</p>
			{:else}
				<ul class="ems-rows">
					<li class="select-all">
						<label class="ems-check ems-small">
							<input type="checkbox" checked={allSelected} onchange={toggleAll} />
							Select all on this page
						</label>
					</li>
					{#each data.people as person (person.id)}
						<li class="person">
							<input
								type="checkbox"
								class="pick"
								aria-label="Select {person.displayName}"
								value={person.id}
								bind:group={selected}
							/>
							<form method="POST" action="?/bulk" use:enhance>
								<input type="hidden" name="ids" value={person.id} />
								<button
									class="ems-fav"
									name="op"
									value={person.favorite ? 'unfavorite' : 'favorite'}
									aria-pressed={person.favorite}
									aria-label={person.favorite
										? `Unfavourite ${person.displayName}`
										: `Favourite ${person.displayName}`}>{person.favorite ? '★' : '☆'}</button
								>
							</form>
							<a class="person-link" href="/ems/people/{person.id}">
								<span class="ems-row-main">
									<span class="ems-row-title">{person.displayName}</span>
									<span class="ems-row-sub">@{person.username}</span>
								</span>
								<span class="ems-chips">
									{#if person.onlyfansHandle}
										<span
											class={[
												'ems-chip',
												person.onlyfansVerified ? 'ems-chip-ok' : 'ems-chip-warn'
											]}
											title={person.onlyfansVerified ? 'Verified' : 'Not verified'}
											>OF @{person.onlyfansHandle}</span
										>
									{/if}
									{#if person.loyalfansHandle}
										<span
											class={[
												'ems-chip',
												person.loyalfansVerified ? 'ems-chip-ok' : 'ems-chip-warn'
											]}
											title={person.loyalfansVerified ? 'Verified' : 'Not verified'}
											>LF @{person.loyalfansHandle}</span
										>
									{/if}
									{#each person.lists as l (l.id)}<span class="ems-chip">{l.name}</span>{/each}
								</span>
								<span class="ems-row-meta">{ago(person.lastActivityAt ?? person.createdAt)}</span>
							</a>
						</li>
					{/each}
				</ul>

				{#if data.page > 1 || data.hasMore}
					<div class="ems-actions">
						{#if data.page > 1}<a class="ems-btn ems-btn-small" href={pageHref(data.page - 1)}
								>Previous</a
							>{/if}
						<span class="ems-muted ems-small">Page {data.page}</span>
						{#if data.hasMore}<a class="ems-btn ems-btn-small" href={pageHref(data.page + 1)}
								>Next</a
							>{/if}
					</div>
				{/if}
			{/if}
		</section>
	</div>
</div>

<style>
	.lists .ems-row {
		grid-template-columns: minmax(0, 1fr) auto;
	}

	.list-link[aria-current='page'] {
		box-shadow: inset 3px 0 0 var(--ems-accent);
		background: var(--ems-hover);
	}

	.list-link[aria-current='page'] .ems-row-title {
		color: var(--ems-accent);
	}

	.star {
		color: var(--ems-fav);
	}

	.bulk {
		display: grid;
		gap: 0.6rem;
	}

	.select-all {
		padding: 0.45rem 1rem;
		background: var(--ems-bg);
	}

	.person {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr);
		align-items: center;
		gap: 0 0.35rem;
		padding-left: 1rem;
	}

	.person:hover {
		background: var(--ems-hover);
	}

	.pick {
		width: 1rem;
		height: 1rem;
		accent-color: var(--ems-accent);
	}

	.person form {
		margin: 0;
	}

	.person-link {
		display: grid;
		grid-template-columns: minmax(8rem, 14rem) minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.35rem 1rem;
		padding: 0.65rem 1rem 0.65rem 0.25rem;
		text-decoration: none;
	}

	.person-link:focus-visible {
		outline: 2px solid var(--ems-accent);
		outline-offset: -2px;
	}

	@media (max-width: 700px) {
		.person-link {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.person-link .ems-chips {
			grid-column: 1 / -1;
			grid-row: 2;
		}
	}
</style>
