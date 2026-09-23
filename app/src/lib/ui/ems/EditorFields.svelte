<script lang="ts">
	// Renders a game's editor fields (from its manifest) as form inputs named `cfg_<key>`.
	import type { EditorField } from '$lib/games/sdk/types';
	import { CONFIG_PREFIX } from '$lib/games/sdk/editor';

	let { fields, values }: { fields: EditorField[]; values: Record<string, unknown> } = $props();
</script>

<div class="fields">
	{#each fields as field (field.key)}
		{@const name = CONFIG_PREFIX + field.key}
		{#if field.type === 'boolean'}
			<label class="ems-check full">
				<input type="checkbox" {name} checked={Boolean(values[field.key])} />
				{field.label}
			</label>
		{:else}
			<label class={['ems-field', field.type === 'text' && field.maxLength > 60 && 'full']}>
				<span class="ems-label">{field.label}</span>
				{#if field.type === 'number'}
					<input
						class="ems-input"
						type="number"
						{name}
						min={field.min}
						max={field.max}
						step={field.step ?? 1}
						value={values[field.key] as number}
					/>
				{:else if field.type === 'select'}
					<select class="ems-select" {name}>
						{#each field.options as o (o.value)}
							<option value={o.value} selected={String(values[field.key]) === String(o.value)}
								>{o.label}</option
							>
						{/each}
					</select>
				{:else}
					<input
						class="ems-input"
						{name}
						maxlength={field.maxLength}
						value={(values[field.key] as string) ?? ''}
					/>
				{/if}
				{#if field.help}<span class="ems-small ems-muted">{field.help}</span>{/if}
			</label>
		{/if}
	{/each}
</div>

<style>
	.fields {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: 0.85rem 1rem;
	}

	.full {
		grid-column: 1 / -1;
	}
</style>
