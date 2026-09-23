/* 2048 — ported from the original self-bootstrapping game.js.
   Rendering and animation timing are unchanged; state now lives per mount
   and round results are reported through the play session. */

import type { GameClient } from '../sdk/types';
import { defaultTileUrl, type Config2048, type Result2048 } from './manifest';
import {
	addRandomTile,
	boardsMatch,
	cloneBoard,
	createEmptyBoard,
	hasAvailableMove,
	highestValue,
	moveBoard,
	type Board,
	type Cell,
	type Direction,
	type Transition
} from './logic';
import './styles.css';

const GIF_VALUES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
const INITIAL_GIF_VALUES = [2, 4, 8];

interface SavedState {
	board: Board;
	score: number;
	best: number;
	ended: boolean;
	moves: number;
}

interface RenderOptions {
	newCells?: Cell[];
	mergedCells?: Cell[];
	scoreDelta?: number;
}

const DIRECTION_KEYS: Record<string, Direction> = {
	ArrowLeft: 'left',
	ArrowRight: 'right',
	ArrowUp: 'up',
	ArrowDown: 'down',
	a: 'left',
	d: 'right',
	w: 'up',
	s: 'down',
	A: 'left',
	D: 'right',
	W: 'up',
	S: 'down'
};

export const client2048: GameClient<Config2048, Result2048> = {
	legacyStorage: { state: 'eva-2048-state', best: 'eva-2048-best', bg: 'eva-2048-bg' },
	mount(container, { config: CFG, session, storage }) {
		const SIZE = CFG.boardSize;
		const WIN_VALUE = CFG.winValue;
		const MOVE_DURATION = CFG.moveDurationMs;

		container.classList.add('g2048');
		container.innerHTML = `
			<div class="scorebar">
				<div class="scorebox"><span>Score</span><strong data-ref="score">0</strong></div>
				<div class="scorebox"><span>Best</span><strong data-ref="best">0</strong></div>
			</div>
			<div class="controls">
				<button class="control-button" data-ref="new-game" type="button">New game</button>
				<label class="control-button bg-toggle">
					<input type="checkbox" data-ref="bg-toggle" />
					<span>BG on</span>
				</label>
			</div>
			<div class="board-wrap" data-ref="board-wrap">
				<div class="game-board" data-ref="board" tabindex="0" role="grid"
					 style="grid-template-columns: repeat(${SIZE}, minmax(0, 1fr));"
					 aria-label="2048 game board"></div>
				<div class="tile-layer" data-ref="tile-layer" aria-hidden="true"></div>
				<div class="game-message" data-ref="message" hidden>
					<p data-ref="message-title"></p>
					<span data-ref="message-copy"></span>
					<button class="control-button" data-ref="message-new-game" type="button">Play again</button>
				</div>
			</div>`;

		const ref = <T extends HTMLElement>(name: string) =>
			container.querySelector<T>(`[data-ref="${name}"]`)!;
		const boardElement = ref<HTMLDivElement>('board');
		const boardWrap = ref<HTMLDivElement>('board-wrap');
		const tileLayer = ref<HTMLDivElement>('tile-layer');
		const scoreElement = ref('score');
		const bestElement = ref('best');
		const newGameButton = ref<HTMLButtonElement>('new-game');
		const messageNewGameButton = ref<HTMLButtonElement>('message-new-game');
		const message = ref('message');
		const messageTitle = ref('message-title');
		const messageCopy = ref('message-copy');
		const bgToggle = ref<HTMLInputElement>('bg-toggle');

		/* ── State ──────────────────────────────────────────────── */

		let board = createEmptyBoard(SIZE);
		let score = 0;
		let moves = 0;
		let best = storage.get<number>('best') ?? 0;
		let ended = false;
		let reported = false;
		let animating = false;
		let disableTileArrival = false;
		let animationTimer = 0;
		let queuedDirection: Direction | null = null;
		let touchStart: { x: number; y: number } | null = null;
		let destroyed = false;
		const gridCells: HTMLDivElement[][] = [];

		/* ── Assets ─────────────────────────────────────────────── */

		function gifPath(value: number) {
			const capped = Math.min(value, WIN_VALUE);
			return CFG.tiles[String(capped)] || defaultTileUrl(capped);
		}

		function tileGif(value: number) {
			const path = gifPath(value);
			return path ? `url("${path}")` : 'none';
		}

		function preloadGifs() {
			const preloadValue = (value: number | undefined) => {
				if (value === undefined) return;
				const path = gifPath(value);
				if (!path) return;
				fetch(path, { cache: 'force-cache' }).catch(() => {
					/* Visible tiles still load normally if cache warming fails. */
				});
			};

			INITIAL_GIF_VALUES.forEach(preloadValue);
			const remaining = GIF_VALUES.filter((v) => !INITIAL_GIF_VALUES.includes(v) && v <= WIN_VALUE);
			const scheduleRemaining = () => {
				if (destroyed || remaining.length === 0) return;
				if (typeof window.requestIdleCallback === 'function') {
					window.requestIdleCallback(preloadNext, { timeout: 2200 });
				} else {
					window.setTimeout(preloadNext, 600);
				}
			};
			const preloadNext = () => {
				if (!animating) preloadValue(remaining.shift());
				scheduleRemaining();
			};
			scheduleRemaining();
		}

		function highestGifValue() {
			const highest = highestValue(board);
			if (highest < 2) return 2;
			return Math.min(highest, WIN_VALUE);
		}

		/* ── Persistence ────────────────────────────────────────── */

		function isValidState(state: SavedState | null): state is SavedState {
			return (
				!!state &&
				Array.isArray(state.board) &&
				state.board.length === SIZE &&
				state.board.every(
					(row) =>
						Array.isArray(row) &&
						row.length === SIZE &&
						row.every((v) => Number.isInteger(v) && v >= 0)
				) &&
				Number.isInteger(state.score) &&
				typeof state.ended === 'boolean'
			);
		}

		function loadState() {
			const saved = storage.get<SavedState>('state');
			if (isValidState(saved)) {
				board = saved.board;
				score = saved.score;
				ended = saved.ended;
				moves = Number.isInteger(saved.moves) ? saved.moves : 0;
				best = Math.max(best, saved.best || 0, score);
				// A finished board was already reported (or can't be any more).
				reported = ended;
				return true;
			}
			startNewGame(false);
			return false;
		}

		function saveState() {
			storage.set('state', { board, score, best, ended, moves } satisfies SavedState);
			storage.set('best', best);
		}

		/* ── Game logic ─────────────────────────────────────────── */

		function startNewGame(shouldFocus = true) {
			if (!ended && moves > 0) session.reset();
			queuedDirection = null;
			clearAnimation();
			board = createEmptyBoard(SIZE);
			score = 0;
			moves = 0;
			ended = false;
			reported = false;
			const newCells = [
				addRandomTile(board, CFG.fourSpawnChance),
				addRandomTile(board, CFG.fourSpawnChance)
			].filter((c) => c !== null);
			best = Math.max(best, score);
			saveState();
			render({ newCells });
			if (shouldFocus) boardElement.focus();
		}

		function move(direction: Direction) {
			if (ended) return;
			if (animating) {
				queuedDirection = direction;
				return;
			}

			const previous = cloneBoard(board);
			const result = moveBoard(board, direction);
			if (boardsMatch(previous, result.board)) return;

			session.begin();
			board = result.board;
			score += result.gained;
			moves += 1;
			best = Math.max(best, score);

			let spawnedTile = null;
			if (highestValue(board) >= WIN_VALUE) {
				ended = true;
			} else {
				spawnedTile = addRandomTile(board, CFG.fourSpawnChance);
				if (!hasAvailableMove(board)) ended = true;
			}

			saveState();
			if (ended) reportRound();
			animateMove(result.transitions, {
				newCells: spawnedTile ? [spawnedTile] : [],
				mergedCells: result.mergedCells,
				scoreDelta: result.gained
			});
		}

		function reportRound() {
			if (reported) return;
			reported = true;
			const highestTile = highestValue(board);
			void session.finish({ score, highestTile, moves, won: highestTile >= WIN_VALUE });
		}

		/* ── Rendering ──────────────────────────────────────────── */

		const cellKey = (row: number, column: number) => `${row}:${column}`;

		function buildBoardGrid() {
			boardElement.replaceChildren();
			gridCells.length = 0;
			for (let row = 0; row < SIZE; row += 1) {
				const rowCells: HTMLDivElement[] = [];
				for (let column = 0; column < SIZE; column += 1) {
					const cell = document.createElement('div');
					cell.className = 'cell';
					cell.setAttribute('role', 'gridcell');
					boardElement.appendChild(cell);
					rowCells.push(cell);
				}
				gridCells.push(rowCells);
			}
			tileLayer.style.setProperty('--board-size', String(SIZE));
		}

		function tileLabel(row: number, column: number) {
			const value = board[row][column];
			return value
				? `Row ${row + 1}, column ${column + 1}, ${value}`
				: `Row ${row + 1}, column ${column + 1}, empty`;
		}

		function updateCells() {
			for (let row = 0; row < SIZE; row += 1) {
				for (let column = 0; column < SIZE; column += 1) {
					gridCells[row][column].setAttribute('aria-label', tileLabel(row, column));
				}
			}
		}

		function createTileElement(value: number, extraClasses: string[] = []) {
			const tile = document.createElement('span');
			tile.className = ['tile', ...extraClasses].join(' ');
			tile.dataset.value = String(value);
			tile.style.setProperty('--move-duration', `${MOVE_DURATION}ms`);

			const path = gifPath(value);
			if (path) {
				const image = document.createElement('img');
				image.className = 'tile-image';
				image.alt = '';
				image.decoding = 'async';
				image.draggable = false;
				image.src = path;
				tile.appendChild(image);
			}
			return tile;
		}

		function positionTile(tile: HTMLElement, row: number, column: number) {
			const cellSize = 100 / SIZE;
			tile.style.left = `calc(${column * cellSize}% + var(--tile-gap))`;
			tile.style.top = `calc(${row * cellSize}% + var(--tile-gap))`;
			tile.style.width = `calc(${cellSize}% - (var(--tile-gap) * 2))`;
			tile.style.height = `calc(${cellSize}% - (var(--tile-gap) * 2))`;
		}

		function renderTiles(newCellKeys: Set<string>, mergedCellKeys: Set<string>) {
			tileLayer.replaceChildren();
			for (let row = 0; row < SIZE; row += 1) {
				for (let column = 0; column < SIZE; column += 1) {
					const value = board[row][column];
					if (!value) continue;
					const classes: string[] = [];
					const key = cellKey(row, column);
					if (disableTileArrival) classes.push('tile-settled');
					else if (mergedCellKeys.has(key)) classes.push('tile-merged');
					else if (newCellKeys.has(key)) classes.push('tile-new');
					const tile = createTileElement(value, classes);
					positionTile(tile, row, column);
					tileLayer.appendChild(tile);
				}
			}
		}

		function updateBoardChrome(scoreDelta = 0) {
			scoreElement.textContent = String(score);
			if (!disableTileArrival && scoreDelta > 0) {
				const addition = document.createElement('span');
				addition.className = 'score-addition';
				addition.textContent = `+${scoreDelta}`;
				scoreElement.appendChild(addition);
			}
			bestElement.textContent = String(best);
			if (!animating) {
				updateBackground();
				updateMessage();
			}
		}

		function render({ newCells = [], mergedCells = [], scoreDelta = 0 }: RenderOptions = {}) {
			const newCellKeys = new Set(newCells.map((c) => cellKey(c.row, c.column)));
			const mergedCellKeys = new Set(mergedCells.map((c) => cellKey(c.row, c.column)));
			updateCells();
			renderTiles(newCellKeys, mergedCellKeys);
			updateBoardChrome(scoreDelta);
		}

		/* ── Animation ──────────────────────────────────────────── */

		function animateMove(transitions: Transition[], renderOptions: RenderOptions) {
			const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			const boardRect = boardElement.getBoundingClientRect();

			if (reduceMotion || transitions.length === 0 || boardRect.width === 0) {
				disableTileArrival = true;
				render(renderOptions);
				disableTileArrival = false;
				return;
			}

			clearAnimation();
			animating = true;
			boardWrap.classList.add('animating');
			updateCells();
			updateBoardChrome(renderOptions.scoreDelta);
			tileLayer.replaceChildren();

			const cellWidth = boardRect.width / SIZE;
			const cellHeight = boardRect.height / SIZE;
			const tiles = transitions.map((transition) => {
				const isMoving =
					transition.from.row !== transition.to.row ||
					transition.from.column !== transition.to.column;
				const tile = createTileElement(transition.value, ['tile-moving']);
				if (isMoving) tile.dataset.moving = 'true';
				positionTile(tile, transition.from.row, transition.from.column);
				tile.style.setProperty(
					'--move-x',
					`${(transition.to.column - transition.from.column) * cellWidth}px`
				);
				tile.style.setProperty(
					'--move-y',
					`${(transition.to.row - transition.from.row) * cellHeight}px`
				);
				tileLayer.appendChild(tile);
				return tile;
			});

			const movingTiles = tiles.filter((tile) => tile.dataset.moving === 'true');
			let remainingMoves = movingTiles.length;

			const finishOnce = () => {
				if (!animating) return;
				if (animationTimer) {
					window.clearTimeout(animationTimer);
					animationTimer = 0;
				}
				clearAnimation();
				render({ ...renderOptions, scoreDelta: 0 });
				playQueuedMove();
			};

			for (const tile of movingTiles) {
				tile.addEventListener(
					'transitionend',
					(event) => {
						if (event.propertyName !== 'transform') return;
						remainingMoves -= 1;
						if (remainingMoves === 0) finishOnce();
					},
					{ once: true }
				);
			}

			// Force the browser to commit starting positions before applying transform.
			// Without this, fast input / busy frames can coalesce start + end styles and jump.
			tileLayer.getBoundingClientRect();
			requestAnimationFrame(() => {
				for (const tile of tiles) tile.classList.add('is-moving');
			});

			animationTimer = window.setTimeout(finishOnce, MOVE_DURATION + 80);
		}

		function playQueuedMove() {
			const direction = queuedDirection;
			queuedDirection = null;
			if (direction) requestAnimationFrame(() => move(direction));
		}

		function clearAnimation() {
			if (animationTimer) {
				window.clearTimeout(animationTimer);
				animationTimer = 0;
			}
			tileLayer.replaceChildren();
			boardWrap.classList.remove('animating');
			animating = false;
		}

		function updateMessage() {
			if (!ended) {
				message.hidden = true;
				return;
			}
			const won = highestValue(board) >= WIN_VALUE;
			messageTitle.textContent = won ? CFG.winMessage : CFG.loseMessage;
			messageCopy.textContent = won ? CFG.winCopy : CFG.loseCopy;
			message.hidden = false;
		}

		function updateBackground() {
			boardWrap.style.setProperty('--highest-gif', tileGif(highestGifValue()));
		}

		function setBackgroundEnabled(enabled: boolean) {
			container.classList.toggle('bg-on', enabled);
			bgToggle.checked = enabled;
			bgToggle.nextElementSibling!.textContent = enabled ? 'BG on' : 'BG off';
			storage.set('bg', enabled);
		}

		/* ── Input ──────────────────────────────────────────────── */

		function handleKeydown(event: KeyboardEvent) {
			const direction = DIRECTION_KEYS[event.key];
			if (!direction) return;
			// Don't hijack typing in form fields elsewhere on the page.
			const target = event.target;
			if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]'))
				return;
			event.preventDefault();
			move(direction);
		}

		function handleTouchStart(event: TouchEvent) {
			const touch = event.changedTouches[0];
			touchStart = { x: touch.clientX, y: touch.clientY };
		}

		function handleTouchEnd(event: TouchEvent) {
			if (!touchStart) return;
			const touch = event.changedTouches[0];
			const deltaX = touch.clientX - touchStart.x;
			const deltaY = touch.clientY - touchStart.y;
			touchStart = null;
			if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 30) return;
			event.preventDefault();
			if (Math.abs(deltaX) > Math.abs(deltaY)) move(deltaX > 0 ? 'right' : 'left');
			else move(deltaY > 0 ? 'down' : 'up');
		}

		/* ── Boot ───────────────────────────────────────────────── */

		const onNewGame = () => startNewGame();
		const onBgChange = () => setBackgroundEnabled(bgToggle.checked);
		newGameButton.addEventListener('click', onNewGame);
		messageNewGameButton.addEventListener('click', onNewGame);
		bgToggle.addEventListener('change', onBgChange);
		document.addEventListener('keydown', handleKeydown);
		boardElement.addEventListener('touchstart', handleTouchStart, { passive: true });
		boardElement.addEventListener('touchend', handleTouchEnd, { passive: false });

		buildBoardGrid();
		const savedBg = storage.get<boolean | number>('bg');
		setBackgroundEnabled(savedBg === null ? CFG.backgroundDefault : Boolean(savedBg));
		if (loadState()) render();
		requestAnimationFrame(preloadGifs);

		return {
			destroy() {
				destroyed = true;
				clearAnimation();
				document.removeEventListener('keydown', handleKeydown);
				container.replaceChildren();
				container.classList.remove('g2048', 'bg-on');
			}
		};
	}
};
