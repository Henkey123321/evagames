<script lang="ts">
	import { enhance } from '$app/forms';
	import { PASSWORD_RULES } from '$lib/validation';
	import PushToggle from '$lib/ui/PushToggle.svelte';
	import RecoveryCodes from '$lib/ui/RecoveryCodes.svelte';

	let { data, form } = $props();
	const p = $derived(data.profile);
	const errorsFor = (action: string) =>
		form && 'errors' in form && form.action === action
			? (form.errors as Record<string, string>)
			: undefined;
	const profileErrors = $derived(errorsFor('profile'));
	const passwordErrors = $derived(errorsFor('password'));
	const deleteErrors = $derived(errorsFor('delete'));
	const savedFor = (action: string) => !!form && 'saved' in form && form.action === action;
	const newCodes = $derived(form && 'codes' in form ? form.codes : null);

	const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
	const keepForm =
		() =>
		async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });
</script>

<svelte:head><title>Your account | Eva Games</title></svelte:head>

<div class="content">
	<p class="eyebrow">@{p.username} · Member since {dateFormat.format(p.memberSince)}</p>
	<h1 class="page-title">{p.displayName}</h1>
	<p class="page-lede">Your profile, notifications and history.</p>

	{#if data.recovered !== null}
		<p class="notice" role="status">
			Password reset. You have {data.recovered} recovery code{data.recovered === '1' ? '' : 's'} left{Number(
				data.recovered
			) < 3
				? ': make new ones below.'
				: '.'}
		</p>
	{/if}

	<!-- Profile -->
	<form class="panel form" method="POST" action="?/profile" use:enhance={keepForm}>
		<h2>Profile</h2>
		<label class="field">
			<span class="field-label">Display name</span>
			<input
				class="input"
				name="displayName"
				maxlength="40"
				required
				value={p.displayName}
				aria-invalid={!!profileErrors?.displayName}
			/>
			{#if profileErrors?.displayName}<span class="field-error">{profileErrors.displayName}</span
				>{/if}
		</label>

		<div class="field">
			<span class="field-label">OnlyFans username</span>
			<div class="input-prefixed">
				<span class="input-prefix">@</span>
				<input
					class="input"
					name="onlyfansHandle"
					aria-label="OnlyFans username"
					autocapitalize="none"
					spellcheck="false"
					value={p.onlyfansHandle}
					aria-invalid={!!profileErrors?.onlyfansHandle}
				/>
			</div>
			{#if profileErrors?.onlyfansHandle}
				<span class="field-error">{profileErrors.onlyfansHandle}</span>
			{:else if p.onlyfansHandle}
				<span class={['badge', p.onlyfansVerified && 'badge-strong']}
					>{p.onlyfansVerified ? 'Verified by Eva' : 'Not verified yet'}</span
				>
			{/if}
		</div>

		<div class="field">
			<span class="field-label">LoyalFans username</span>
			<div class="input-prefixed">
				<span class="input-prefix">@</span>
				<input
					class="input"
					name="loyalfansHandle"
					aria-label="LoyalFans username"
					autocapitalize="none"
					spellcheck="false"
					value={p.loyalfansHandle}
					aria-invalid={!!profileErrors?.loyalfansHandle}
				/>
			</div>
			{#if profileErrors?.loyalfansHandle}
				<span class="field-error">{profileErrors.loyalfansHandle}</span>
			{:else if p.loyalfansHandle}
				<span class={['badge', p.loyalfansVerified && 'badge-strong']}
					>{p.loyalfansVerified ? 'Verified by Eva' : 'Not verified yet'}</span
				>
			{/if}
		</div>
		<span class="field-hint">
			Optional. Lets Eva recognise you and send some rewards there. Only Eva and her staff can see
			these. Changing a username resets its verification.
		</span>

		<label class="check">
			<input type="checkbox" name="leaderboardOptIn" checked={p.leaderboardOptIn} />
			<span>Show my display name on public leaderboards</span>
		</label>

		<div class="form-actions">
			<button class="button" type="submit">Save profile</button>
			{#if savedFor('profile')}<span class="badge" role="status">Saved</span>{/if}
		</div>
	</form>

	<!-- Notifications -->
	<section class="panel" aria-labelledby="notif-heading">
		<h2 id="notif-heading">Notifications</h2>
		<PushToggle vapidPublicKey={data.vapidPublicKey} />
	</section>

	<!-- History -->
	<section class="panel" aria-labelledby="history-heading">
		<h2 id="history-heading">Recent games</h2>
		{#if data.plays.length === 0}
			<p>No finished games yet. <a class="text-link" href="/">Pick one</a>.</p>
		{:else}
			<ul class="rows">
				{#each data.plays as play (play.id)}
					<li>
						<a class="text-link" href="/play/{play.presetSlug}">{play.presetTitle}</a>
						<span class="meta">
							{#if play.completed}<span class="badge badge-strong">Completed</span>{/if}
							{play.finishedAt ? dateFormat.format(play.finishedAt) : ''}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- Security -->
	<form class="panel form" method="POST" action="?/password" use:enhance>
		<h2>Change password</h2>
		{#if passwordErrors?.form}<p class="notice notice-error" role="alert">
				{passwordErrors.form}
			</p>{/if}
		<input type="text" name="username" autocomplete="username" value={p.username} hidden readonly />
		<label class="field">
			<span class="field-label">Current password</span>
			<input
				class="input"
				name="current"
				type="password"
				autocomplete="current-password"
				required
				aria-invalid={!!passwordErrors?.current}
			/>
			{#if passwordErrors?.current}<span class="field-error">{passwordErrors.current}</span>{/if}
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
				aria-invalid={!!passwordErrors?.password}
			/>
			{#if passwordErrors?.password}<span class="field-error">{passwordErrors.password}</span
				>{:else}<span class="field-hint">{PASSWORD_RULES}</span>{/if}
		</label>
		<label class="field">
			<span class="field-label">Confirm new password</span>
			<input
				class="input"
				name="confirm"
				type="password"
				autocomplete="new-password"
				required
				aria-invalid={!!passwordErrors?.confirm}
			/>
			{#if passwordErrors?.confirm}<span class="field-error">{passwordErrors.confirm}</span>{/if}
		</label>
		<div class="form-actions">
			<button class="button" type="submit">Change password</button>
			{#if savedFor('password')}<span class="badge" role="status"
					>Changed. Other devices were signed out.</span
				>{/if}
		</div>
	</form>

	{#if newCodes}
		<RecoveryCodes codes={newCodes} />
	{:else}
		<form class="panel form" method="POST" action="?/codes" use:enhance>
			<h2>Recovery codes</h2>
			<p>
				You have <strong>{data.codesLeft}</strong> unused recovery code{data.codesLeft === 1
					? ''
					: 's'}. Making new ones replaces all of the old ones.
			</p>
			<div class="form-actions">
				<button class="button button-quiet" type="submit">Make new codes</button>
			</div>
		</form>
	{/if}

	<div class="panel panel-muted">
		<div class="form-actions">
			<form method="POST" action="/logout">
				<button class="button button-quiet" type="submit">Sign out</button>
			</form>
		</div>
	</div>

	<details class="panel panel-muted danger">
		<summary>Delete my account</summary>
		<form class="form" method="POST" action="?/delete" use:enhance>
			<p>
				This permanently deletes your account, scores, messages and rewards. It cannot be undone.
			</p>
			{#if deleteErrors?.form}<p class="notice notice-error" role="alert">
					{deleteErrors.form}
				</p>{/if}
			<label class="field">
				<span class="field-label">Password</span>
				<input
					class="input"
					name="password"
					type="password"
					autocomplete="current-password"
					required
					aria-invalid={!!deleteErrors?.password}
				/>
				{#if deleteErrors?.password}<span class="field-error">{deleteErrors.password}</span>{/if}
			</label>
			<div class="form-actions"><button class="button" type="submit">Delete forever</button></div>
		</form>
	</details>
</div>

<style>
	.danger summary {
		font-weight: 850;
		cursor: pointer;
	}

	.danger[open] summary {
		margin-bottom: 1rem;
	}
</style>
