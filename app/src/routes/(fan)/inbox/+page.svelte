<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import { ago, fullDate } from '$lib/format';

	let { data, form } = $props();

	/** Turns site links (/play/…) and https:// links in messages into clickable links. */
	function linkify(text: string) {
		const parts: { text: string; href?: string }[] = [];
		const re = /(https:\/\/[^\s]+|\/(?:play|vault|inbox)\/?[^\s]*)/g;
		let last = 0;
		for (const m of text.matchAll(re)) {
			if (m.index! > last) parts.push({ text: text.slice(last, m.index) });
			parts.push({ text: m[0], href: m[0] });
			last = m.index! + m[0].length;
		}
		if (last < text.length) parts.push({ text: text.slice(last) });
		return parts;
	}
	let threadEl: HTMLDivElement | undefined = $state();
	let sending = $state(false);

	$effect(() => {
		void data.messages.length;
		tick().then(() => threadEl?.scrollTo({ top: threadEl.scrollHeight }));
	});

	onMount(() => {
		const timer = setInterval(() => {
			if (document.visibilityState === 'visible') invalidate('fan:inbox');
		}, 30_000);
		return () => clearInterval(timer);
	});
</script>

<svelte:head><title>Inbox | Eva Games</title></svelte:head>

<div class="content">
	<h1 class="page-title">Inbox</h1>
	<p class="page-lede">
		Messages between you and Eva. Only the two of you (and her staff) can see them.
	</p>

	<div class="thread" bind:this={threadEl}>
		{#if data.messages.length === 0}
			<p class="empty">
				No messages yet. When Eva writes to you, it appears here. You can write first too.
			</p>
		{/if}
		{#each data.messages as m (m.id)}
			<div class={['bubble', m.fromEva ? 'bubble-eva' : 'bubble-me']}>
				<p>
					{#each linkify(m.body) as part, i (i)}{#if part.href}<a href={part.href}>{part.text}</a
							>{:else}{part.text}{/if}{/each}
				</p>
				<small title={fullDate(m.createdAt)}>{m.fromEva ? 'Eva' : 'You'}, {ago(m.createdAt)}</small>
			</div>
		{/each}
	</div>

	<form
		class="panel form"
		method="POST"
		use:enhance={() => {
			sending = true;
			return async ({ update }) => {
				await update();
				sending = false;
			};
		}}
	>
		<label class="field">
			<span class="field-label">Message Eva</span>
			<textarea class="input message" name="body" maxlength="4000" rows="4" required></textarea>
		</label>
		{#if form?.error}<p class="field-error" role="alert">{form.error}</p>{/if}
		<div class="form-actions">
			<button class="button" type="submit" disabled={sending}
				>{sending ? 'Sending…' : 'Send'}</button
			>
			{#if form && 'sent' in form}<span class="badge" role="status">Sent</span>{/if}
		</div>
	</form>
</div>

<style>
	.thread {
		display: grid;
		gap: 0.75rem;
		max-height: 60vh;
		padding: clamp(0.75rem, 3vw, 1.25rem);
		overflow-y: auto;
		border: 1px solid var(--line);
		border-bottom: 0;
		background: var(--panel);
	}

	.empty {
		margin: 0;
		font-weight: 700;
		color: var(--ink-soft);
	}

	.bubble {
		display: grid;
		gap: 0.25rem;
		max-width: min(32rem, 88%);
	}

	.bubble p {
		margin: 0;
		padding: 0.65rem 0.85rem;
		border: 1px solid var(--line);
		font-weight: 600;
		line-height: 1.45;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.bubble small {
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--ink-soft);
	}

	.bubble-eva a {
		color: inherit;
		font-weight: 850;
		text-underline-offset: 0.2em;
	}

	.bubble-eva p {
		color: var(--field);
		border-color: var(--eva-red);
		background: var(--eva-red);
	}

	.bubble-me {
		justify-self: end;
		text-align: right;
	}

	.bubble-me p {
		text-align: left;
		background: oklch(97% 0.012 336);
	}

	.message {
		min-height: 6rem;
		resize: vertical;
	}
</style>
