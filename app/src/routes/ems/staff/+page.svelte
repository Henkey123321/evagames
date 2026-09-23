<script lang="ts">
	import { enhance } from '$app/forms';
	import { ago, fullDate } from '$lib/format';

	let { data, form } = $props();
	let showCreate = $state(false);

	const describe = (action: string) => action.replace(/_/g, ' ');
</script>

<svelte:head><title>Staff | EMS</title></svelte:head>

<div class="ems-page">
	<header class="ems-head">
		<div>
			<h1>Staff</h1>
			<p>People who help run Eva Games. Each person only sees the areas you tick.</p>
		</div>
		<button
			class="ems-btn"
			type="button"
			onclick={() => (showCreate = !showCreate)}
			aria-expanded={showCreate}
		>
			{showCreate ? 'Close' : 'Add staff'}
		</button>
	</header>

	{#if form && 'error' in form}<p class="ems-flash ems-flash-error" role="alert">
			{form.error}
		</p>{/if}
	{#if form && 'setupCode' in form}
		<div class="ems-flash" role="status">
			<p>
				Give this code to {form.forName}. They go to <strong>/recover</strong>, enter their username
				and the code, and choose their own password. It works once, for 48 hours.
			</p>
			<p class="ems-code">{form.setupCode}</p>
		</div>
	{/if}

	{#if showCreate}
		<form
			class="ems-panel ems-panel-pad ems-form"
			method="POST"
			action="?/create"
			use:enhance={() =>
				async ({ update, result }) => {
					await update({ reset: result.type === 'success' });
					if (result.type === 'success') showCreate = false;
				}}
		>
			<div class="two">
				<label class="ems-field">
					<span class="ems-label">Username</span>
					<input class="ems-input" name="username" autocapitalize="none" maxlength="24" required />
				</label>
				<label class="ems-field">
					<span class="ems-label">Display name</span>
					<input class="ems-input" name="displayName" maxlength="40" required />
				</label>
			</div>
			<fieldset class="perms">
				<legend class="ems-label">Access</legend>
				{#each data.permissions as p (p.id)}
					<label class="ems-check"
						><input type="checkbox" name="permissions" value={p.id} /> {p.label}</label
					>
				{/each}
			</fieldset>
			<div class="ems-actions">
				<button class="ems-btn ems-btn-primary" type="submit">Create staff account</button>
			</div>
		</form>
	{/if}

	<ul class="ems-rows">
		{#each data.staff as s (s.id)}
			<li class="member">
				<div class="member-head">
					<span class="ems-row-main">
						<span class="ems-row-title">
							{s.displayName}
							{#if s.role === 'owner'}<span class="ems-chip ems-chip-ok">Owner</span>{/if}
							{#if s.disabledAt}<span class="ems-chip ems-chip-warn">Disabled</span>{/if}
						</span>
						<span class="ems-row-sub">@{s.username}, last seen {ago(s.lastSeenAt)}</span>
					</span>
					{#if s.role === 'staff'}
						<div class="ems-actions">
							<form method="POST" action="?/resetCode" use:enhance>
								<input type="hidden" name="id" value={s.id} />
								<button class="ems-btn ems-btn-small" type="submit">New setup code</button>
							</form>
							<form method="POST" action="?/disable" use:enhance>
								<input type="hidden" name="id" value={s.id} />
								<input type="hidden" name="disabled" value={s.disabledAt ? '0' : '1'} />
								<button class="ems-btn ems-btn-small ems-btn-danger" type="submit"
									>{s.disabledAt ? 'Enable' : 'Disable'}</button
								>
							</form>
						</div>
					{/if}
				</div>
				{#if s.role === 'owner'}
					<p class="ems-small ems-muted">Full access to everything.</p>
				{:else}
					<form
						class="perms-inline"
						method="POST"
						action="?/permissions"
						use:enhance={() =>
							async ({ update }) =>
								update({ reset: false })}
					>
						<input type="hidden" name="id" value={s.id} />
						{#each data.permissions as p (p.id)}
							<label class="ems-check ems-small">
								<input
									type="checkbox"
									name="permissions"
									value={p.id}
									checked={s.permissions.includes(p.id)}
								/>
								{p.label.split(':')[0]}
							</label>
						{/each}
						<button class="ems-btn ems-btn-small" type="submit">Save access</button>
						{#if form && 'savedId' in form && form.savedId === s.id}<span
								class="ems-small ems-muted"
								role="status">Saved</span
							>{/if}
					</form>
				{/if}
			</li>
		{/each}
	</ul>

	<section class="ems-section" aria-labelledby="audit">
		<h2 id="audit">Recent staff actions</h2>
		{#if data.log.length === 0}
			<p class="ems-panel ems-empty">Nothing yet.</p>
		{:else}
			<ul class="ems-rows">
				{#each data.log as entry (entry.id)}
					<li class="ems-row log-row">
						<span class="ems-row-sub log-line"
							><strong>{entry.actorName ?? 'Someone'}</strong> {describe(entry.action)}</span
						>
						<span class="ems-row-meta" title={fullDate(entry.createdAt)}
							>{ago(entry.createdAt)}</span
						>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	.two {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.85rem;
	}

	.perms {
		display: grid;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.member {
		display: grid;
		gap: 0.6rem;
		padding: 0.85rem 1rem;
	}

	.member-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
	}

	.member-head form,
	.perms-inline {
		margin: 0;
	}

	.perms-inline {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 1rem;
	}

	.ems-row-title {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}

	.log-row {
		grid-template-columns: minmax(0, 1fr) auto;
		padding-block: 0.5rem;
	}

	.log-line {
		white-space: normal;
		color: var(--ems-text);
	}

	.ems-flash p {
		margin: 0 0 0.35rem;
	}

	@media (max-width: 600px) {
		.two {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
