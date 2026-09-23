<script lang="ts">
	interface FooterLink {
		id: string;
		label: string;
		url: string;
		icon: string;
		extraClass: string;
	}

	let {
		links,
		mainSiteUrl
	}: { links: { store: FooterLink[]; social: FooterLink[] }; mainSiteUrl: string } = $props();

	const year = new Date().getFullYear();
</script>

{#snippet link(l: FooterLink, kind: 'adult' | 'social')}
	<a
		class={['footer-link', `footer-link-${kind}`, l.extraClass]}
		href={l.url}
		target="_blank"
		rel="noopener noreferrer"
		aria-label={l.label}
	>
		<img class="footer-icon" src={l.icon} alt="" aria-hidden="true" />
	</a>
{/snippet}

<footer class="site-footer">
	<div class="footer-identity">
		<span class="footer-copyright" aria-label="Copyright">©</span>
		<div class="footer-brand-lockup">
			<a
				class="footer-brand"
				href={mainSiteUrl}
				rel="noopener"
				aria-label="Visit Eva de Vil main site">Eva de Vil</a
			>
			<span class="footer-year">{year}</span>
		</div>
	</div>
	<nav class="footer-links" aria-label="Eva de Vil links">
		<div class="footer-link-group" aria-label="Creator stores">
			{#each links.store as l (l.id)}{@render link(l, 'adult')}{/each}
		</div>
		<div class="footer-link-group footer-link-group-social" aria-label="Social profiles">
			{#each links.social as l (l.id)}{@render link(l, 'social')}{/each}
		</div>
	</nav>
</footer>
