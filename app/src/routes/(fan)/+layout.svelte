<script lang="ts">
	import { page } from '$app/state';
	import SiteHeader from '$lib/ui/SiteHeader.svelte';
	import Footer from '$lib/ui/Footer.svelte';

	let { data, children } = $props();
</script>

<a class="skip-link" href="#main">Skip to content</a>

<div class="page-shell">
	<SiteHeader
		user={data.user}
		mainSiteUrl={data.settings.mainSiteUrl}
		isHome={page.url.pathname === '/'}
	/>

	<main id="main">
		{@render children()}
	</main>

	<Footer links={data.footerLinks} mainSiteUrl={data.settings.mainSiteUrl} />
</div>
