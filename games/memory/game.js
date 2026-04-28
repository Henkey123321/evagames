/* ──────────────────────────────────────────────────────────────────
   Memory — Self-bootstrapping game module.
   Builds all DOM into #game-container, reads window.__GAME_CONFIG__.
   ────────────────────────────────────────────────────────────────── */

const CFG = Object.assign(
	{
		pairs: 8,
		flip_back_delay_ms: 760,
		card_back_text: "E",
		win_message: "Cleared",
		win_copy: "The room is yours.",
		instructions: "Turn over two cards. Keep the pair, remember the room, clear the board with as few moves as possible.",
		assets: [],
	},
	window.__GAME_CONFIG__ || {},
);

const PAIRS = CFG.pairs;
const FLIP_BACK_DELAY = CFG.flip_back_delay_ms;
const BEST_KEY = "eva-memory-best-v1";

/* ── Resolve card image pool ─────────────────────────────────── */

// Prefer CMS-uploaded card_image assets, fall back to hardcoded filenames
const CARD_IMAGE_POOL = resolveCardImages();

function resolveCardImages() {
	// Check if the CMS provided assets with slot "card_image"
	if (Array.isArray(CFG.assets) && CFG.assets.length > 0) {
		const cardAssets = CFG.assets
			.filter((a) => a.slot === "card_image")
			.map((a) => a.file);
		if (cardAssets.length > 0) return cardAssets;
	}

	// Fallback: hardcoded filenames that exist in assets/
	return [
		"F2yts5RboAAu1tm.jpg",
		"F5hq-xXaMAA0q0d.jpg",
		"Fnl3kLIaQAAY4jz.jpg",
		"G8IZLrVW8AY7tKp.jpg",
		"GbFQKLMXIAAiBx1.jpg",
		"HAWBPhPW0AAbr92.jpg",
		"HAWKeW3XgAA6rTc.jpg",
		"HCSGH9VWcAAhS_D.jpg",
		"HCSTsveXsAAaJdx.jpg",
		"HDd2VvHbMAA1Wsl.jpg",
		"ezgif-5165d37e138bb8df.gif",
		"ezgif-52fbe9c3e6eeade0.gif",
		"ezgif-53d2d19e80426395.gif",
		"ezgif-5407f2824cddc904.gif",
		"ezgif-56821225cf48a2d9.gif",
		"ezgif-58880e33036ee96e.gif",
		"ezgif-5960e6312fc124e5.gif",
		"ezgif-7115b1b0e36f338a.gif",
		"ezgif-735ff11df7dd1869.gif",
		"ezgif-7366d247ca88a409.gif",
		"ezgif-742d821db30ca5bc.gif",
	];
}

/* ── DOM construction ─────────────────────────────────────────── */

function buildUI() {
	const container = document.getElementById("game-container");
	if (!container) {
		console.error("Memory: #game-container not found");
		return null;
	}

	// Compute grid columns from pairs
	const totalCards = PAIRS * 2;
	const cols = Math.ceil(Math.sqrt(totalCards));

	container.innerHTML = `
		<div class="scorebar">
			<div class="scorebox">
				<span>Moves</span>
				<strong id="moves">0</strong>
			</div>
			<div class="scorebox">
				<span>Matches</span>
				<strong id="matches">0/${PAIRS}</strong>
			</div>
			<div class="scorebox">
				<span>Time</span>
				<strong id="timer">0:00</strong>
			</div>
			<div class="scorebox scorebox-best">
				<span>Best</span>
				<strong id="best-score">None</strong>
			</div>
		</div>
		<div class="controls">
			<button class="control-button" id="new-game" type="button">New game</button>
		</div>
		<div class="board-wrap" id="board-wrap">
			<div class="memory-board" id="memory-board"
				 style="grid-template-columns: repeat(${cols}, minmax(0, 1fr)); grid-template-rows: repeat(${Math.ceil(totalCards / cols)}, minmax(0, 1fr));"
				 role="grid" aria-label="Memory game board"></div>
			<div class="game-message" id="game-message" hidden>
				<p id="message-title">${escapeHtml(CFG.win_message)}</p>
				<span id="message-copy"></span>
				<button class="control-button" id="message-new-game" type="button">Play again</button>
			</div>
		</div>
		<div class="sr-only" id="memory-status" aria-live="polite" aria-atomic="true"></div>`;

	return {
		board: container.querySelector("#memory-board"),
		movesEl: container.querySelector("#moves"),
		matchesEl: container.querySelector("#matches"),
		timerEl: container.querySelector("#timer"),
		bestScoreEl: container.querySelector("#best-score"),
		newGameButton: container.querySelector("#new-game"),
		message: container.querySelector("#game-message"),
		messageCopy: container.querySelector("#message-copy"),
		messageNewGameButton: container.querySelector("#message-new-game"),
		statusEl: container.querySelector("#memory-status"),
	};
}

function escapeHtml(str) {
	const div = document.createElement("div");
	div.textContent = str;
	return div.innerHTML;
}

const dom = buildUI();
if (!dom) throw new Error("Memory: failed to build UI");

const {
	board,
	movesEl,
	matchesEl,
	timerEl,
	bestScoreEl,
	newGameButton: newGameBtn,
	message,
	messageCopy,
	messageNewGameButton: messageNewGameBtn,
	statusEl,
} = dom;

/* ── State ────────────────────────────────────────────────────── */

let cards = [];
let firstCard = null;
let secondCard = null;
let moves = 0;
let matches = 0;
let locked = false;
let timerStarted = false;
let elapsedSeconds = 0;
let timerId = null;

/* ── Utilities ────────────────────────────────────────────────── */

function shuffle(items) {
	return [...items]
		.map((item) => ({ item, order: Math.random() }))
		.sort((a, b) => a.order - b.order)
		.map(({ item }) => item);
}

function formatTime(totalSeconds) {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/* ── Best score persistence ───────────────────────────────────── */

function readBest() {
	try {
		const stored = localStorage.getItem(BEST_KEY);
		return stored ? JSON.parse(stored) : null;
	} catch {
		return null;
	}
}

function writeBest(best) {
	try {
		localStorage.setItem(BEST_KEY, JSON.stringify(best));
	} catch {
		// Ignore storage failures. The current score still appears in the round summary.
	}
}

function isBetterScore(score, best) {
	return (
		!best ||
		score.moves < best.moves ||
		(score.moves === best.moves && score.time < best.time)
	);
}

function updateBestDisplay() {
	const best = readBest();
	bestScoreEl.textContent = best
		? `${best.moves} / ${formatTime(best.time)}`
		: "None";
}

function updateStats() {
	movesEl.textContent = moves;
	matchesEl.textContent = `${matches}/${PAIRS}`;
	timerEl.textContent = formatTime(elapsedSeconds);
}

function announce(text) {
	statusEl.textContent = text;
}

/* ── Timer ────────────────────────────────────────────────────── */

function startTimer() {
	if (timerStarted) return;
	timerStarted = true;
	timerId = window.setInterval(() => {
		elapsedSeconds += 1;
		timerEl.textContent = formatTime(elapsedSeconds);
	}, 1000);
}

function stopTimer() {
	window.clearInterval(timerId);
	timerId = null;
}

/* ── Card creation ────────────────────────────────────────────── */

function createCard(card, index) {
	const button = document.createElement("button");
	button.className = "memory-card";
	button.type = "button";
	button.dataset.cardId = card.id;
	button.dataset.image = card.image;
	button.setAttribute("aria-label", `Card ${index + 1}, hidden`);

	const inner = document.createElement("span");
	inner.className = "card-inner";

	const back = document.createElement("span");
	back.className = "card-face card-back";
	back.setAttribute("aria-hidden", "true");

	const mark = document.createElement("span");
	mark.className = "card-mark";
	mark.textContent = CFG.card_back_text;
	back.append(mark);

	const front = document.createElement("span");
	front.className = "card-face card-front";
	front.setAttribute("aria-hidden", "true");

	const image = document.createElement("img");
	image.dataset.src = `assets/${card.image}`;
	image.alt = "";
	image.loading = index < 4 ? "eager" : "lazy";
	image.decoding = "async";
	image.draggable = false;
	front.append(image);

	inner.append(back, front);
	button.append(inner);
	button.addEventListener("click", () => revealCard(button));

	return button;
}

function pickRoundImages() {
	if (CARD_IMAGE_POOL.length < PAIRS) {
		throw new Error(`Memory needs at least ${PAIRS} files in CARD_IMAGE_POOL.`);
	}

	return shuffle(CARD_IMAGE_POOL).slice(0, PAIRS);
}

function buildDeck() {
	const roundImages = pickRoundImages();
	const pairs = roundImages.flatMap((image) => [
		{ id: image, image },
		{ id: image, image },
	]);
	return shuffle(pairs);
}

function renderBoard() {
	board.replaceChildren();
	cards = buildDeck().map((card, index) => {
		const element = createCard(card, index);
		board.append(element);
		return element;
	});
}

/* ── Card interaction ─────────────────────────────────────────── */

function cardImage(card) {
	return card.querySelector("img");
}

function showCardMedia(card) {
	const image = cardImage(card);
	if (!image || image.dataset.playing === "true") return;

	image.dataset.playing = "true";
	image.removeAttribute("src");
	requestAnimationFrame(() => {
		image.src = image.dataset.src;
	});
}

function hideCardMedia(card) {
	const image = cardImage(card);
	if (!image || card.classList.contains("is-matched")) return;

	image.dataset.playing = "false";
	image.removeAttribute("src");
}

function setCardVisible(card, visible) {
	if (visible) {
		showCardMedia(card);
	} else {
		hideCardMedia(card);
	}

	card.classList.toggle("is-visible", visible);
	const index = cards.indexOf(card) + 1;
	const state = card.classList.contains("is-matched")
		? "matched"
		: visible
			? "revealed"
			: "hidden";
	card.setAttribute("aria-label", `Card ${index}, ${state}`);
}

function resetSelection() {
	firstCard = null;
	secondCard = null;
}

function setLocked(value) {
	locked = value;
	board.classList.toggle("is-locked", value);
}

function handleMatch() {
	firstCard.classList.add("is-matched");
	secondCard.classList.add("is-matched");
	firstCard.disabled = true;
	secondCard.disabled = true;
	setCardVisible(firstCard, true);
	setCardVisible(secondCard, true);

	matches += 1;
	updateStats();
	announce(`Matched ${matches} of ${PAIRS}.`);
	resetSelection();

	if (matches === PAIRS) {
		finishGame();
	}
}

function handleMiss() {
	const missedFirst = firstCard;
	const missedSecond = secondCard;

	setLocked(true);
	window.setTimeout(() => {
		if (!missedFirst.isConnected || !missedSecond.isConnected) return;

		setCardVisible(missedFirst, false);
		setCardVisible(missedSecond, false);
		resetSelection();
		setLocked(false);
		announce("No match. Try the room again.");
	}, FLIP_BACK_DELAY);
}

function revealCard(card) {
	if (
		locked ||
		card.disabled ||
		card === firstCard ||
		card.classList.contains("is-visible")
	)
		return;

	startTimer();
	setCardVisible(card, true);

	if (!firstCard) {
		firstCard = card;
		announce("First card revealed. Choose its pair.");
		return;
	}

	secondCard = card;
	moves += 1;
	updateStats();

	if (firstCard.dataset.cardId === secondCard.dataset.cardId) {
		handleMatch();
	} else {
		handleMiss();
	}
}

function finishGame() {
	stopTimer();
	const score = { moves, time: elapsedSeconds };
	const best = readBest();
	const improved = isBetterScore(score, best);

	if (improved) {
		writeBest(score);
		updateBestDisplay();
	}

	messageCopy.textContent = improved
		? `New best: ${moves} moves in ${formatTime(elapsedSeconds)}.`
		: `${moves} moves in ${formatTime(elapsedSeconds)}.`;
	message.hidden = false;
	messageNewGameBtn.focus({ preventScroll: true });
	announce("Board cleared.");
}

/* ── New game ─────────────────────────────────────────────────── */

function newGame() {
	stopTimer();
	moves = 0;
	matches = 0;
	elapsedSeconds = 0;
	timerStarted = false;
	locked = false;
	resetSelection();
	message.hidden = true;
	board.classList.remove("is-locked");
	renderBoard();
	updateStats();
	updateBestDisplay();
	announce("New memory game ready.");
}

/* ── Wire up events & boot ────────────────────────────────────── */

newGameBtn.addEventListener("click", newGame);
messageNewGameBtn.addEventListener("click", newGame);

newGame();
