<script lang="ts">
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { ago } from '$lib/format';

	let { data, children } = $props();

	const activeId = $derived(page.params.userId ?? null);
	const onIndex = $derived(page.url.pathname === '/ems/inbox');
	const filterHref = (unread: boolean) => (unread ? '?show=unread' : '?');

	onMount(() => {
		const timer = setInterval(() => {
			if (document.visibilityState === 'visible') invalidate('ems:inbox');
		}, 20_000);
		return () => clearInterval(timer);
	});
</script>

<div class="ems-page">
	<header class="ems-head">
		<div>
			<h1>Inbox</h1>
			<p>One conversation per fan. Favourites stay on top.</p>
		</div>
		<a class="ems-btn" href="/ems/inbox/broadcast">New broadcast</a>
	</header>

	<div class="ems-split ems-split-wide inbox" class:on-index={onIndex}>
		<section class="ems-section convo-pane" aria-label="Conversations">
			<div class="ems-actions ems-small">
				<a href={filterHref(false)} aria-current={!data.unreadOnly ? 'true' : undefined}>All</a>
				<a href={filterHref(true)} aria-current={data.unreadOnly ? 'true' : undefined}>Unread</a>
			</div>
			{#if data.conversations.length === 0}
				<p class="ems-panel ems-empty">
					{data.unreadOnly
						? 'All caught up.'
						: 'No conversations yet. Message a fan from their People page, or send a broadcast.'}
				</p>
			{:else}
				<ul class="ems-rows">
					{#each data.conversations as c (c.userId)}
						<li>
							<a
								class="ems-row convo"
								href="/ems/inbox/{c.userId}{data.unreadOnly ? '?show=unread' : ''}"
								aria-current={activeId === c.userId ? 'page' : undefined}
							>
								<span
									class={['ems-dot', !c.unread && 'ems-dot-quiet']}
									aria-label={c.unread ? `${c.unread} unread` : undefined}
								></span>
								<span class="ems-row-main">
									<span class="ems-row-title">
										{#if c.favorite}<span class="star" aria-label="Favourite">★</span>{/if}
										{c.displayName}
									</span>
									<span class="ems-row-sub">{c.lastFromStaff ? 'You: ' : ''}{c.preview}</span>
								</span>
								<span class="ems-row-meta">{ago(c.lastMessageAt)}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<div class="thread-pane">
			{@render children()}
		</div>
	</div>
</div>

<style>
	.ems-actions a {
		text-decoration: none;
		color: var(--ems-muted);
	}

	.ems-actions a[aria-current='true'] {
		font-weight: 800;
		color: var(--ems-accent);
		text-decoration: underline;
		text-underline-offset: 0.25em;
	}

	.convo[aria-current='page'] {
		box-shadow: inset 3px 0 0 var(--ems-accent);
		background: var(--ems-hover);
	}

	.star {
		margin-right: 0.25rem;
		color: var(--ems-fav);
	}

	/* On narrow screens show either the list or the open thread, not both. */
	@media (max-width: 1100px) {
		.inbox:not(.on-index) .convo-pane {
			display: none;
		}

		.inbox.on-index .thread-pane {
			display: none;
		}
	}
</style>
