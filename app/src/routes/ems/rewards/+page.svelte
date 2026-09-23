<script lang="ts">
	import { enhance } from '$app/forms';
	import { ago, plural } from '$lib/format';

	let { data, form } = $props();
	let replying: string | null = $state(null);

	const KIND_LABEL: Record<string, string> = {
		link: 'Link or code',
		task: 'Task',
		game: 'Game',
		manual: 'Something I send',
		media: 'Media'
	};
	const STATUS_LABEL: Record<string, string> = {
		pending_approval: 'Waiting for your approval',
		submitted: 'Proof to review',
		awaiting_fulfilment: 'For you to send'
	};
	const triggerText = (t: {
		type: string;
		threshold: number | null;
		presetTitle: string | null;
		badgeName: string | null;
	}) =>
		t.type === 'preset_completed'
			? `completes ${t.presetTitle ?? 'a game'}`
			: t.type === 'points_reached'
				? `reaches ${t.threshold} points`
				: `earns ${t.badgeName ?? 'a badge'}`;
	const handle = (q: { onlyfansHandle: string | null; loyalfansHandle: string | null }) =>
		[q.onlyfansHandle && `OF @${q.onlyfansHandle}`, q.loyalfansHandle && `LF @${q.loyalfansHandle}`]
			.filter(Boolean)
			.join(', ');
</script>

<svelte:head><title>Rewards | EMS</title></svelte:head>

<div class="ems-page">
	<header class="ems-head">
		<div>
			<h1>Rewards</h1>
			<p>What fans have earned, and what they can earn.</p>
		</div>
		<div class="ems-actions">
			<a class="ems-btn" href="/ems/rewards/badges">Badges</a>
			<a class="ems-btn ems-btn-primary" href="/ems/rewards/new">New reward</a>
		</div>
	</header>

	<nav class="ems-actions tabs" aria-label="Rewards views">
		<a href="?view=queue" aria-current={data.view === 'queue' ? 'page' : undefined}>
			Needs you{data.queue.length ? ` (${data.queue.length})` : ''}
		</a>
		<a href="?view=library" aria-current={data.view === 'library' ? 'page' : undefined}
			>All rewards ({data.library.length})</a
		>
	</nav>

	{#if form && 'error' in form}<p class="ems-flash ems-flash-error" role="alert">
			{form.error}
		</p>{/if}

	{#if data.view === 'queue'}
		{#if data.queue.length === 0}
			<p class="ems-panel ems-empty">
				Nothing waiting. Rewards that need your approval, proof to check, or things to send show up
				here.
			</p>
		{:else}
			<ul class="ems-rows">
				{#each data.queue as q (q.id)}
					<li class="item">
						<div class="item-head">
							<span class="ems-row-main">
								<span class="ems-row-title">
									<a href="/ems/people/{q.userId}">{q.displayName}</a>: {q.rewardName}
								</span>
								<span class="ems-row-sub">
									{STATUS_LABEL[q.status]}, {ago(q.updatedAt)}{handle(q) ? `. ${handle(q)}` : ''}
								</span>
							</span>
						</div>

						{#if q.status === 'submitted' && q.proofText}
							<blockquote>{q.proofText}</blockquote>
						{/if}
						{#if q.status === 'awaiting_fulfilment' && q.content?.staffNote}
							<p class="ems-small">To send: {q.content.staffNote}</p>
						{/if}

						<form
							class="ems-actions"
							method="POST"
							action="?/resolve"
							use:enhance={() =>
								async ({ update }) => {
									await update();
									replying = null;
								}}
						>
							<input type="hidden" name="id" value={q.id} />
							{#if q.status === 'pending_approval'}
								<button
									class="ems-btn ems-btn-small ems-btn-primary"
									name="decision"
									value="approve">Approve</button
								>
								{#if replying === q.id}
									<input
										class="ems-input reply"
										name="reply"
										maxlength="1000"
										placeholder="Why (optional, the fan sees this)"
									/>
									<button
										class="ems-btn ems-btn-small ems-btn-danger"
										name="decision"
										value="decline">Decline</button
									>
								{:else}
									<button
										class="ems-btn ems-btn-small"
										type="button"
										onclick={() => (replying = q.id)}>Decline…</button
									>
								{/if}
							{:else if q.status === 'submitted'}
								<button
									class="ems-btn ems-btn-small ems-btn-primary"
									name="decision"
									value="accept_proof">Accept</button
								>
								{#if replying === q.id}
									<input
										class="ems-input reply"
										name="reply"
										maxlength="1000"
										placeholder="What to redo (the fan sees this)"
									/>
									<button class="ems-btn ems-btn-small" name="decision" value="reject_proof"
										>Send back</button
									>
								{:else}
									<button
										class="ems-btn ems-btn-small"
										type="button"
										onclick={() => (replying = q.id)}>Send back…</button
									>
								{/if}
							{:else if q.status === 'awaiting_fulfilment'}
								<button class="ems-btn ems-btn-small ems-btn-primary" name="decision" value="fulfil"
									>Mark as sent</button
								>
							{/if}
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	{:else if data.library.length === 0}
		<p class="ems-panel ems-empty">
			No rewards yet. <a href="/ems/rewards/new">Create the first one</a>.
		</p>
	{:else}
		<ul class="ems-rows">
			{#each data.library as r (r.id)}
				<li>
					<a class="ems-row lib" href="/ems/rewards/{r.id}">
						<span class="ems-row-main">
							<span class="ems-row-title">
								{r.name}
								<span class="ems-chip">{KIND_LABEL[r.kind]}</span>
								{#if r.requiresApproval}<span class="ems-chip">You approve</span>{/if}
							</span>
							<span class="ems-row-sub">
								{r.triggers.length
									? `Unlocks when a fan ${r.triggers.map(triggerText).join(', or ')}`
									: 'Only given by hand'}
							</span>
						</span>
						<span class="ems-row-meta">{plural(r.granted, 'fan')}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.tabs a {
		padding: 0.3rem 0;
		font-weight: 650;
		text-decoration: none;
		color: var(--ems-muted);
	}

	.tabs a + a {
		margin-left: 1rem;
	}

	.tabs a[aria-current='page'] {
		font-weight: 800;
		color: var(--ems-accent);
		box-shadow: inset 0 -2px 0 var(--ems-accent);
	}

	.item {
		display: grid;
		gap: 0.6rem;
		padding: 0.8rem 1rem;
	}

	.item form {
		margin: 0;
	}

	.item .ems-row-title {
		white-space: normal;
	}

	blockquote {
		margin: 0;
		padding: 0.6rem 0.8rem;
		border-left: 3px solid var(--ems-line-strong);
		white-space: pre-wrap;
		background: var(--ems-bg);
	}

	.reply {
		width: auto;
		flex: 1 1 16rem;
	}

	.lib {
		grid-template-columns: minmax(0, 1fr) auto;
	}

	.lib .ems-row-title {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}
</style>
