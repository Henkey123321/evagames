<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head><title>{page.status} | Eva Games</title></svelte:head>

<div class="page-shell">
	<header class="site-header site-header-compact">
		<a class="brand-mark" href="/">Eva Games</a>
	</header>
	<div class="content content-narrow">
		<p class="eyebrow">{page.status}</p>
		<h1 class="page-title">{page.status === 404 ? 'Not here.' : 'Something slipped.'}</h1>
		<p class="page-lede">
			{page.status === 404
				? 'That page does not exist.'
				: (page.error?.message ?? 'Please try again.')}
		</p>
		<a class="button" href="/">Back to the games</a>
	</div>
</div>
