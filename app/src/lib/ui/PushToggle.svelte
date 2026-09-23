<script lang="ts">
	// Opt-in browser push. Needs the service worker (src/service-worker.ts) and a VAPID public key.
	import { onMount } from 'svelte';

	let { vapidPublicKey }: { vapidPublicKey: string } = $props();

	type Status = 'loading' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on' | 'error';
	let status: Status = $state('loading');
	let busy = $state(false);
	let testMessage = $state('');

	function keyBytes(base64url: string) {
		const base64 = base64url
			.replace(/-/g, '+')
			.replace(/_/g, '/')
			.padEnd(Math.ceil(base64url.length / 4) * 4, '=');
		return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
	}

	async function registration() {
		return navigator.serviceWorker.ready;
	}

	onMount(async () => {
		if (!vapidPublicKey || !('serviceWorker' in navigator) || !('PushManager' in window)) {
			const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
			const standalone = window.matchMedia('(display-mode: standalone)').matches;
			status = ios && !standalone ? 'ios-install' : 'unsupported';
			return;
		}
		if (Notification.permission === 'denied') {
			status = 'denied';
			return;
		}
		const sub = await (await registration()).pushManager.getSubscription();
		status = sub ? 'on' : 'off';
	});

	async function enable() {
		busy = true;
		try {
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				status = permission === 'denied' ? 'denied' : 'off';
				return;
			}
			const reg = await registration();
			const sub =
				(await reg.pushManager.getSubscription()) ??
				(await reg.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: keyBytes(vapidPublicKey) as BufferSource
				}));
			const res = await fetch('/api/push/subscribe', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(sub.toJSON())
			});
			status = res.ok ? 'on' : 'error';
		} catch {
			status = 'error';
		} finally {
			busy = false;
		}
	}

	async function disable() {
		busy = true;
		try {
			const sub = await (await registration()).pushManager.getSubscription();
			if (sub) {
				await fetch('/api/push/subscribe', {
					method: 'DELETE',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ endpoint: sub.endpoint })
				});
				await sub.unsubscribe();
			}
			status = 'off';
		} finally {
			busy = false;
		}
	}

	async function test() {
		testMessage = '';
		const res = await fetch('/api/push/test', { method: 'POST' });
		const data = res.ok ? ((await res.json()) as { sent: number }) : null;
		testMessage = data?.sent
			? 'Sent. It should arrive in a moment.'
			: 'Could not send a test right now.';
	}
</script>

<div class="field">
	{#if status === 'loading'}
		<p class="field-hint">Checking this browser…</p>
	{:else if status === 'unsupported'}
		<p class="field-hint">This browser does not support notifications.</p>
	{:else if status === 'ios-install'}
		<p class="field-hint">
			On iPhone and iPad, add Eva Games to your Home Screen first (Share → Add to Home Screen), then
			open it from there to turn on notifications.
		</p>
	{:else if status === 'denied'}
		<p class="field-hint">
			Notifications are blocked for this site. Allow them in your browser settings to turn them on.
		</p>
	{:else}
		<p class="field-hint">
			Get a notification on this device when Eva messages you, sends you a game or unlocks a reward.
		</p>
		<div class="form-actions">
			{#if status === 'on'}
				<span class="badge badge-strong">On for this device</span>
				<button class="button button-quiet" type="button" onclick={test} disabled={busy}
					>Send test</button
				>
				<button class="button button-quiet" type="button" onclick={disable} disabled={busy}
					>Turn off</button
				>
			{:else}
				<button class="button" type="button" onclick={enable} disabled={busy}
					>Turn on notifications</button
				>
			{/if}
		</div>
		{#if status === 'error'}<p class="field-error">Something went wrong. Try again.</p>{/if}
		{#if testMessage}<p class="field-hint" aria-live="polite">{testMessage}</p>{/if}
	{/if}
</div>
