<script lang="ts">
	import { enhance } from '$app/forms';
	import { PASSWORD_RULES, USERNAME_RULES } from '$lib/validation';
	import RecoveryCodes from '$lib/ui/RecoveryCodes.svelte';
	import Turnstile from '$lib/ui/Turnstile.svelte';

	let { data, form } = $props();
	let submitting = $state(false);
	const errors = $derived(
		(form && 'errors' in form ? form.errors : undefined) as Record<string, string> | undefined
	);
	const values = $derived(form && 'values' in form ? form.values : undefined);
</script>

<svelte:head><title>Join | Eva Games</title></svelte:head>

<div class="content content-narrow">
	{#if form && 'created' in form}
		<h1 class="page-title">You're in.</h1>
		<p class="page-lede">One last thing before you play.</p>
		<RecoveryCodes codes={form.codes ?? []} />
		<div class="panel panel-muted">
			<div class="form-actions">
				<a class="button" href={form.next} data-sveltekit-reload>I saved them, continue</a>
			</div>
		</div>
	{:else}
		<h1 class="page-title">Join</h1>
		<p class="page-lede">
			An account keeps your scores, lets Eva send you games and messages, and unlocks rewards. No
			email needed.
		</p>

		<form
			class="panel form"
			method="POST"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					// Don't re-run load: it redirects signed-in users, which would hide the recovery codes.
					await update({ reset: false, invalidateAll: false });
					submitting = false;
				};
			}}
		>
			{#if errors?.form}<p class="notice notice-error" role="alert">{errors.form}</p>{/if}

			<label class="field">
				<span class="field-label">Username</span>
				<input
					class="input"
					name="username"
					autocomplete="username"
					autocapitalize="none"
					spellcheck="false"
					minlength="3"
					maxlength="24"
					required
					value={values?.username ?? ''}
					aria-invalid={!!errors?.username}
					aria-describedby="username-hint"
				/>
				{#if errors?.username}
					<span class="field-error">{errors.username}</span>
				{:else}
					<span class="field-hint" id="username-hint"
						>{USERNAME_RULES} Others may see it on leaderboards if you opt in.</span
					>
				{/if}
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
					aria-invalid={!!errors?.password}
				/>
				{#if errors?.password}<span class="field-error">{errors.password}</span>{:else}<span
						class="field-hint">{PASSWORD_RULES}</span
					>{/if}
			</label>

			<label class="field">
				<span class="field-label">Confirm password</span>
				<input
					class="input"
					name="confirm"
					type="password"
					autocomplete="new-password"
					required
					aria-invalid={!!errors?.confirm}
				/>
				{#if errors?.confirm}<span class="field-error">{errors.confirm}</span>{/if}
			</label>

			<label class="check">
				<input type="checkbox" name="age" required />
				<span
					>I confirm I am 18 or older and agree to the <a class="text-link" href="/privacy"
						>privacy notice</a
					>.</span
				>
			</label>
			{#if errors?.age}<span class="field-error">{errors.age}</span>{/if}

			<Turnstile siteKey={data.turnstileSiteKey} />

			<div class="form-actions">
				<button class="button" type="submit" disabled={submitting}
					>{submitting ? 'Creating…' : 'Create account'}</button
				>
				<a class="text-link" href="/login">I already have an account</a>
			</div>
		</form>
	{/if}
</div>
