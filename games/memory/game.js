const CARD_IMAGE_POOL = [
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

const PAIRS = 8;
const BEST_KEY = "eva-memory-best-v1";
const FLIP_BACK_DELAY = 760;

const board = document.querySelector("#memory-board");
const movesEl = document.querySelector("#moves");
const matchesEl = document.querySelector("#matches");
const timerEl = document.querySelector("#timer");
const bestScoreEl = document.querySelector("#best-score");
const newGameButton = document.querySelector("#new-game");
const message = document.querySelector("#game-message");
const messageCopy = document.querySelector("#message-copy");
const messageNewGameButton = document.querySelector("#message-new-game");
const statusEl = document.querySelector("#memory-status");

let cards = [];
let firstCard = null;
let secondCard = null;
let moves = 0;
let matches = 0;
let locked = false;
let timerStarted = false;
let elapsedSeconds = 0;
let timerId = null;

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
	mark.textContent = "E";
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
	messageNewGameButton.focus({ preventScroll: true });
	announce("Board cleared.");
}

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

newGameButton.addEventListener("click", newGame);
messageNewGameButton.addEventListener("click", newGame);

newGame();
