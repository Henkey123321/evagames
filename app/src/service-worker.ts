/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Push notifications only. Deliberately no offline caching: the game media is large
// and should come from the HTTP cache, not a service-worker cache.

const sw = self as unknown as ServiceWorkerGlobalScope;

interface PushPayload {
	title?: string;
	body?: string;
	url?: string;
	tag?: string;
}

sw.addEventListener('install', () => {
	void sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(sw.clients.claim());
});

sw.addEventListener('push', (event) => {
	let data: PushPayload = {};
	try {
		data = event.data?.json() ?? {};
	} catch {
		data = { body: event.data?.text() };
	}
	event.waitUntil(
		sw.registration.showNotification(data.title ?? 'Eva Games', {
			body: data.body ?? '',
			tag: data.tag,
			icon: '/favicon-192.png',
			badge: '/favicon-192.png',
			data: { url: data.url ?? '/' }
		})
	);
});

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = new URL(
		(event.notification.data as { url?: string })?.url ?? '/',
		sw.location.origin
	).href;
	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
			const existing = windows.find((w) => w.url.startsWith(sw.location.origin));
			if (existing) return existing.navigate(target).then((w) => w?.focus());
			return sw.clients.openWindow(target);
		})
	);
});
