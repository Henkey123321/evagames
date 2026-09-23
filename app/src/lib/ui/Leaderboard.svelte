<script lang="ts">
	let {
		title,
		rows,
		empty
	}: { title: string; rows: { name: string; value: string; isMe?: boolean }[]; empty: string } =
		$props();
</script>

<section class="board" aria-label={title}>
	<h2>{title}</h2>
	{#if rows.length === 0}
		<p class="field-hint">{empty}</p>
	{:else}
		<ol>
			{#each rows as row, i (i)}
				<li class:me={row.isMe}>
					<span class="rank">{i + 1}</span>
					<span class="name">{row.name}{row.isMe ? ' (you)' : ''}</span>
					<span class="value">{row.value}</span>
				</li>
			{/each}
		</ol>
	{/if}
	<p class="field-hint">
		Only fans who chose to appear are listed. Change it on your <a class="text-link" href="/account"
			>account page</a
		>.
	</p>
</section>

<style>
	.board {
		display: grid;
		gap: 0.75rem;
		margin-top: clamp(1.25rem, 3vw, 2rem);
	}

	h2 {
		margin: 0;
		font-size: clamp(1.4rem, 3vw, 2rem);
		font-weight: 900;
		line-height: 0.95;
		letter-spacing: -0.05em;
	}

	ol {
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--line);
		border-left: 1px solid var(--line);
		list-style: none;
	}

	li {
		display: grid;
		grid-template-columns: 2.5rem minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 0.8rem;
		border-right: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		font-weight: 800;
		background: var(--panel);
	}

	li.me {
		background: var(--panel-muted);
	}

	.rank {
		font-size: 0.7rem;
		letter-spacing: 0.18em;
		color: var(--eva-mauve);
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.value {
		font-variant-numeric: tabular-nums;
	}
</style>
