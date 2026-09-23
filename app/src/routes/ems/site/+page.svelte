<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const flash = (section: string) => (form && form.section === section ? form : null);
	const iconName = (path: string) => path.replace('/icons/', '').replace('.svg', '');
</script>

<svelte:head><title>Site | EMS</title></svelte:head>

<div class="ems-page">
	<header class="ems-head">
		<div>
			<h1>Site</h1>
			<p>Changes go live as soon as you save. There is no separate publish step.</p>
		</div>
		<a class="ems-btn" href="/" target="_blank" rel="noopener">Open the site</a>
	</header>

	<!-- Games on the hub -->
	<section class="ems-section" aria-labelledby="hub-games">
		<h2 id="hub-games">Games on the hub</h2>
		{#if flash('games')?.error}<p class="ems-flash ems-flash-error" role="alert">
				{flash('games')?.error}
			</p>{/if}
		<ul class="ems-rows">
			{#each data.games as game (game.id)}
				<li>
					<form
						class="game-row"
						method="POST"
						action="?/game"
						use:enhance={() =>
							async ({ update }) =>
								update({ reset: false })}
					>
						<input type="hidden" name="id" value={game.id} />
						<span class="ems-row-main">
							<span class="ems-row-title">{game.title}</span>
							<a class="ems-row-sub" href="/play/{game.slug}" target="_blank" rel="noopener"
								>/play/{game.slug}</a
							>
						</span>
						<label class="ems-field">
							<span class="ems-label">Position</span>
							<input
								class="ems-input order"
								type="number"
								name="hubOrder"
								min="0"
								max="999"
								value={game.hubOrder}
							/>
						</label>
						<label class="ems-field">
							<span class="ems-label">On the hub</span>
							<select class="ems-select" name="hubState">
								<option value="available" selected={game.hubState === 'available'}>Playable</option>
								<option value="coming_soon" selected={game.hubState === 'coming_soon'}
									>Coming soon</option
								>
								<option value="off" selected={game.hubState === 'off'}>Hidden from hub</option>
							</select>
						</label>
						<label class="ems-field">
							<span class="ems-label">Who can play</span>
							<select class="ems-select" name="visibility">
								<option value="public" selected={game.visibility === 'public'}
									>Everyone, incl. guests</option
								>
								<option value="members" selected={game.visibility === 'members'}
									>Signed-in fans</option
								>
								<option value="hidden" selected={game.visibility === 'hidden'}
									>Only when sent</option
								>
							</select>
						</label>
						<label class="ems-field">
							<span class="ems-label">Button text</span>
							<input class="ems-input" name="hubLabel" maxlength="24" value={game.hubLabel} />
						</label>
						<label class="ems-field">
							<span class="ems-label">Points</span>
							<input
								class="ems-input order"
								type="number"
								name="pointsOnComplete"
								min="0"
								max="100000"
								value={game.pointsOnComplete}
								title="Points for the first time a fan completes it"
							/>
						</label>
						<label class="ems-check ems-small board">
							<input type="checkbox" name="leaderboardEnabled" checked={game.leaderboardEnabled} />
							Leaderboard
						</label>
						<div class="save">
							<button class="ems-btn ems-btn-small" type="submit">Save</button>
							{#if flash('games')?.saved && form && 'id' in form && form.id === game.id}<span
									class="ems-small ems-muted"
									role="status">Saved</span
								>{/if}
						</div>
					</form>
				</li>
			{/each}
		</ul>
	</section>

	<!-- Hub text and artwork -->
	<section class="ems-section" aria-labelledby="hub-look">
		<h2 id="hub-look">Hub text and artwork</h2>
		{#if flash('hub')?.error}<p class="ems-flash ems-flash-error" role="alert">
				{flash('hub')?.error}
			</p>{/if}
		<form
			class="ems-panel ems-panel-pad ems-form hub-form"
			method="POST"
			action="?/hub"
			use:enhance={() =>
				async ({ update }) =>
					update({ reset: false })}
		>
			<label class="ems-field">
				<span class="ems-label">Coming-soon tile title</span>
				<input
					class="ems-input"
					name="hubComingSoonTitle"
					maxlength="60"
					value={data.settings.hubComingSoonTitle}
				/>
			</label>
			<label class="ems-field">
				<span class="ems-label">Coming-soon tile label</span>
				<input
					class="ems-input"
					name="hubComingSoonLabel"
					maxlength="24"
					value={data.settings.hubComingSoonLabel}
				/>
			</label>
			{#each [['hubArtLeft', 'Left figure'], ['hubArtRight', 'Right figure']] as [name, label] (name)}
				<label class="ems-field">
					<span class="ems-label">{label}</span>
					<span class="art-pick">
						<img src={data.settings[name as 'hubArtLeft']} alt="" />
						<select class="ems-select" {name}>
							{#each data.art as a (a.value)}
								<option value={a.value} selected={a.value === data.settings[name as 'hubArtLeft']}
									>{a.label}</option
								>
							{/each}
						</select>
					</span>
				</label>
			{/each}
			<label class="ems-field">
				<span class="ems-label">Main site link</span>
				<input class="ems-input" name="mainSiteUrl" type="url" value={data.settings.mainSiteUrl} />
			</label>
			<div class="ems-actions">
				<button class="ems-btn ems-btn-primary" type="submit">Save hub</button>
				{#if flash('hub')?.saved}<span class="ems-small ems-muted" role="status">Saved</span>{/if}
			</div>
			<p class="ems-small ems-muted">Uploading new artwork arrives with the media library.</p>
		</form>
	</section>

	<!-- Footer links -->
	<section class="ems-section" aria-labelledby="footer-links">
		<h2 id="footer-links">Footer links</h2>
		{#if flash('links')?.error}<p class="ems-flash ems-flash-error" role="alert">
				{flash('links')?.error}
			</p>{/if}
		<ul class="ems-rows">
			{#each [...data.links, null] as link (link?.id ?? 'new')}
				<li>
					<form
						class="link-row"
						method="POST"
						action="?/link"
						use:enhance={() =>
							async ({ update }) =>
								update({ reset: !link })}
					>
						{#if link}<input type="hidden" name="id" value={link.id} />{/if}
						<label class="ems-field">
							<span class="ems-label">{link ? 'Name' : 'New link'}</span>
							<input
								class="ems-input"
								name="label"
								maxlength="40"
								value={link?.label ?? ''}
								placeholder="e.g. Fansly"
								required
							/>
						</label>
						<label class="ems-field url">
							<span class="ems-label">Address</span>
							<input
								class="ems-input"
								name="url"
								type="url"
								value={link?.url ?? ''}
								placeholder="https://"
								required
							/>
						</label>
						<label class="ems-field">
							<span class="ems-label">Icon</span>
							<select class="ems-select" name="icon">
								{#each data.icons as icon (icon)}
									<option value={icon} selected={icon === link?.icon}>{iconName(icon)}</option>
								{/each}
							</select>
						</label>
						<label class="ems-field">
							<span class="ems-label">Row</span>
							<select class="ems-select" name="group">
								<option value="store" selected={link?.group !== 'social'}>Stores</option>
								<option value="social" selected={link?.group === 'social'}>Socials</option>
							</select>
						</label>
						<label class="ems-field">
							<span class="ems-label">Position</span>
							<input
								class="ems-input order"
								type="number"
								name="sortOrder"
								min="0"
								max="999"
								value={link?.sortOrder ?? data.links.length + 1}
							/>
						</label>
						<div class="save">
							<button class={['ems-btn', 'ems-btn-small', !link && 'ems-btn-primary']} type="submit"
								>{link ? 'Save' : 'Add link'}</button
							>
							{#if link}
								<button
									class="ems-btn ems-btn-small ems-btn-danger"
									type="submit"
									formaction="?/deleteLink"
									formnovalidate>Remove</button
								>
							{/if}
						</div>
					</form>
				</li>
			{/each}
		</ul>
	</section>
</div>

<style>
	.game-row,
	.link-row {
		display: grid;
		grid-template-columns:
			minmax(7rem, 1.2fr) 4.5rem minmax(8rem, 1fr) minmax(9rem, 1.1fr) minmax(6rem, 0.8fr)
			4.5rem auto auto;
		align-items: end;
		gap: 0.6rem 0.85rem;
		padding: 0.8rem 1rem;
	}

	.link-row {
		grid-template-columns: minmax(8rem, 1fr) minmax(12rem, 2fr) minmax(8rem, 1fr) 7rem 5rem auto;
	}

	.game-row .ems-row-main {
		align-self: center;
	}

	.order {
		width: 5rem;
	}

	.board {
		padding-bottom: 0.45rem;
	}

	.save {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.hub-form {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.hub-form .ems-actions,
	.hub-form p {
		grid-column: 1 / -1;
	}

	.art-pick {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.art-pick img {
		width: 3rem;
		height: 3rem;
		object-fit: contain;
		border: 1px solid var(--ems-line);
		background: var(--eva-pink);
	}

	@media (max-width: 1000px) {
		.game-row,
		.link-row,
		.hub-form {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.game-row .ems-row-main,
		.link-row .url {
			grid-column: 1 / -1;
		}
	}
</style>
