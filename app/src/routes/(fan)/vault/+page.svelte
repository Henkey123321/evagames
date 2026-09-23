<script lang="ts">
	import { enhance } from '$app/forms';
	import { ago } from '$lib/format';

	let { data, form } = $props();

	const STATUS: Record<string, string> = {
		pending_approval: 'Waiting for Eva',
		awaiting_fulfilment: 'Eva will send this to you',
		submitted: 'Proof sent. Eva will check it',
		done: 'Done'
	};
</script>

<svelte:head><title>Vault | Eva Games</title></svelte:head>

<div class="content">
	<h1 class="page-title">Vault</h1>
	<p class="page-lede">Everything you have earned.</p>

	<div class="panel summary">
		<div>
			<span class="field-label">Points</span>
			<strong class="points">{data.points}</strong>
		</div>
		{#if data.badges.length}
			<ul class="badges" aria-label="Badges">
				{#each data.badges as b (b.id)}
					<li title={b.description}>
						<span class="mark" aria-hidden="true">{b.mark}</span>
						<span>{b.name}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="field-hint">Complete games to earn points and badges.</p>
		{/if}
	</div>

	{#if form?.error}<p class="notice notice-error" role="alert">{form.error}</p>{/if}

	{#if data.items.length === 0}
		<div class="panel panel-muted">
			<p>
				No rewards yet. Some games unlock rewards when you complete them, and Eva may send you some
				herself.
			</p>
			<div class="form-actions"><a class="button" href="/">Play a game</a></div>
		</div>
	{:else}
		{#each data.items as item (item.id)}
			<article class="panel reward">
				<header class="reward-head">
					<h2>{item.name}</h2>
					{#if STATUS[item.status]}<span class="badge">{STATUS[item.status]}</span>{/if}
				</header>

				{#if item.status === 'pending_approval'}
					<p class="field-hint">You earned this. It unlocks as soon as Eva approves it.</p>
				{:else}
					{#if item.message}<p class="message">{item.message}</p>{/if}

					{#if item.url || item.code}
						<div class="reveal">
							{#if item.code}<code class="code">{item.code}</code>{/if}
							{#if item.url}<a
									class="button"
									href={item.url}
									target="_blank"
									rel="noopener noreferrer">Open link</a
								>{/if}
						</div>
					{/if}

					{#if item.game}
						<a class="button" href="/play/{item.game.slug}">Play {item.game.title}</a>
					{/if}

					{#if item.instructions}
						<div class="task">
							<span class="field-label">Your task</span>
							<p>{item.instructions}</p>
						</div>
						{#if item.staffReply && item.status === 'unlocked'}
							<p class="notice">Eva: {item.staffReply}</p>
						{/if}
						{#if item.status === 'unlocked' && (item.proof === 'text' || item.proof === 'text_image')}
							<form class="form" method="POST" action="?/proof" use:enhance>
								<input type="hidden" name="id" value={item.id} />
								<label class="field">
									<span class="field-label">Your proof</span>
									<textarea class="input proof" name="text" maxlength="4000" required></textarea>
								</label>
								<div class="form-actions">
									<button class="button" type="submit">Send proof to Eva</button>
								</div>
							</form>
						{:else if item.status === 'submitted' && item.proofText}
							<p class="field-hint">You sent: {item.proofText}</p>
						{/if}
					{/if}
				{/if}
				<p class="field-hint">Earned {ago(item.createdAt)}</p>
			</article>
		{/each}
	{/if}

	{#if data.history.length}
		<details class="panel panel-muted">
			<summary class="field-label">Points history</summary>
			<ul class="rows">
				{#each data.history as h (h.id)}
					<li>
						<span>{h.delta > 0 ? '+' : ''}{h.delta}{h.note ? `: ${h.note}` : ''}</span>
						<span class="meta">{ago(h.createdAt)}</span>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</div>

<style>
	.summary {
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 1rem 2rem;
	}

	.points {
		display: block;
		font-size: clamp(2.2rem, 6vw, 3.4rem);
		font-weight: 950;
		line-height: 0.9;
		letter-spacing: -0.06em;
		font-variant-numeric: tabular-nums;
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.badges li {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.3rem 0.6rem 0.3rem 0.3rem;
		border: 1px solid var(--line);
		font-size: 0.8rem;
		font-weight: 800;
		background: oklch(97% 0.012 336);
	}

	.mark {
		display: grid;
		place-items: center;
		min-width: 1.7rem;
		height: 1.7rem;
		color: var(--field);
		background: var(--eva-red);
	}

	.reward-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.message,
	.task p {
		white-space: pre-wrap;
	}

	.reveal {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}

	.code {
		padding: 0.55rem 0.8rem;
		border: 1px dashed var(--eva-red);
		font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
		font-size: 1.1rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		background: oklch(97% 0.012 336);
		user-select: all;
	}

	.task {
		display: grid;
		gap: 0.3rem;
		padding: 0.8rem 0.9rem;
		border-left: 0.3rem solid var(--eva-red);
		background: oklch(97% 0.012 336);
	}

	.proof {
		min-height: 6rem;
		resize: vertical;
	}

	details summary {
		cursor: pointer;
	}

	@media (max-width: 520px) {
		.summary {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
