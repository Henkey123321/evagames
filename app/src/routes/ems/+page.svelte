<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>EMS | Eva Games</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page-shell">
	<nav class="utility-bar" aria-label="EMS">
		<div class="utility-group"><a class="utility-link" href="/">← Site</a></div>
		<div class="utility-group">
			<a class="utility-link utility-link-strong" href="/account">{data.user.displayName}</a>
		</div>
	</nav>

	<div class="content">
		<p class="eyebrow">Eva Management System</p>
		<h1 class="page-title">Hello, {data.user.displayName}.</h1>
		<p class="page-lede">
			The full EMS (people, lists, favourites, inbox, games, rewards and analytics) arrives in the
			next phase. For now, the numbers.
		</p>

		<div class="scorebar">
			{#each data.stats as stat (stat.label)}
				<div class="scorebox"><span>{stat.label}</span><strong>{stat.value}</strong></div>
			{/each}
		</div>
	</div>
</div>
