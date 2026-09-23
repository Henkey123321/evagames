<script lang="ts">
	import { enhance } from '$app/forms';
	import { ago, plural } from '$lib/format';

	let { data, form } = $props();
	let confirming = $state(false);
	let target = $state('all');

	const targetLabel = $derived(
		target === 'all'
			? 'every fan'
			: `everyone in "${data.lists.find((l) => l.id === target)?.name ?? ''}"`
	);
</script>

<svelte:head><title>Broadcast | Inbox | EMS</title></svelte:head>

<section class="ems-section" aria-labelledby="broadcast-heading">
	<div>
		<a class="ems-small" href="/ems/inbox">All conversations</a>
		<h2 id="broadcast-heading">New broadcast</h2>
		<p class="ems-muted ems-small">
			The message lands in each fan's own conversation with you, so replies come back to your inbox.
		</p>
	</div>

	{#if form && 'sent' in form}
		<p class="ems-flash" role="status">
			{form.sent === 0
				? 'Nobody matched, so nothing was sent.'
				: `Sent to ${plural(form.sent ?? 0, 'fan')}.`}
		</p>
	{/if}
	{#if form && 'error' in form}<p class="ems-flash ems-flash-error" role="alert">
			{form.error}
		</p>{/if}

	<form
		class="ems-panel ems-panel-pad ems-form"
		method="POST"
		use:enhance={() =>
			async ({ update }) => {
				await update();
				confirming = false;
			}}
	>
		<label class="ems-field">
			<span class="ems-label">Send to</span>
			<select class="ems-select" name="target" bind:value={target}>
				<option value="all">Every fan</option>
				{#each data.lists as list (list.id)}
					<option value={list.id}>{list.name} ({list.members})</option>
				{/each}
			</select>
		</label>
		<label class="ems-field">
			<span class="ems-label">Message</span>
			<textarea class="ems-textarea" name="body" maxlength="4000" rows="5" required></textarea>
		</label>
		<div class="ems-actions">
			{#if confirming}
				<button class="ems-btn ems-btn-primary" type="submit">Send to {targetLabel}</button>
				<button class="ems-btn" type="button" onclick={() => (confirming = false)}>Not yet</button>
			{:else}
				<button class="ems-btn ems-btn-primary" type="button" onclick={() => (confirming = true)}
					>Review and send</button
				>
			{/if}
		</div>
		<p class="ems-small ems-muted">
			Broadcasts don't send phone notifications yet. Direct messages do.
		</p>
	</form>

	{#if data.recent.length > 0}
		<h2>Sent before</h2>
		<ul class="ems-rows">
			{#each data.recent as b (b.id)}
				<li class="ems-row recent">
					<span class="ems-row-main">
						<span class="ems-row-title"
							>To {b.targetLabel.toLowerCase() === 'everyone' ? 'everyone' : b.targetLabel}, {plural(
								b.recipientCount,
								'fan'
							)}</span
						>
						<span class="ems-row-sub">{b.body}</span>
					</span>
					<span class="ems-row-meta">{b.authorName ?? 'Staff'}, {ago(b.createdAt)}</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	h2 {
		margin: 0.15rem 0 0.2rem;
		font-size: 1.25rem;
		font-weight: 850;
		letter-spacing: -0.02em;
	}

	.recent {
		grid-template-columns: minmax(0, 1fr) auto;
	}
</style>
