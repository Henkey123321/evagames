<script lang="ts">
	import { enhance } from '$app/forms';
	import { ago, plural } from '$lib/format';
	import LocalTime from '$lib/ui/LocalTime.svelte';

	let { data, form } = $props();
	const d = $derived(data.detail);
	const a = $derived(d.a);
	let deadlineLocal = $state('');
	let confirmCancel = $state(false);
	const deadlineIso = $derived(deadlineLocal ? new Date(deadlineLocal).toISOString() : '');

	const STATUS: Record<string, string> = {
		sent: 'Not started',
		in_progress: 'Playing',
		completed: 'Completed',
		failed: 'Out of attempts',
		expired: 'Missed the deadline',
		cancelled: 'Cancelled'
	};
</script>

<svelte:head><title>{a.title} | Sent games | EMS</title></svelte:head>

<div class="ems-page">
	<header class="ems-head">
		<div>
			<p class="ems-small"><a href="/ems/sent">Sent games</a></p>
			<h1>{a.title}</h1>
			<p>{d.preset.title}, sent {ago(a.createdAt)}.</p>
		</div>
	</header>

	{#if data.justSent !== null}
		<p class="ems-flash" role="status">
			Sent to {plural(Number(data.justSent), 'fan')}. They have a message from you with the link.
		</p>
	{/if}
	{#if form?.error}<p class="ems-flash ems-flash-error" role="alert">{form.error}</p>{/if}

	<section class="ems-panel ems-panel-pad facts">
		{#if a.message}<p class="message">"{a.message}"</p>{/if}
		<ul class="ems-chips">
			{#each d.targets as t (t)}<li class="ems-chip">{t}</li>{/each}
			<li class="ems-chip">
				{a.maxAttempts ? plural(a.maxAttempts, 'attempt') : 'Unlimited attempts'}
			</li>
			<li class="ems-chip">
				{#if a.deadline}Deadline <LocalTime value={a.deadline} />{:else}No deadline{/if}
			</li>
			{#if a.points}<li class="ems-chip">{a.points} points</li>{/if}
			{#if d.rewardName}<li class="ems-chip">Reward: {d.rewardName}</li>{/if}
			{#if a.cancelledAt}<li class="ems-chip ems-chip-warn">Cancelled {ago(a.cancelledAt)}</li>{/if}
		</ul>
		<p class="ems-small ems-muted">
			Link: <a href="/play/{d.preset.slug}?a={a.id}" target="_blank" rel="noopener"
				>/play/{d.preset.slug}?a={a.id}</a
			>
			(only works for the fans it was sent to)
		</p>
	</section>

	<section class="ems-section" aria-labelledby="fans">
		<h2 id="fans">Fans</h2>
		{#if d.recipients.length === 0}
			<p class="ems-panel ems-empty">Nobody received this. The list may have been empty.</p>
		{:else}
			<ul class="ems-rows">
				{#each d.recipients as r (r.userId)}
					<li class="ems-row fan-row">
						<span
							class={['ems-dot', r.status !== 'completed' && 'ems-dot-quiet']}
							aria-hidden="true"
						></span>
						<span class="ems-row-main">
							<a class="ems-row-title" href="/ems/people/{r.userId}">{r.displayName}</a>
							<span class="ems-row-sub">
								{STATUS[r.status] ?? r.status}{r.attemptsUsed
									? `, ${plural(r.attemptsUsed, 'attempt')}`
									: ''}{r.best ? `, best ${r.best}` : ''}
							</span>
						</span>
						<span class="ems-row-meta">{ago(r.completedAt ?? r.updatedAt)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if !a.cancelledAt}
		<section class="ems-section" aria-labelledby="change">
			<h2 id="change">Change</h2>
			<div class="ems-panel ems-panel-pad ems-form">
				<form class="ems-toolbar" method="POST" action="?/deadline" use:enhance>
					<input
						class="ems-input"
						type="datetime-local"
						bind:value={deadlineLocal}
						aria-label="New deadline"
					/>
					<input type="hidden" name="deadlineIso" value={deadlineIso} />
					<button class="ems-btn ems-btn-small" type="submit"
						>{deadlineLocal ? 'Set deadline' : 'Remove deadline'}</button
					>
					{#if form && 'saved' in form}<span class="ems-small ems-muted" role="status">Saved</span
						>{/if}
				</form>
				<div class="ems-actions">
					{#if confirmCancel}
						<form method="POST" action="?/cancel" use:enhance>
							<button class="ems-btn ems-btn-small ems-btn-danger" type="submit"
								>Cancel for everyone who hasn't finished</button
							>
						</form>
						<button
							class="ems-btn ems-btn-small"
							type="button"
							onclick={() => (confirmCancel = false)}>Keep it</button
						>
					{:else}
						<button
							class="ems-btn ems-btn-small"
							type="button"
							onclick={() => (confirmCancel = true)}>Cancel this game</button
						>
					{/if}
				</div>
			</div>
		</section>
	{/if}
</div>

<style>
	.facts {
		display: grid;
		gap: 0.6rem;
	}

	.facts ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.message {
		margin: 0;
		font-weight: 650;
		white-space: pre-wrap;
	}

	.fan-row .ems-row-title {
		text-decoration: none;
	}
</style>
