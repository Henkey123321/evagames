<svelte:head>
	<title>Enter | Eva Games</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="content content-narrow gate">
	<p class="eyebrow">Adults only</p>
	<h1 class="page-title">Are you 18 or older?</h1>
	<p class="page-lede">
		Eva Games is part of Eva de Vil's world and is intended for adults. By entering you confirm you
		are at least 18 years old, or the age of majority where you live.
	</p>

	<div class="gate-actions">
		<form method="POST">
			<button class="button" type="submit">I am 18+, enter</button>
		</form>
		<a class="button button-quiet" href="https://www.google.com/" rel="noreferrer">Leave</a>
	</div>
</div>

<style>
	.gate {
		padding-top: clamp(0.5rem, 3vw, 2rem);
		text-align: center;
	}

	.gate .page-lede {
		margin-inline: auto;
	}

	.gate-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.75rem;
	}
</style>
