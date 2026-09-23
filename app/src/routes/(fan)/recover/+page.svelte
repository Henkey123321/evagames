<script lang="ts">
	import { enhance } from '$app/forms';
	import { PASSWORD_RULES } from '$lib/validation';

	let { form } = $props();
	const errors = $derived((form?.errors ?? {}) as Record<string, string>);
	let submitting = $state(false);
</script>

<svelte:head><title>Reset password | Eva Games</title></svelte:head>

<div class="content content-narrow">
	<h1 class="page-title">Reset password</h1>
	<p class="page-lede">
		Use one of the recovery codes you saved when you joined, or a reset code Eva or her staff sent
		you.
	</p>

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
				required
				value={form?.values?.username ?? ''}
			/>
		</label>

		<label class="field">
			<span class="field-label">Recovery or reset code</span>
			<input
				class="input"
				name="code"
				autocomplete="one-time-code"
				autocapitalize="characters"
				spellcheck="false"
				placeholder="XXXX-XXXX-XXXX"
				required
				aria-invalid={!!errors.code}
			/>
			{#if errors.code}<span class="field-error">{errors.code}</span>{/if}
		</label>

		<label class="field">
			<span class="field-label">New password</span>
			<input
				class="input"
				name="password"
				type="password"
				autocomplete="new-password"
				minlength="10"
				required
				aria-invalid={!!errors.password}
			/>
			{#if errors.password}<span class="field-error">{errors.password}</span>{:else}<span
					class="field-hint">{PASSWORD_RULES}</span
				>{/if}
		</label>

		<label class="field">
			<span class="field-label">Confirm new password</span>
			<input
				class="input"
				name="confirm"
				type="password"
				autocomplete="new-password"
				required
				aria-invalid={!!errors.confirm}
			/>
			{#if errors.confirm}<span class="field-error">{errors.confirm}</span>{/if}
		</label>

		<div class="form-actions">
			<button class="button" type="submit" disabled={submitting}
				>{submitting ? 'Resetting…' : 'Reset password'}</button
			>
			<a class="text-link" href="/login">Back to sign in</a>
		</div>
	</form>

	<div class="panel panel-muted">
		<p>
			Lost your codes too? Message Eva on OnlyFans or LoyalFans and ask for a reset code for your
			username.
		</p>
	</div>
</div>
