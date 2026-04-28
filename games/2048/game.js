/* ──────────────────────────────────────────────────────────────────
   2048 — Self-bootstrapping game module.
   Builds all DOM into #game-container, reads window.__GAME_CONFIG__.
   ────────────────────────────────────────────────────────────────── */

const CFG = Object.assign(
	{
		board_size: 4,
		win_value: 2048,
		four_spawn_chance: 0.1,
		move_duration_ms: 100,
		bg_toggle_default: true,
		win_message: "2048",
		win_copy: "The room is complete.",
		lose_message: "Game over",
		lose_copy: "No more moves.",
		assets: [],
	},
	window.__GAME_CONFIG__ || {},
);

const SIZE = CFG.board_size;
const WIN_VALUE = CFG.win_value;
const MOVE_DURATION = CFG.move_duration_ms;
const FOUR_CHANCE = CFG.four_spawn_chance;

const GIF_VALUES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
const VALUES_WITH_GIFS = new Set(GIF_VALUES);
const TILE_ASSET_MAP = resolveTileAssets();
const STORAGE_KEY = "eva-2048-state";
const BEST_KEY = "eva-2048-best";
const BG_KEY = "eva-2048-bg";

/* ── DOM construction ─────────────────────────────────────────── */

function buildUI() {
	const container = document.getElementById("game-container");
	if (!container) {
		console.error("2048: #game-container not found");
		return null;
	}

	container.innerHTML = `
		<div class="scorebar">
			<div class="scorebox">
				<span>Score</span>
				<strong id="score">0</strong>
			</div>
			<div class="scorebox">
				<span>Best</span>
				<strong id="best-score">0</strong>
			</div>
		</div>
		<div class="controls">
			<button class="control-button" id="new-game" type="button">New game</button>
			<label class="control-button bg-toggle" id="bg-toggle-label">
				<input type="checkbox" id="bg-toggle" />
				<span>BG on</span>
			</label>
		</div>
		<div class="board-wrap" id="board-wrap">
			<div class="game-board" id="game-board" tabindex="0" role="grid"
				 style="grid-template-columns: repeat(${SIZE}, minmax(0, 1fr));"
				 aria-label="2048 game board"></div>
			<div class="game-message" id="game-message" hidden>
				<p id="message-title"></p>
				<span id="message-copy"></span>
				<button class="control-button" id="message-new-game" type="button">Play again</button>
			</div>
		</div>`;

	return {
		boardElement: container.querySelector("#game-board"),
		boardWrap: container.querySelector("#board-wrap"),
		scoreElement: container.querySelector("#score"),
		bestElement: container.querySelector("#best-score"),
		newGameButton: container.querySelector("#new-game"),
		messageNewGameButton: container.querySelector("#message-new-game"),
		message: container.querySelector("#game-message"),
		messageTitle: container.querySelector("#message-title"),
		messageCopy: container.querySelector("#message-copy"),
		bgToggle: container.querySelector("#bg-toggle"),
	};
}

const dom = buildUI();
if (!dom) throw new Error("2048: failed to build UI");

const {
	boardElement,
	boardWrap,
	scoreElement,
	bestElement,
	newGameButton,
	messageNewGameButton,
	message,
	messageTitle,
	messageCopy,
	bgToggle,
} = dom;

/* ── State ────────────────────────────────────────────────────── */

let board = createEmptyBoard();
let score = 0;
let best = Number(localStorage.getItem(BEST_KEY)) || 0;
let ended = false;
let animating = false;
let disableTileArrival = false;
let animationTimer = 0;
let touchStart = null;
const preloadedGifImages = [];

/* ── Board helpers ────────────────────────────────────────────── */

function createEmptyBoard() {
	return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function cloneBoard(source) {
	return source.map((row) => [...row]);
}

function resolveTileAssets() {
	const map = new Map();
	if (!Array.isArray(CFG.assets)) return map;
	for (const asset of CFG.assets) {
		if (asset.slot !== "tile_gif" || !asset.file) continue;
		const match = String(asset.file).match(/^(\d+)\.[a-z0-9]+$/i);
		if (match) map.set(Number(match[1]), asset.file);
	}
	return map;
}

function gifPath(value) {
	const cappedValue = Math.min(value, WIN_VALUE);
	const uploaded = TILE_ASSET_MAP.get(cappedValue);
	if (uploaded) return `assets/${uploaded}`;
	return VALUES_WITH_GIFS.has(cappedValue) ? `assets/${cappedValue}.gif` : "";
}

function tileGif(value) {
	const path = gifPath(value);
	return path ? `url("${path}")` : "none";
}

function preloadGifs() {
	const preloadShelf = document.createElement("div");
	preloadShelf.className = "gif-preload";
	preloadShelf.setAttribute("aria-hidden", "true");
	document.body.append(preloadShelf);

	for (const value of GIF_VALUES) {
		const image = new Image();
		image.alt = "";
		image.decoding = "sync";
		image.fetchPriority = "high";
		image.loading = "eager";
		image.src = gifPath(value);
		preloadShelf.append(image);
		preloadedGifImages.push(image);
	}
}

function highestValue() {
	return Math.max(0, ...board.flat());
}

function highestGifValue() {
	const highest = highestValue();
	if (highest < 2) return 2;
	return Math.min(highest, WIN_VALUE);
}

/* ── Persistence ──────────────────────────────────────────────── */

function loadState() {
	const savedBest = Number(localStorage.getItem(BEST_KEY));
	best = Number.isFinite(savedBest) ? savedBest : 0;

	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
		if (isValidState(saved)) {
			board = saved.board;
			score = saved.score;
			ended = saved.ended;
			best = Math.max(best, saved.best || 0, score);
			return true;
		}
	} catch {
		/* Start fresh if the save is unreadable. */
	}

	startNewGame(false);
	return false;
}

function isValidState(state) {
	return (
		state &&
		Array.isArray(state.board) &&
		state.board.length === SIZE &&
		state.board.every(
			(row) =>
				Array.isArray(row) &&
				row.length === SIZE &&
				row.every((value) => Number.isInteger(value) && value >= 0),
		) &&
		Number.isInteger(state.score) &&
		typeof state.ended === "boolean"
	);
}

function saveState() {
	localStorage.setItem(
		STORAGE_KEY,
		JSON.stringify({ board, score, best, ended }),
	);
	localStorage.setItem(BEST_KEY, String(best));
}

/* ── Game logic ───────────────────────────────────────────────── */

function startNewGame(shouldFocus = true) {
	clearAnimation();
	board = createEmptyBoard();
	score = 0;
	ended = false;
	const newCells = [addRandomTile(), addRandomTile()].filter(Boolean);
	updateBest();
	saveState();
	render({ newCells });
	if (shouldFocus) boardElement.focus();
}

function updateBest() {
	best = Math.max(best, score);
}

function addRandomTile() {
	const emptyCells = [];
	for (let row = 0; row < SIZE; row += 1) {
		for (let column = 0; column < SIZE; column += 1) {
			if (board[row][column] === 0) emptyCells.push([row, column]);
		}
	}

	if (emptyCells.length === 0) return null;
	const [row, column] =
		emptyCells[Math.floor(Math.random() * emptyCells.length)];
	const value = Math.random() < 1 - FOUR_CHANCE ? 2 : 4;
	board[row][column] = value;
	return { row, column, value };
}

function move(direction) {
	if (ended) return;
	if (animating) finishAnimation();

	const previous = cloneBoard(board);
	let result;

	if (direction === "left" || direction === "right") {
		result = moveRows(direction);
	} else {
		result = moveColumns(direction);
	}

	if (boardsMatch(previous, result.board)) return;

	board = result.board;
	score += result.gained;
	updateBest();

	let spawnedTile = null;
	if (highestValue() >= WIN_VALUE) {
		ended = true;
	} else {
		spawnedTile = addRandomTile();

		if (!hasAvailableMove()) {
			ended = true;
		}
	}

	saveState();
	animateMove(result.transitions, {
		newCells: spawnedTile ? [spawnedTile] : [],
		mergedCells: result.mergedCells,
		scoreDelta: result.gained,
	});
}

function moveRows(direction) {
	const movedBoard = createEmptyBoard();
	const transitions = [];
	const mergedCells = [];
	let gained = 0;

	for (let row = 0; row < SIZE; row += 1) {
		const columns =
			direction === "right"
				? Array.from({ length: SIZE }, (_, i) => SIZE - 1 - i)
				: Array.from({ length: SIZE }, (_, i) => i);
		const entries = columns
			.filter((column) => board[row][column] !== 0)
			.map((column) => ({ value: board[row][column], row, column }));
		const result = mergeEntries(entries, (index) => ({
			row,
			column: direction === "right" ? SIZE - 1 - index : index,
		}));

		gained += result.gained;
		transitions.push(...result.transitions);
		mergedCells.push(...result.mergedCells);
		result.values.forEach((value, index) => {
			const column = direction === "right" ? SIZE - 1 - index : index;
			movedBoard[row][column] = value;
		});
	}

	return { board: movedBoard, gained, transitions, mergedCells };
}

function moveColumns(direction) {
	const movedBoard = createEmptyBoard();
	const transitions = [];
	const mergedCells = [];
	let gained = 0;

	for (let column = 0; column < SIZE; column += 1) {
		const rows =
			direction === "down"
				? Array.from({ length: SIZE }, (_, i) => SIZE - 1 - i)
				: Array.from({ length: SIZE }, (_, i) => i);
		const entries = rows
			.filter((row) => board[row][column] !== 0)
			.map((row) => ({ value: board[row][column], row, column }));
		const result = mergeEntries(entries, (index) => ({
			row: direction === "down" ? SIZE - 1 - index : index,
			column,
		}));

		gained += result.gained;
		transitions.push(...result.transitions);
		mergedCells.push(...result.mergedCells);
		result.values.forEach((value, index) => {
			const row = direction === "down" ? SIZE - 1 - index : index;
			movedBoard[row][column] = value;
		});
	}

	return { board: movedBoard, gained, transitions, mergedCells };
}

function mergeEntries(entries, destinationForIndex) {
	const values = [];
	const transitions = [];
	const mergedCells = [];
	let gained = 0;
	let destinationIndex = 0;

	for (let index = 0; index < entries.length; index += 1) {
		const first = entries[index];
		const second = entries[index + 1];
		const to = destinationForIndex(destinationIndex);

		if (second && first.value === second.value) {
			const value = first.value * 2;
			values[destinationIndex] = value;
			mergedCells.push({ ...to, value });
			gained += value;
			transitions.push(
				{
					from: { row: first.row, column: first.column },
					to,
					value: first.value,
				},
				{
					from: { row: second.row, column: second.column },
					to,
					value: second.value,
				},
			);
			index += 1;
		} else {
			values[destinationIndex] = first.value;
			transitions.push({
				from: { row: first.row, column: first.column },
				to,
				value: first.value,
			});
		}

		destinationIndex += 1;
	}

	while (values.length < SIZE) values.push(0);
	return { values, gained, transitions, mergedCells };
}

function boardsMatch(first, second) {
	return first.every((row, rowIndex) =>
		row.every((value, columnIndex) => value === second[rowIndex][columnIndex]),
	);
}

function hasAvailableMove() {
	for (let row = 0; row < SIZE; row += 1) {
		for (let column = 0; column < SIZE; column += 1) {
			const value = board[row][column];
			if (value === 0) return true;
			if (column < SIZE - 1 && value === board[row][column + 1]) return true;
			if (row < SIZE - 1 && value === board[row + 1][column]) return true;
		}
	}
	return false;
}

/* ── Rendering ────────────────────────────────────────────────── */

function cellKey(row, column) {
	return `${row}:${column}`;
}

function render({ newCells = [], mergedCells = [], scoreDelta = 0 } = {}) {
	const newCellKeys = new Set(
		newCells.map((cell) => cellKey(cell.row, cell.column)),
	);
	const mergedCellKeys = new Set(
		mergedCells.map((cell) => cellKey(cell.row, cell.column)),
	);

	boardElement.replaceChildren();

	for (let row = 0; row < SIZE; row += 1) {
		for (let column = 0; column < SIZE; column += 1) {
			const cell = document.createElement("div");
			cell.className = "cell";
			cell.setAttribute("aria-label", tileLabel(row, column));

			const value = board[row][column];
			if (value) {
				const tile = document.createElement("span");
				const classes = ["tile"];
				const key = cellKey(row, column);

				if (disableTileArrival) {
					classes.push("tile-settled");
				} else if (mergedCellKeys.has(key)) {
					classes.push("tile-merged");
				} else if (newCellKeys.has(key)) {
					classes.push("tile-new");
				}

				tile.className = classes.join(" ");
				tile.dataset.value = String(value);
				tile.style.setProperty("--tile-gif", tileGif(value));
				cell.append(tile);
			}

			boardElement.append(cell);
		}
	}

	scoreElement.textContent = String(score);
	if (!disableTileArrival && scoreDelta > 0) {
		const addition = document.createElement("span");
		addition.className = "score-addition";
		addition.textContent = `+${scoreDelta}`;
		scoreElement.append(addition);
	}
	bestElement.textContent = String(best);
	updateBackground();
	updateMessage();
}

/* ── Animation ────────────────────────────────────────────────── */

function animateMove(transitions, renderOptions) {
	const reduceMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;
	const boardRect = boardElement.getBoundingClientRect();

	if (reduceMotion || transitions.length === 0 || boardRect.width === 0) {
		disableTileArrival = true;
		render();
		disableTileArrival = false;
		return;
	}

	clearAnimation();
	animating = true;
	render(renderOptions);
	boardElement.classList.add("animating");

	const layer = document.createElement("div");
	layer.className = "tile-layer";
	boardWrap.append(layer);

	const cellWidth = boardRect.width / SIZE;
	const cellHeight = boardRect.height / SIZE;
	const clones = transitions.map((transition) => {
		const tile = document.createElement("span");
		tile.className = "tile tile-clone";
		tile.dataset.value = String(transition.value);
		tile.style.setProperty("--tile-gif", tileGif(transition.value));
		tile.style.setProperty("--from-column", transition.from.column);
		tile.style.setProperty("--from-row", transition.from.row);
		tile.style.setProperty(
			"--move-x",
			`${(transition.to.column - transition.from.column) * cellWidth}px`,
		);
		tile.style.setProperty(
			"--move-y",
			`${(transition.to.row - transition.from.row) * cellHeight}px`,
		);
		layer.append(tile);
		return tile;
	});

	requestAnimationFrame(() => {
		for (const tile of clones) tile.classList.add("is-moving");
	});

	animationTimer = window.setTimeout(() => {
		animationTimer = 0;
		clearAnimation();
	}, MOVE_DURATION + 24);
}

function finishAnimation() {
	if (!animating) return;
	disableTileArrival = true;
	render();
	disableTileArrival = false;
	clearAnimation();
}

function clearAnimation() {
	if (animationTimer) {
		window.clearTimeout(animationTimer);
		animationTimer = 0;
	}
	for (const layer of boardWrap.querySelectorAll(".tile-layer")) layer.remove();
	boardElement.classList.remove("animating");
	animating = false;
}

function tileLabel(row, column) {
	const value = board[row][column];
	return value
		? `Row ${row + 1}, column ${column + 1}, ${value}`
		: `Row ${row + 1}, column ${column + 1}, empty`;
}

function updateMessage() {
	if (!ended) {
		message.hidden = true;
		return;
	}

	const won = highestValue() >= WIN_VALUE;
	messageTitle.textContent = won ? CFG.win_message : CFG.lose_message;
	messageCopy.textContent = won ? CFG.win_copy : CFG.lose_copy;
	message.hidden = false;
}

function updateBackground() {
	boardWrap.style.setProperty("--highest-gif", tileGif(highestGifValue()));
}

function setBackgroundEnabled(enabled) {
	document.body.classList.toggle("bg-on", enabled);
	bgToggle.checked = enabled;
	bgToggle.nextElementSibling.textContent = enabled ? "BG on" : "BG off";
	localStorage.setItem(BG_KEY, enabled ? "1" : "0");
}

/* ── Input handling ───────────────────────────────────────────── */

function handleKeydown(event) {
	const directionKeys = {
		ArrowLeft: "left",
		ArrowRight: "right",
		ArrowUp: "up",
		ArrowDown: "down",
		a: "left",
		d: "right",
		w: "up",
		s: "down",
		A: "left",
		D: "right",
		W: "up",
		S: "down",
	};
	const direction = directionKeys[event.key];
	if (!direction) return;
	event.preventDefault();
	move(direction);
}

function handleTouchStart(event) {
	const touch = event.changedTouches[0];
	touchStart = { x: touch.clientX, y: touch.clientY };
}

function handleTouchEnd(event) {
	if (!touchStart) return;
	const touch = event.changedTouches[0];
	const deltaX = touch.clientX - touchStart.x;
	const deltaY = touch.clientY - touchStart.y;
	const threshold = 30;
	touchStart = null;

	if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < threshold) return;
	event.preventDefault();
	if (Math.abs(deltaX) > Math.abs(deltaY)) {
		move(deltaX > 0 ? "right" : "left");
	} else {
		move(deltaY > 0 ? "down" : "up");
	}
}

/* ── Wire up events & boot ────────────────────────────────────── */

newGameButton.addEventListener("click", () => startNewGame());
messageNewGameButton.addEventListener("click", () => startNewGame());
bgToggle.addEventListener("change", () =>
	setBackgroundEnabled(bgToggle.checked),
);
document.addEventListener("keydown", handleKeydown);
boardElement.addEventListener("touchstart", handleTouchStart, {
	passive: true,
});
boardElement.addEventListener("touchend", handleTouchEnd, { passive: false });

preloadGifs();
setBackgroundEnabled(
	localStorage.getItem(BG_KEY) !== null
		? localStorage.getItem(BG_KEY) !== "0"
		: CFG.bg_toggle_default,
);
if (loadState()) render();
