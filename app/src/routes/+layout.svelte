<script lang="ts">
	import '$lib/styles/tokens.css';
	import '$lib/styles/base.css';
	import '$lib/styles/footer.css';
	import '$lib/styles/game.css';
	import '$lib/styles/ui.css';

	let { children } = $props();
</script>

{@render children()}
