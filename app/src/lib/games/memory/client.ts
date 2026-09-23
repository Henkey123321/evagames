/* Memory — ported from the original self-bootstrapping game.js.
   Same board, flip timing and best-score rules; results go through the play session. */

import type { GameClient } from '../sdk/types';
import { DEFAULT_CARD_IMAGES, type ConfigMemory, type ResultMemory } from './manifest';
import './styles.css';

interface Best {
	moves: number;
	time: number;
}

function shuffle<T>(items: T[]): T[] {
	return [...items]
		.map((item) => ({ item, order: Math.random() }))
		.sort((a, b) => a.order - b.order)
		.map(({ item }) => item);
}

function formatTime(totalSeconds: number) {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function isBetterScore(score: Best, best: Best | null) {
	return (
		!best || score.moves < best.moves || (score.moves === best.moves && score.time < best.time)
	);
}

const preloaded = new Map<string, HTMLImageElement>();

export const clientMemory: GameClient<ConfigMemory, ResultMemory> = {
	legacyStorage: { best: 'eva-memory-best-v1' },
	mount(container, { config: CFG, session, storage }) {
		const PAIRS = CFG.pairs;
		const POOL = CFG.images.length > 0 ? CFG.images : DEFAULT_CARD_IMAGES;

		const totalCards = PAIRS * 2;
		const cols = Math.ceil(Math.sqrt(totalCards));
		const rows = Math.ceil(totalCards / cols);

		container.classList.add('gmemory');
		container.innerHTML = `
			<div class="scorebar">
				<div class="scorebox"><span>Moves</span><strong data-ref="moves">0</strong></div>
				<div class="scorebox"><span>Matches</span><strong data-ref="matches">0/${PAIRS}</strong></div>
				<div class="scorebox"><span>Time</span><strong data-ref="timer">0:00</strong></div>
				<div class="scorebox scorebox-best"><span>Best</span><strong data-ref="best">None</strong></div>
			</div>
			<div class="controls">
				<button class="control-button" data-ref="new-game" type="button">New game</button>
			</div>
			<div class="board-wrap">
				<div class="memory-board" data-ref="board" role="grid" aria-label="Memory game board"
					style="grid-template-columns: repeat(${cols}, minmax(0, 1fr)); grid-template-rows: repeat(${rows}, minmax(0, 1fr));"></div>
				<div class="game-message" data-ref="message" hidden>
					<p data-ref="message-title"></p>
					<span data-ref="message-copy"></span>
					<button class="control-button" data-ref="message-new-game" type="button">Play again</button>
				</div>
			</div>
			<div class="sr-only" data-ref="status" aria-live="polite" aria-atomic="true"></div>`;

		const ref = <T extends HTMLElement>(name: string) =>
			container.querySelector<T>(`[data-ref="${name}"]`)!;
		const board = ref('board');
		const movesEl = ref('moves');
		const matchesEl = ref('matches');
		const timerEl = ref('timer');
		const bestScoreEl = ref('best');
		const newGameBtn = ref<HTMLButtonElement>('new-game');
		const message = ref('message');
		const messageCopy = ref('message-copy');
		const messageNewGameBtn = ref<HTMLButtonElement>('message-new-game');
		const statusEl = ref('status');
		ref('message-title').textContent = CFG.winMessage;

		/* ── State ──────────────────────────────────────────────── */

		let cards: HTMLButtonElement[] = [];
		let firstCard: HTMLButtonElement | null = null;
		let secondCard: HTMLButtonElement | null = null;
		let moves = 0;
		let matches = 0;
		let locked = false;
		let timerStarted = false;
		let elapsedSeconds = 0;
		let timerId: number | undefined;
		let roundOver = false;
		const pendingTimeouts = new Set<number>();

		const readBest = () => storage.get<Best>('best');

		function updateBestDisplay() {
			const best = readBest();
			bestScoreEl.textContent = best ? `${best.moves} / ${formatTime(best.time)}` : 'None';
		}

		function updateStats() {
			movesEl.textContent = String(moves);
			matchesEl.textContent = `${matches}/${PAIRS}`;
			timerEl.textContent = formatTime(elapsedSeconds);
		}

		const announce = (text: string) => (statusEl.textContent = text);

		/* ── Timer ──────────────────────────────────────────────── */

		function startTimer() {
			if (timerStarted) return;
			timerStarted = true;
			session.begin();
			timerId = window.setInterval(() => {
				elapsedSeconds += 1;
				timerEl.textContent = formatTime(elapsedSeconds);
			}, 1000);
		}

		function stopTimer() {
			window.clearInterval(timerId);
			timerId = undefined;
		}

		/* ── Cards ──────────────────────────────────────────────── */

		function preloadCardImages(deck: { image: string }[]) {
			for (const src of new Set(deck.map((c) => c.image))) {
				if (preloaded.has(src)) continue;
				const image = new Image();
				image.decoding = 'async';
				image.src = src;
				preloaded.set(src, image);
			}
		}

		function createCard(card: { id: string; image: string }, index: number) {
			const button = document.createElement('button');
			button.className = 'memory-card';
			button.type = 'button';
			button.dataset.cardId = card.id;
			button.setAttribute('aria-label', `Card ${index + 1}, hidden`);

			const inner = document.createElement('span');
			inner.className = 'card-inner';

			const back = document.createElement('span');
			back.className = 'card-face card-back';
			back.setAttribute('aria-hidden', 'true');
			const mark = document.createElement('span');
			mark.className = 'card-mark';
			mark.textContent = CFG.cardBackText;
			back.appendChild(mark);

			const front = document.createElement('span');
			front.className = 'card-face card-front';
			front.setAttribute('aria-hidden', 'true');
			const image = document.createElement('img');
			image.src = card.image;
			image.alt = '';
			image.loading = 'eager';
			image.decoding = 'async';
			image.draggable = false;
			front.appendChild(image);

			inner.appendChild(back);
			inner.appendChild(front);
			button.appendChild(inner);
			button.addEventListener('click', () => revealCard(button));
			return button;
		}

		function buildDeck() {
			const roundImages = shuffle(POOL).slice(0, PAIRS);
			return shuffle(
				roundImages.flatMap((image) => [
					{ id: image, image },
					{ id: image, image }
				])
			);
		}

		function renderBoard() {
			board.replaceChildren();
			const deck = buildDeck();
			preloadCardImages(deck);
			cards = deck.map((card, index) => {
				const element = createCard(card, index);
				board.appendChild(element);
				return element;
			});
		}

		/* ── Interaction ────────────────────────────────────────── */

		function setCardVisible(card: HTMLButtonElement, visible: boolean) {
			const image = card.querySelector('img');
			if (image && (visible || !card.classList.contains('is-matched'))) {
				image.dataset.playing = visible ? 'true' : 'false';
			}
			card.classList.toggle('is-visible', visible);
			const index = cards.indexOf(card) + 1;
			const state = card.classList.contains('is-matched')
				? 'matched'
				: visible
					? 'revealed'
					: 'hidden';
			card.setAttribute('aria-label', `Card ${index}, ${state}`);
		}

		function resetSelection() {
			firstCard = null;
			secondCard = null;
		}

		function setLocked(value: boolean) {
			locked = value;
			board.classList.toggle('is-locked', value);
		}

		function handleMatch(a: HTMLButtonElement, b: HTMLButtonElement) {
			a.classList.add('is-matched');
			b.classList.add('is-matched');
			a.disabled = true;
			b.disabled = true;
			setCardVisible(a, true);
			setCardVisible(b, true);
			matches += 1;
			updateStats();
			announce(`Matched ${matches} of ${PAIRS}.`);
			resetSelection();
			if (matches === PAIRS) finishGame();
		}

		function handleMiss(a: HTMLButtonElement, b: HTMLButtonElement) {
			setLocked(true);
			const timeout = window.setTimeout(() => {
				pendingTimeouts.delete(timeout);
				if (!a.isConnected || !b.isConnected) return;
				setCardVisible(a, false);
				setCardVisible(b, false);
				resetSelection();
				setLocked(false);
				announce('No match. Try the room again.');
			}, CFG.flipBackDelayMs);
			pendingTimeouts.add(timeout);
		}

		function revealCard(card: HTMLButtonElement) {
			if (locked || card.disabled || card === firstCard || card.classList.contains('is-visible'))
				return;
			startTimer();
			setCardVisible(card, true);

			if (!firstCard) {
				firstCard = card;
				announce('First card revealed. Choose its pair.');
				return;
			}

			secondCard = card;
			moves += 1;
			updateStats();
			if (firstCard.dataset.cardId === secondCard.dataset.cardId)
				handleMatch(firstCard, secondCard);
			else handleMiss(firstCard, secondCard);
		}

		function finishGame() {
			stopTimer();
			roundOver = true;
			const score = { moves, time: elapsedSeconds };
			const improved = isBetterScore(score, readBest());
			if (improved) {
				storage.set('best', score);
				updateBestDisplay();
			}
			messageCopy.textContent = improved
				? `New best: ${moves} moves in ${formatTime(elapsedSeconds)}.`
				: `${moves} moves in ${formatTime(elapsedSeconds)}.`;
			message.hidden = false;
			messageNewGameBtn.focus({ preventScroll: true });
			announce('Board cleared.');
			void session.finish({ moves, timeSeconds: elapsedSeconds, pairs: PAIRS, cleared: true });
		}

		function newGame() {
			if (timerStarted && !roundOver) session.reset();
			stopTimer();
			pendingTimeouts.forEach((t) => window.clearTimeout(t));
			pendingTimeouts.clear();
			moves = 0;
			matches = 0;
			elapsedSeconds = 0;
			timerStarted = false;
			roundOver = false;
			resetSelection();
			setLocked(false);
			message.hidden = true;
			renderBoard();
			updateStats();
			updateBestDisplay();
			announce('New memory game ready.');
		}

		newGameBtn.addEventListener('click', newGame);
		messageNewGameBtn.addEventListener('click', newGame);
		newGame();

		return {
			destroy() {
				stopTimer();
				pendingTimeouts.forEach((t) => window.clearTimeout(t));
				container.replaceChildren();
				container.classList.remove('gmemory');
			}
		};
	}
};
