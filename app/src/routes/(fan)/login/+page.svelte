<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Turnstile from '$lib/ui/Turnstile.svelte';

	let { data, form } = $props();
	const errors = $derived((form?.errors ?? {}) as Record<string, string>);
	let submitting = $state(false);
	const next = $derived(page.url.searchParams.get('next'));
</script>

<svelte:head><title>Sign in | Eva Games</title></svelte:head>

<div class="content content-narrow">
	<h1 class="page-title">Sign in</h1>
	<p class="page-lede">Welcome back.</p>

	<form
		class="panel form"
		method="POST"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update({ reset: false });
				submitting = false;
			};
		}}
	>
		{#if errors.form}<p class="notice notice-error" role="alert">{errors.form}</p>{/if}

		<label class="field">
			<span class="field-label">Username</span>
			<input
				class="input"
				name="username"
				autocomplete="username"
				autocapitalize="none"
				spellcheck="false"
				required
				value={form?.values?.username ?? ''}
				aria-invalid={!!errors.username}
			/>
			{#if errors.username}<span class="field-error">{errors.username}</span>{/if}
		</label>

		<label class="field">
			<span class="field-label">Password</span>
			<input
				class="input"
				name="password"
				type="password"
				autocomplete="current-password"
				required
				aria-invalid={!!errors.password}
			/>
			{#if errors.password}<span class="field-error">{errors.password}</span>{/if}
		</label>

		<Turnstile siteKey={data.turnstileSiteKey} />

		<div class="form-actions">
			<button class="button" type="submit" disabled={submitting}
				>{submitting ? 'Signing in…' : 'Sign in'}</button
			>
			<a class="text-link" href="/recover">Forgot password?</a>
		</div>
	</form>

	<div class="panel panel-muted">
		<p>
			New here? <a class="text-link" href="/signup{next ? `?next=${encodeURIComponent(next)}` : ''}"
				>Create an account</a
			>
		</p>
	</div>
</div>
