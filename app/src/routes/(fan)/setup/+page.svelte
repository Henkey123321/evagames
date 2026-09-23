<script lang="ts">
	import { enhance } from '$app/forms';
	import { PASSWORD_RULES, USERNAME_RULES } from '$lib/validation';
	import RecoveryCodes from '$lib/ui/RecoveryCodes.svelte';

	let { form } = $props();
	const errors = $derived(
		(form && 'errors' in form ? form.errors : undefined) as Record<string, string> | undefined
	);
	const values = $derived(form && 'values' in form ? form.values : undefined);
</script>

<svelte:head>
	<title>Owner setup | Eva Games</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="content content-narrow">
	{#if form && 'created' in form}
		<h1 class="page-title">Welcome, Goddess.</h1>
		<p class="page-lede">Your owner account is ready. Save your recovery codes first.</p>
		<RecoveryCodes codes={form.codes ?? []} />
		<div class="panel panel-muted">
			<div class="form-actions">
				<a class="button" href="/ems" data-sveltekit-reload>Open the EMS</a>
			</div>
		</div>
	{:else}
		<p class="eyebrow">One-time setup</p>
		<h1 class="page-title">Create the owner account</h1>
		<p class="page-lede">
			This is Eva's account. It can do everything, including adding staff. This page disappears once
			it exists.
		</p>

		<form
			class="panel form"
			method="POST"
			use:enhance={() =>
				async ({ update }) =>
					update({ reset: false, invalidateAll: false })}
		>
			<label class="field">
				<span class="field-label">Display name</span>
				<input
					class="input"
					name="displayName"
					value={values?.displayName ?? 'Eva'}
					maxlength="40"
				/>
			</label>
			<label class="field">
				<span class="field-label">Username</span>
				<input
					class="input"
					name="username"
					autocomplete="username"
					autocapitalize="none"
					required
					value={values?.username ?? ''}
				/>
				{#if errors?.username}<span class="field-error">{errors.username}</span>{:else}<span
						class="field-hint">{USERNAME_RULES}</span
					>{/if}
			</label>
			<label class="field">
				<span class="field-label">Password</span>
				<input
					class="input"
					name="password"
					type="password"
					autocomplete="new-password"
					minlength="10"
					required
				/>
				{#if errors?.password}<span class="field-error">{errors.password}</span>{:else}<span
						class="field-hint">{PASSWORD_RULES}</span
					>{/if}
			</label>
			<label class="field">
				<span class="field-label">Confirm password</span>
				<input class="input" name="confirm" type="password" autocomplete="new-password" required />
				{#if errors?.confirm}<span class="field-error">{errors.confirm}</span>{/if}
			</label>
			<div class="form-actions">
				<button class="button" type="submit">Create owner account</button>
			</div>
		</form>
	{/if}
</div>
