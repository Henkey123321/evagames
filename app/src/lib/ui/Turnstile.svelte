<script lang="ts">
	// Cloudflare Turnstile widget. Renders nothing when no site key is configured.
	// Adds a hidden `cf-turnstile-response` input to the enclosing form.
	import { onMount } from 'svelte';

	let { siteKey }: { siteKey: string } = $props();
	let container: HTMLDivElement | undefined = $state();

	type TurnstileApi = {
		render(el: HTMLElement, opts: Record<string, unknown>): string;
		remove(id: string): void;
	};
	const w = () => window as unknown as { turnstile?: TurnstileApi };

	function loadScript(): Promise<void> {
		if (w().turnstile) return Promise.resolve();
		return new Promise((resolve, reject) => {
			const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile]');
			const script = existing ?? document.createElement('script');
			script.addEventListener('load', () => resolve(), { once: true });
			script.addEventListener('error', () => reject(new Error('Turnstile failed to load')), {
				once: true
			});
			if (!existing) {
				script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
				script.async = true;
				script.dataset.turnstile = '';
				document.head.appendChild(script);
			}
		});
	}

	onMount(() => {
		if (!siteKey) return;
		let widgetId: string | undefined;
		let cancelled = false;
		loadScript().then(() => {
			if (!cancelled && container)
				widgetId = w().turnstile!.render(container, { sitekey: siteKey, theme: 'light' });
		});
		return () => {
			cancelled = true;
			if (widgetId) w().turnstile?.remove(widgetId);
		};
	});
</script>

{#if siteKey}<div bind:this={container}></div>{/if}
