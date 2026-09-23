/* Pure 2048 board logic, shared by the client and tests. */

export type Board = number[][];
export type Direction = 'left' | 'right' | 'up' | 'down';

export interface Cell {
	row: number;
	column: number;
}

export interface Transition {
	from: Cell;
	to: Cell;
	value: number;
}

export interface MoveResult {
	board: Board;
	gained: number;
	transitions: Transition[];
	mergedCells: (Cell & { value: number })[];
}

export function createEmptyBoard(size: number): Board {
	return Array.from({ length: size }, () => Array(size).fill(0));
}

export function cloneBoard(source: Board): Board {
	return source.map((row) => [...row]);
}

export function boardsMatch(first: Board, second: Board): boolean {
	return first.every((row, r) => row.every((value, c) => value === second[r][c]));
}

export function highestValue(board: Board): number {
	return Math.max(0, ...board.flat());
}

export function addRandomTile(board: Board, fourChance: number, random = Math.random) {
	const size = board.length;
	const emptyCells: [number, number][] = [];
	for (let row = 0; row < size; row += 1) {
		for (let column = 0; column < size; column += 1) {
			if (board[row][column] === 0) emptyCells.push([row, column]);
		}
	}
	if (emptyCells.length === 0) return null;
	const [row, column] = emptyCells[Math.floor(random() * emptyCells.length)];
	const value = random() < 1 - fourChance ? 2 : 4;
	board[row][column] = value;
	return { row, column, value };
}

export function hasAvailableMove(board: Board): boolean {
	const size = board.length;
	for (let row = 0; row < size; row += 1) {
		for (let column = 0; column < size; column += 1) {
			const value = board[row][column];
			if (value === 0) return true;
			if (column < size - 1 && value === board[row][column + 1]) return true;
			if (row < size - 1 && value === board[row + 1][column]) return true;
		}
	}
	return false;
}

function mergeEntries(
	entries: { value: number; row: number; column: number }[],
	size: number,
	destinationForIndex: (index: number) => Cell
) {
	const values: number[] = [];
	const transitions: Transition[] = [];
	const mergedCells: (Cell & { value: number })[] = [];
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
				{ from: { row: first.row, column: first.column }, to, value: first.value },
				{ from: { row: second.row, column: second.column }, to, value: second.value }
			);
			index += 1;
		} else {
			values[destinationIndex] = first.value;
			transitions.push({ from: { row: first.row, column: first.column }, to, value: first.value });
		}
		destinationIndex += 1;
	}

	while (values.length < size) values.push(0);
	return { values, gained, transitions, mergedCells };
}

export function moveBoard(board: Board, direction: Direction): MoveResult {
	const size = board.length;
	const moved = createEmptyBoard(size);
	const transitions: Transition[] = [];
	const mergedCells: (Cell & { value: number })[] = [];
	let gained = 0;
	const reversed = direction === 'right' || direction === 'down';
	const order = Array.from({ length: size }, (_, i) => (reversed ? size - 1 - i : i));
	const lineIndex = (index: number) => (reversed ? size - 1 - index : index);

	for (let line = 0; line < size; line += 1) {
		const horizontal = direction === 'left' || direction === 'right';
		const at = (i: number): Cell =>
			horizontal ? { row: line, column: i } : { row: i, column: line };
		const entries = order
			.map(at)
			.filter(({ row, column }) => board[row][column] !== 0)
			.map(({ row, column }) => ({ value: board[row][column], row, column }));
		const result = mergeEntries(entries, size, (index) => at(lineIndex(index)));

		gained += result.gained;
		transitions.push(...result.transitions);
		mergedCells.push(...result.mergedCells);
		result.values.forEach((value, index) => {
			const { row, column } = at(lineIndex(index));
			moved[row][column] = value;
		});
	}

	return { board: moved, gained, transitions, mergedCells };
}
