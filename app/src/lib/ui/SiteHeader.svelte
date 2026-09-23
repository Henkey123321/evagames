<script lang="ts">
	import type { SessionUser } from '$lib/types';

	let {
		user,
		mainSiteUrl,
		isHome = false,
		unread = 0
	}: {
		user: SessionUser | null;
		mainSiteUrl: string;
		isHome?: boolean;
		unread?: number;
	} = $props();

	const staff = $derived(user?.role === 'owner' || user?.role === 'staff');
</script>

<nav class="utility-bar" aria-label="Site">
	<div class="utility-group">
		<a class="utility-link" href={mainSiteUrl}>← evadevil.com</a>
	</div>
	<div class="utility-group">
		{#if user}
			{#if staff}
				<a class="utility-link" href="/ems">EMS</a>
			{:else}
				<a
					class="utility-link"
					href="/inbox"
					aria-label={unread ? `Inbox, ${unread} unread` : 'Inbox'}
				>
					Inbox{#if unread}<span class="utility-count">{unread}</span>{/if}
				</a>
			{/if}
			<a class="utility-link utility-link-strong" href="/account">{user.displayName}</a>
		{:else}
			<a class="utility-link" href="/login">Sign in</a>
			<a class="utility-link utility-link-strong" href="/signup">Join</a>
		{/if}
	</div>
</nav>

<header class={['site-header', !isHome && 'site-header-compact']} aria-label="Site header">
	<a class="brand-mark" href="/" aria-current={isHome ? 'page' : undefined}>Eva Games</a>
</header>
