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

	const SENT_STATUS: Record<string, string> = {
		sent: 'Not started',
		in_progress: 'Playing',
		completed: 'Completed',
		failed: 'Out of attempts',
		expired: 'Missed the deadline',
		cancelled: 'Cancelled'
	};

	const REWARD_STATUS: Record<string, string> = {
		pending_approval: 'Waiting for your approval',
		unlocked: 'Unlocked',
		awaiting_fulfilment: 'For you to send',
		submitted: 'Proof sent, to review',
		done: 'Done',
		declined: 'Declined'
	};

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

			{#if data.rewards}
				{@const rw = data.rewards}
				<section class="ems-section" aria-labelledby="earned">
					<div class="ems-section-head">
						<h2 id="earned">Points, badges and rewards</h2>
						<span class="points">{u.points} points</span>
					</div>
					{#if form && 'rewardError' in form}<p class="ems-flash ems-flash-error" role="alert">
							{form.rewardError}
						</p>{/if}
					{#if form && 'rewardDone' in form}<p class="ems-flash" role="status">
							{form.rewardDone}
						</p>{/if}

					<div class="ems-panel ems-panel-pad ems-form">
						<form class="ems-toolbar" method="POST" action="?/points" use:enhance>
							<input
								class="ems-input pts"
								type="number"
								name="delta"
								placeholder="+50 or -10"
								aria-label="Points to add or remove"
								required
							/>
							<input
								class="ems-input"
								name="note"
								maxlength="200"
								placeholder="Why (optional)"
								aria-label="Reason"
							/>
							<button class="ems-btn ems-btn-small" type="submit">Give points</button>
						</form>
						{#if rw.badges.length}
							<form class="ems-toolbar" method="POST" action="?/giveBadge" use:enhance>
								<select class="ems-select" name="badgeId" aria-label="Badge">
									{#each rw.badges as b (b.id)}<option value={b.id}>{b.mark} {b.name}</option
										>{/each}
								</select>
								<button class="ems-btn ems-btn-small" type="submit">Give badge</button>
							</form>
						{/if}
						{#if rw.library.length}
							<form class="ems-toolbar" method="POST" action="?/giveReward" use:enhance>
								<select class="ems-select" name="rewardId" aria-label="Reward">
									{#each rw.library as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
								</select>
								<button class="ems-btn ems-btn-small" type="submit">Give reward</button>
							</form>
						{:else}
							<p class="ems-small ems-muted">
								Create rewards on the <a href="/ems/rewards">Rewards</a> page to give them here.
							</p>
						{/if}
					</div>

					{#if rw.earned.length}
						<div class="ems-chips">
							{#each rw.earned as b (b.id)}<span class="ems-chip" title={b.description}
									>{b.mark} {b.name}</span
								>{/each}
						</div>
					{/if}

					{#if rw.granted.length}
						<ul class="ems-rows">
							{#each rw.granted as g (g.id)}
								<li class="ems-row play-row">
									<span class="ems-row-main">
										<span class="ems-row-title">{g.name}</span>
										<span class="ems-row-sub"
											>{REWARD_STATUS[g.status] ?? g.status}, {ago(g.createdAt)}</span
										>
									</span>
									{#if g.status === 'unlocked' && g.kind === 'task'}
										<form method="POST" action="?/markDone" use:enhance>
											<input type="hidden" name="userRewardId" value={g.id} />
											<button class="ems-btn ems-btn-small" type="submit">Mark task done</button>
										</form>
									{:else if ['pending_approval', 'submitted', 'awaiting_fulfilment'].includes(g.status)}
										<a class="ems-btn ems-btn-small" href="/ems/rewards">Open queue</a>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}

					{#if rw.history.length}
						<details class="ems-small">
							<summary>Points history</summary>
							<ul class="ems-rows history">
								{#each rw.history as h (h.id)}
									<li class="ems-row play-row">
										<span class="ems-row-sub feed"
											>{h.delta > 0 ? '+' : ''}{h.delta}{h.note ? `: ${h.note}` : ''}</span
										>
										<span class="ems-row-meta">{ago(h.createdAt)}</span>
									</li>
								{/each}
							</ul>
						</details>
					{/if}
				</section>
			{/if}

			{#if data.games}
				<section class="ems-section" aria-labelledby="sent-games">
					<h2 id="sent-games">Games you sent</h2>
					<form
						class="ems-panel ems-panel-pad ems-toolbar"
						method="GET"
						action="/ems/games/send-to"
					>
						<input type="hidden" name="to" value={u.id} />
						<select class="ems-select" name="game" aria-label="Game to send">
							{#each data.games.presets as g (g.id)}<option value={g.id}>{g.title}</option>{/each}
						</select>
						<button class="ems-btn ems-btn-small ems-btn-primary" type="submit"
							>Send to {u.displayName}</button
						>
					</form>
					{#if data.games.sent.length}
						<ul class="ems-rows">
							{#each data.games.sent as g (g.id)}
								<li>
									<a class="ems-row play-row" href="/ems/sent/{g.id}">
										<span class="ems-row-main">
											<span class="ems-row-title">{g.title}</span>
											<span class="ems-row-sub"
												>{SENT_STATUS[g.status] ?? g.status}{g.attemptsUsed
													? `, ${g.attemptsUsed} tries`
													: ''}</span
											>
										</span>
										<span class="ems-row-meta">{ago(g.createdAt)}</span>
									</a>
								</li>
							{/each}
						</ul>
					{/if}
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

	.points {
		font-weight: 850;
		color: var(--ems-accent);
	}

	.pts {
		max-width: 9rem;
	}

	.history {
		margin-top: 0.5rem;
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
