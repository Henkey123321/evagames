<script lang="ts">
	// 14-day stacked columns: completed rounds (dark) under other finished rounds (light).
	// Palette validated with the dataviz validator against the EMS panel surface.
	interface Day {
		date: Date;
		played: number;
		completed: number;
	}

	let { days }: { days: Day[] } = $props();

	const COMPLETED = '#b02a2f';
	const OTHER = '#e88d93';
	// Drawn at the container's real pixel width so text never scales with the page.
	let width = $state(560);
	const W = $derived(Math.max(280, Math.round(width)));
	const H = 160;
	const PAD = { top: 12, right: 8, bottom: 22, left: 28 };
	const GAP = 2;

	const dayLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
	const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });

	const max = $derived(Math.max(4, ...days.map((d) => d.played)));
	// Clean top tick: round up to 1/2/5 × 10^n.
	const top = $derived.by(() => {
		const p = 10 ** Math.floor(Math.log10(max));
		return [1, 2, 5, 10].map((m) => m * p).find((v) => v >= max) ?? max;
	});
	const band = $derived((W - PAD.left - PAD.right) / days.length);
	const barW = $derived(Math.min(24, band * 0.62));
	const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - v / top);

	let hover: number | null = $state(null);

	/** Column path with a 4px rounded top, square at the baseline. */
	function column(x: number, y0: number, y1: number, w: number, roundTop: boolean) {
		const h = y0 - y1;
		if (h <= 0) return '';
		const r = roundTop ? Math.min(4, h, w / 2) : 0;
		return `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + r} V${y0} Z`;
	}
</script>

<figure class="plays-chart">
	<figcaption class="legend">
		<span><i style:background={COMPLETED}></i>Completed</span>
		<span><i style:background={OTHER}></i>Played, not completed</span>
	</figcaption>

	<div class="plot" bind:clientWidth={width}>
		<svg width={W} height={H} viewBox="0 0 {W} {H}" role="img" aria-label="Games finished per day over the last 14 days">
			{#each [0, top / 2, top] as tick (tick)}
				<line class="grid" x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
				<text class="tick" x={PAD.left - 6} y={y(tick) + 4} text-anchor="end">{tick}</text>
			{/each}

			{#each days as d, i (d.date.getTime())}
				{@const x = PAD.left + band * i + (band - barW) / 2}
				{@const base = y(0)}
				{@const yc = y(d.completed)}
				{@const yp = y(d.played)}
				{@const other = d.played - d.completed}
				<g
					class="col"
					class:dim={hover !== null && hover !== i}
					role="presentation"
					onpointerenter={() => (hover = i)}
					onpointerleave={() => (hover = null)}
				>
					<rect
						class="hit"
						x={PAD.left + band * i}
						y={PAD.top}
						width={band}
						height={H - PAD.top - PAD.bottom}
					/>
					{#if d.completed > 0}
						<path d={column(x, base, yc, barW, other === 0)} fill={COMPLETED} />
					{/if}
					{#if other > 0}
						<path d={column(x, d.completed > 0 ? yc - GAP : base, yp, barW, true)} fill={OTHER} />
					{/if}
				</g>
				{#if i % 2 === 1 || days.length <= 7}
					<text class="tick" x={x + barW / 2} y={H - 6} text-anchor="middle"
						>{dayLabel.format(d.date)}</text
					>
				{/if}
			{/each}
		</svg>

		{#if hover !== null}
			{@const d = days[hover]}
			<div class="tip" style:left="{((PAD.left + band * hover + band / 2) / W) * 100}%">
				<strong>{weekday.format(d.date)} {dayLabel.format(d.date)}</strong>
				<span><i style:background={COMPLETED}></i>{d.completed} completed</span>
				<span><i style:background={OTHER}></i>{d.played - d.completed} not completed</span>
				<span class="total">{d.played} played</span>
			</div>
		{/if}
	</div>

	<details class="table-view">
		<summary>Show as table</summary>
		<table>
			<thead
				><tr><th scope="col">Day</th><th scope="col">Played</th><th scope="col">Completed</th></tr
				></thead
			>
			<tbody>
				{#each days as d (d.date.getTime())}
					<tr><td>{dayLabel.format(d.date)}</td><td>{d.played}</td><td>{d.completed}</td></tr>
				{/each}
			</tbody>
		</table>
	</details>
</figure>

<style>
	.plays-chart {
		display: grid;
		gap: 0.5rem;
		margin: 0;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 1.1rem;
		font-size: 0.82rem;
		color: var(--ems-muted);
	}

	.legend span,
	.tip span {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	i {
		display: inline-block;
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 2px;
	}

	.plot {
		position: relative;
	}

	svg {
		display: block;
		overflow: visible;
	}

	.grid {
		stroke: var(--ems-line);
		stroke-width: 1;
	}

	.tick {
		font-size: 10px;
		fill: var(--ems-muted);
	}

	.hit {
		fill: transparent;
	}

	.col {
		transition: opacity 120ms ease-out;
	}

	.col.dim {
		opacity: 0.45;
	}

	.tip {
		position: absolute;
		top: 0;
		z-index: 2;
		display: grid;
		gap: 0.15rem;
		min-width: 9rem;
		padding: 0.5rem 0.65rem;
		border: 1px solid var(--ems-line-strong);
		font-size: 0.8rem;
		color: var(--ems-text);
		background: var(--ems-panel);
		transform: translateX(-50%);
		pointer-events: none;
	}

	.total {
		color: var(--ems-muted);
	}

	.table-view summary {
		font-size: 0.82rem;
		color: var(--ems-muted);
		cursor: pointer;
	}

	table {
		margin-top: 0.5rem;
		border-collapse: collapse;
		font-size: 0.82rem;
	}

	th,
	td {
		padding: 0.25rem 0.9rem 0.25rem 0;
		text-align: left;
	}

	th {
		font-weight: 700;
		color: var(--ems-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.col {
			transition: none;
		}
	}
</style>
