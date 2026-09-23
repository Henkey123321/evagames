<script lang="ts">
	import { refreshAfterRead } from '$lib/ui/ems/refresh';
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import { ago, fullDate } from '$lib/format';

	let { data, form } = $props();

	$effect(() => refreshAfterRead(data.justRead));
	let threadEl: HTMLDivElement | undefined = $state();
	let sending = $state(false);

	// Keep the newest message in view when the thread changes.
	$effect(() => {
		void data.messages.length;
		void data.fan.id;
		tick().then(() => threadEl?.scrollTo({ top: threadEl.scrollHeight }));
	});

	function submitOnCtrlEnter(event: KeyboardEvent) {
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			(event.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
		}
	}
</script>

<svelte:head><title>{data.fan.displayName} | Inbox | EMS</title></svelte:head>

<section class="ems-section" aria-labelledby="thread-heading">
	<div class="ems-section-head">
		<div>
			<a class="ems-small back" href="/ems/inbox">All conversations</a>
			<h2 id="thread-heading">
				{#if data.favorite}<span class="star" aria-label="Favourite">★</span>{/if}
				{data.fan.displayName}
			</h2>
			<span class="ems-small ems-muted">
				@{data.fan.username}{data.fan.onlyfansHandle ? `, OF @${data.fan.onlyfansHandle}` : ''}{data
					.fan.loyalfansHandle
					? `, LF @${data.fan.loyalfansHandle}`
					: ''}
			</span>
		</div>
		<a class="ems-btn ems-btn-small" href="/ems/people/{data.fan.id}">View profile</a>
	</div>

	{#if data.fan.disabledAt}
		<p class="ems-flash ems-flash-error">
			This account is disabled. They can't read new messages until it's enabled again.
		</p>
	{/if}

	<div class="ems-thread" bind:this={threadEl}>
		{#if data.messages.length === 0}
			<p class="ems-muted">No messages yet. Say hello.</p>
		{/if}
		{#each data.messages as m (m.id)}
			<div class={['ems-bubble', m.fromStaff && 'ems-bubble-staff']}>
				<p>{m.body}</p>
				<small title={fullDate(m.createdAt)}>
					{#if m.fromStaff}{m.broadcast ? 'Broadcast' : (m.senderName ?? 'Staff')}{:else}{data.fan
							.displayName}{/if},
					{ago(m.createdAt)}
				</small>
			</div>
		{/each}
	</div>

	<form
		class="ems-form"
		method="POST"
		use:enhance={() => {
			sending = true;
			return async ({ update }) => {
				await update();
				sending = false;
			};
		}}
	>
		<textarea
			class="ems-textarea"
			name="body"
			maxlength="4000"
			placeholder="Reply to {data.fan.displayName}…"
			aria-label="Reply"
			onkeydown={submitOnCtrlEnter}
			required></textarea>
		{#if form?.error}<span class="ems-flash ems-flash-error">{form.error}</span>{/if}
		<div class="ems-actions">
			<button class="ems-btn ems-btn-primary" type="submit" disabled={sending}
				>{sending ? 'Sending…' : 'Send'}</button
			>
			<span class="ems-small ems-muted"
				>Ctrl + Enter to send. They get a notification if they turned them on.</span
			>
		</div>
	</form>
</section>

<style>
	h2 {
		margin: 0.15rem 0 0;
		font-size: 1.25rem;
		font-weight: 850;
		letter-spacing: -0.02em;
	}

	.star {
		margin-right: 0.3rem;
		color: var(--ems-fav);
	}

	.back {
		display: none;
	}

	@media (max-width: 1100px) {
		.back {
			display: inline;
		}
	}
</style>
