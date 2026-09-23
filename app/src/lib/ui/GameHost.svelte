<script lang="ts">
	// Mounts a game plugin and bridges its play session to the /api/play endpoints.
	import { onMount } from 'svelte';
	import { gameClients } from '$lib/games/clients';
	import type { FinishResponse, GameStorage, PlaySession } from '$lib/games/sdk/types';

	let {
		slug,
		type,
		config,
		signedIn
	}: { slug: string; type: string; config: unknown; signedIn: boolean } = $props();

	let container: HTMLDivElement | undefined = $state();
	let loadError = $state(false);
	let lastResult: FinishResponse | null = $state(null);

	function createStorage(legacy: Record<string, string> = {}): GameStorage {
		const key = (k: string) => `eva:${slug}:${k}`;
		return {
			get<T>(k: string): T | null {
				try {
					const raw =
						localStorage.getItem(key(k)) ?? (legacy[k] ? localStorage.getItem(legacy[k]) : null);
					return raw === null ? null : (JSON.parse(raw) as T);
				} catch {
					return null;
				}
			},
			set(k, value) {
				try {
					localStorage.setItem(key(k), JSON.stringify(value));
				} catch {
					/* Storage full or blocked: the game still works, it just won't remember. */
				}
			},
			remove(k) {
				try {
					localStorage.removeItem(key(k));
				} catch {
					/* ignore */
				}
			}
		};
	}

	function createSession(): PlaySession<unknown> {
		let playId: Promise<string | null> | null = null;

		return {
			begin() {
				if (playId) return;
				lastResult = null;
				playId = fetch('/api/play/start', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ slug })
				})
					.then((r) => (r.ok ? (r.json() as Promise<{ playId: string }>) : null))
					.then((d) => d?.playId ?? null)
					.catch(() => null);
			},
			async finish(result) {
				const id = await playId;
				playId = null;
				if (!id) return null;
				try {
					const res = await fetch(`/api/play/${id}/finish`, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ result })
					});
					if (!res.ok) return null;
					lastResult = (await res.json()) as FinishResponse;
					return lastResult;
				} catch {
					return null;
				}
			},
			reset() {
				playId = null;
				lastResult = null;
			}
		};
	}

	onMount(() => {
		let destroyed = false;
		let mounted: { destroy(): void } | undefined;
		const load = gameClients[type];
		if (!load) {
			loadError = true;
			return;
		}
		load()
			.then((client) => {
				if (destroyed || !container) return;
				mounted = client.mount(container, {
					config,
					session: createSession(),
					storage: createStorage(client.legacyStorage)
				});
			})
			.catch(() => (loadError = true));

		return () => {
			destroyed = true;
			mounted?.destroy();
		};
	});
</script>

{#if loadError}
	<p class="notice notice-error">This game could not be loaded. Refresh the page to try again.</p>
{/if}
<div bind:this={container} class="game-container"></div>

<div class="game-result" aria-live="polite">
	{#if lastResult && lastResult.verification !== 'rejected'}
		{#if signedIn}
			<div class="notice">
				<p>
					{lastResult.completed ? 'Completed. ' : ''}Saved to your profile.
					{#if lastResult.personalBest}<span class="badge badge-strong">Personal best</span>{/if}
				</p>
				{#if lastResult.pointsAwarded}<p>+{lastResult.pointsAwarded} points</p>{/if}
				{#each lastResult.badges ?? [] as badge (badge)}<p>New badge: {badge}</p>{/each}
				{#each lastResult.rewards ?? [] as reward (reward.name)}
					<p>
						{reward.pending ? 'Earned' : 'Unlocked'}: {reward.name}{reward.pending
							? ' (Eva will approve it)'
							: ''}.
						<a class="text-link" href="/vault">Open your vault</a>
					</p>
				{/each}
			</div>
		{:else}
			<p class="notice">
				{lastResult.completed ? 'Completed. ' : ''}<a class="text-link" href="/signup"
					>Create an account</a
				> to keep this score. Your rounds so far come with you.
			</p>
		{/if}
	{/if}
</div>

<style>
	.game-result {
		min-height: 1px;
		margin-top: 0.75rem;
	}

	.game-result .notice p {
		margin: 0;
	}

	.game-result .notice p + p {
		margin-top: 0.3rem;
	}
</style>
