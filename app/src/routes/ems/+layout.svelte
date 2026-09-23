<script lang="ts">
	import '$lib/styles/ems.css';
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';

	let { data, children } = $props();

	const nav = $derived(
		[
			{ href: '/ems', label: 'Home', show: true, exact: true },
			{ href: '/ems/people', label: 'People', show: data.access.people, count: 0 },
			{ href: '/ems/inbox', label: 'Inbox', show: data.access.messages, count: data.counts.unread },
			{
				href: '/ems/rewards',
				label: 'Rewards',
				show: data.access.rewards,
				count: data.counts.rewardQueue
			},
			{ href: '/ems/site', label: 'Site', show: data.access.site },
			{ href: '/ems/staff', label: 'Staff', show: data.access.staff }
		].filter((item) => item.show)
	);

	const isCurrent = (href: string, exact = false) =>
		exact ? page.url.pathname === href : page.url.pathname.startsWith(href);

	// Keep unread counts fresh while the EMS is open and visible.
	onMount(() => {
		const timer = setInterval(() => {
			if (document.visibilityState === 'visible') invalidate('ems:counts');
		}, 30_000);
		return () => clearInterval(timer);
	});
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="ems">
	<aside class="ems-rail">
		<a class="ems-signature" href="/ems" aria-label="EMS home">
			<span class="ems-signature-name">Eva</span>
			<span class="ems-signature-sub">Management</span>
		</a>

		<nav class="ems-nav" aria-label="EMS">
			{#each nav as item (item.href)}
				<a href={item.href} aria-current={isCurrent(item.href, item.exact) ? 'page' : undefined}>
					<span>{item.label}</span>
					{#if item.count}<span class="ems-count">{item.count}</span>{/if}
				</a>
			{/each}
		</nav>

		<div class="ems-rail-foot">
			<span>Signed in as {data.user.displayName}</span>
			<a href="/">View the site</a>
			<a href="/account">Your account</a>
			<form method="POST" action="/logout">
				<button class="ems-link-button" type="submit">Sign out</button>
			</form>
		</div>
	</aside>

	<main class="ems-main" id="main">
		{@render children()}
	</main>
</div>
