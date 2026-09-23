<script lang="ts">
	let { codes }: { codes: string[] } = $props();
	let copied = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(codes.join('\n'));
			copied = true;
		} catch {
			copied = false;
		}
	}
</script>

<div class="panel">
	<p class="eyebrow">Save these now</p>
	<h2>Your recovery codes</h2>
	<p>
		There is no email on this site, so these codes are how you get back in if you forget your
		password. Each code works once. Keep them somewhere private. This is the only time they are
		shown.
	</p>
	<ul class="code-grid" aria-label="Recovery codes">
		{#each codes as code (code)}<li>{code}</li>{/each}
	</ul>
	<div class="form-actions">
		<button class="button button-quiet" type="button" onclick={copy}
			>{copied ? 'Copied' : 'Copy codes'}</button
		>
	</div>
</div>
