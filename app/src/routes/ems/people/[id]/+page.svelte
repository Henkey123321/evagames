<script lang="ts">
	import { refreshAfterRead } from '$lib/ui/ems/refresh';
	import { enhance } from '$app/forms';
	import { ago, describeActivity, fullDate } from '$lib/format';

	let { data, form } = $props();

	$effect(() => refreshAfterRead(data.justRead));
	const p = $derived(data.person);
	const u = $derived(p.user);
	const memberOf = $derived(new Set(p.lists.map((l) => l.id)));
	let confirmDisable = $state(false);

	const handles = $derived([
		{
			platform: 'onlyfans',
			label: 'OnlyFans',
			handle: u.onlyfansHandle,
			verifiedAt: u.onlyfansVerifiedAt,
			url: 'https://onlyfans.com/'
		},
		{
			platform: 'loyalfans',
			label: 'LoyalFans',
			handle: u.loyalfansHandle,
			verifiedAt: u.loyalfansVerifiedAt,
			url: 'https://www.loyalfans.com/'
		}
	]);
</script>

<svelte:head><title>{u.displayName} | EMS</title></svelte:head>

<div class="ems-page">
	<header class="ems-head">
		<div>
			<p class="ems-small"><a href="/ems/people">People</a></p>
			<h1>
				{u.displayName}
				{#if u.disabledAt}<span class="ems-chip ems-chip-warn">Disabled</span>{/if}
			</h1>
			<p>
				@{u.username}. Joined {ago(u.createdAt)}, last active {ago(
					u.lastActivityAt ?? u.createdAt
				)}.
			</p>
		</div>
		<form method="POST" action="?/favorite" use:enhance>
			<input type="hidden" name="on" value={p.favorite ? '0' : '1'} />
			<button class="ems-btn" type="submit" aria-pressed={p.favorite}>
				<span class="star" class:on={p.favorite} aria-hidden="true">{p.favorite ? '★' : '☆'}</span>
				{p.favorite ? 'Favourite' : 'Add to favourites'}
			</button>
		</form>
	</header>

	<div class="person-grid">
		<!-- Left: facts and admin -->
		<div class="col">
			<section class="ems-section" aria-labelledby="names">
				<h2 id="names">OnlyFans and LoyalFans</h2>
				<ul class="ems-rows">
					{#each handles as h (h.platform)}
						<li class="ems-row handle-row">
							<span class="ems-row-main">
								<span class="ems-row-title">
									{h.label}
									{#if h.handle}
										<span class={['ems-chip', h.verifiedAt ? 'ems-chip-ok' : 'ems-chip-warn']}>
											{h.verifiedAt ? `Verified ${ago(h.verifiedAt)}` : 'Not verified'}
										</span>
									{/if}
								</span>
								<span class="ems-row-sub">
									{#if h.handle}
										<a href="{h.url}{h.handle}" target="_blank" rel="noopener noreferrer"
											>@{h.handle}</a
										>
									{:else}
										Not added
									{/if}
								</span>
							</span>
							{#if h.handle}
								<form method="POST" action="?/verify" use:enhance>
									<input type="hidden" name="platform" value={h.platform} />
									<input type="hidden" name="verified" value={h.verifiedAt ? '0' : '1'} />
									<button
										class={['ems-btn', 'ems-btn-small', !h.verifiedAt && 'ems-btn-primary']}
										type="submit"
									>
										{h.verifiedAt ? 'Unverify' : 'Mark verified'}
									</button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			</section>

			<section class="ems-section" aria-labelledby="in-lists">
				<h2 id="in-lists">Lists</h2>
				{#if data.lists.length === 0}
					<p class="ems-panel ems-empty">
						No lists yet. Create one on the <a href="/ems/people">People</a> page.
					</p>
				{:else}
					<div class="ems-panel ems-panel-pad ems-chips">
						{#each data.lists as list (list.id)}
							<form method="POST" action="?/lists" use:enhance>
								<input type="hidden" name="listId" value={list.id} />
								<input type="hidden" name="member" value={memberOf.has(list.id) ? '0' : '1'} />
								<button
									class={['ems-btn', 'ems-btn-small', memberOf.has(list.id) && 'ems-btn-primary']}
									type="submit"
									aria-pressed={memberOf.has(list.id)}>{list.name}</button
								>
							</form>
						{/each}
					</div>
				{/if}
			</section>

			<section class="ems-section" aria-labelledby="notes">
				<h2 id="notes">Private notes</h2>
				<form class="ems-form" method="POST" action="?/note" use:enhance>
					<textarea
						class="ems-textarea"
						name="body"
						maxlength="2000"
						placeholder="Only you and your staff can see notes."
						aria-label="New note"></textarea>
					{#if form && 'noteError' in form}<span class="ems-flash ems-flash-error"
							>{form.noteError}</span
						>{/if}
					<div class="ems-actions"><button class="ems-btn" type="submit">Save note</button></div>
				</form>
				{#if p.notes.length > 0}
					<ul class="ems-rows">
						{#each p.notes as note (note.id)}
							<li class="note">
								<p>{note.body}</p>
								<div class="ems-actions ems-small ems-muted">
									<span>{note.authorName ?? 'Former staff'}, {ago(note.createdAt)}</span>
									<form method="POST" action="?/deleteNote" use:enhance>
										<input type="hidden" name="noteId" value={note.id} />
										<button class="ems-link-button" type="submit">Delete</button>
									</form>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="ems-section" aria-labelledby="account-admin">
				<h2 id="account-admin">Account</h2>
				<div class="ems-panel ems-panel-pad ems-form">
					{#if form && 'resetCode' in form}
						<div class="ems-flash" role="status">
							<p>
								Send this code to {u.displayName}. It works once, for 48 hours, at
								<strong>/recover</strong>:
							</p>
							<p class="ems-code">{form.resetCode}</p>
						</div>
					{/if}
					<div class="ems-actions">
						<form method="POST" action="?/resetCode" use:enhance>
							<button class="ems-btn ems-btn-small" type="submit">Make a password reset code</button
							>
						</form>
						{#if u.disabledAt}
							<form method="POST" action="?/disable" use:enhance>
								<input type="hidden" name="disabled" value="0" />
								<button class="ems-btn ems-btn-small" type="submit">Enable account</button>
							</form>
						{:else if confirmDisable}
							<form
								method="POST"
								action="?/disable"
								use:enhance={() =>
									async ({ update }) => {
										await update();
										confirmDisable = false;
									}}
							>
								<input type="hidden" name="disabled" value="1" />
								<button class="ems-btn ems-btn-small ems-btn-danger" type="submit"
									>Disable and sign them out</button
								>
							</form>
							<button
								class="ems-btn ems-btn-small"
								type="button"
								onclick={() => (confirmDisable = false)}>Cancel</button
							>
						{:else}
							<button
								class="ems-btn ems-btn-small"
								type="button"
								onclick={() => (confirmDisable = true)}>Disable account</button
							>
						{/if}
					</div>
					<p class="ems-small ems-muted">
						Leaderboards: {u.leaderboardOptIn ? 'shows their name' : 'hidden'}. Last seen {ago(
							u.lastSeenAt
						)}.
					</p>
				</div>
			</section>
		</div>

		<!-- Right: conversation, games, activity -->
		<div class="col">
			{#if data.canMessage && data.thread}
				<section class="ems-section" aria-labelledby="messages">
					<div class="ems-section-head">
						<h2 id="messages">Messages</h2>
						<a class="ems-small" href="/ems/inbox/{u.id}">Open in inbox</a>
					</div>
					{#if data.thread.length > 0}
						<div class="ems-thread">
							{#each data.thread as m (m.id)}
								<div class={['ems-bubble', m.fromStaff && 'ems-bubble-staff']}>
									<p>{m.body}</p>
									<small title={fullDate(m.createdAt)}>
										{m.fromStaff
											? m.broadcast
												? 'Broadcast'
												: (m.senderName ?? 'Staff')
											: u.displayName}, {ago(m.createdAt)}
									</small>
								</div>
							{/each}
						</div>
					{/if}
					<form class="ems-form" method="POST" action="?/message" use:enhance>
						<textarea
							class="ems-textarea"
							name="body"
							maxlength="4000"
							placeholder="Write to {u.displayName}…"
							aria-label="Message"></textarea>
						{#if form && 'messageError' in form}<span class="ems-flash ems-flash-error"
								>{form.messageError}</span
							>{/if}
						<div class="ems-actions">
							<button class="ems-btn ems-btn-primary" type="submit">Send message</button>
							{#if form && 'messageSent' in form}<span class="ems-small ems-muted" role="status"
									>Sent</span
								>{/if}
						</div>
					</form>
				</section>
			{/if}

			<section class="ems-section" aria-labelledby="games">
				<div class="ems-section-head">
					<h2 id="games">Games</h2>
					<span class="ems-small ems-muted"
						>{p.stats.played} finished, {p.stats.completed} completed</span
					>
				</div>
				{#if p.plays.length === 0}
					<p class="ems-panel ems-empty">No finished games yet.</p>
				{:else}
					<ul class="ems-rows">
						{#each p.plays as play (play.id)}
							<li class="ems-row play-row">
								<span class="ems-row-main">
									<span class="ems-row-title">
										{play.title}
										{#if play.completed}<span class="ems-chip ems-chip-ok">Completed</span>{/if}
										{#if play.rejected}<span
												class="ems-chip ems-chip-warn"
												title="The result failed the server's checks">Rejected</span
											>{/if}
									</span>
									<span class="ems-row-sub">{play.details}</span>
								</span>
								<span class="ems-row-meta">{ago(play.finishedAt)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="ems-section" aria-labelledby="activity">
				<h2 id="activity">Activity</h2>
				{#if p.activity.length === 0}
					<p class="ems-panel ems-empty">Nothing yet.</p>
				{:else}
					<ul class="ems-rows">
						{#each p.activity as a (a.id)}
							<li class="ems-row play-row">
								<span class="ems-row-sub feed">{describeActivity(a.kind, a.data)}</span>
								<span class="ems-row-meta" title={fullDate(a.createdAt)}>{ago(a.createdAt)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>
	</div>
</div>

<style>
	.ems-head h1 {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
	}

	.star.on {
		color: var(--ems-fav);
	}

	.person-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
		align-items: start;
		gap: 1.75rem;
	}

	.col {
		display: grid;
		gap: 1.75rem;
	}

	.handle-row,
	.play-row {
		grid-template-columns: minmax(0, 1fr) auto;
	}

	.handle-row form {
		margin: 0;
	}

	.ems-chips form {
		margin: 0;
	}

	.note {
		display: grid;
		gap: 0.35rem;
		padding: 0.7rem 1rem;
	}

	.note p {
		margin: 0;
		white-space: pre-wrap;
	}

	.note form {
		margin: 0;
	}

	.feed {
		white-space: normal;
		color: var(--ems-text);
	}

	.ems-flash p {
		margin: 0 0 0.35rem;
	}

	@media (max-width: 1100px) {
		.person-grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
