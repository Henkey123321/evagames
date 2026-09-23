import { describe, expect, it } from 'vitest';
import { hasAvailableMove, moveBoard } from './logic';

const empty = () => [0, 0, 0, 0];

describe('2048 moves', () => {
	it('slides and merges left, one merge per tile', () => {
		const { board, gained } = moveBoard(
			[
				[2, 2, 2, 2],
				[4, 0, 4, 8],
				[0, 0, 0, 2],
				[2, 4, 8, 16]
			],
			'left'
		);
		expect(board).toEqual([
			[4, 4, 0, 0],
			[8, 8, 0, 0],
			[2, 0, 0, 0],
			[2, 4, 8, 16]
		]);
		expect(gained).toBe(4 + 4 + 8);
	});

	it('merges toward the move direction first', () => {
		const { board } = moveBoard([[2, 2, 2, 0], empty(), empty(), empty()], 'right');
		expect(board[0]).toEqual([0, 0, 2, 4]);
	});

	it('moves columns up and down', () => {
		const board = [[2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], empty()];
		expect(moveBoard(board, 'up').board.map((r) => r[0])).toEqual([4, 4, 0, 0]);
		expect(moveBoard(board, 'down').board.map((r) => r[0])).toEqual([0, 0, 4, 4]);
	});

	it('reports transitions for every moving tile', () => {
		const { transitions, mergedCells } = moveBoard(
			[[0, 2, 0, 2], empty(), empty(), empty()],
			'left'
		);
		expect(transitions).toEqual([
			{ from: { row: 0, column: 1 }, to: { row: 0, column: 0 }, value: 2 },
			{ from: { row: 0, column: 3 }, to: { row: 0, column: 0 }, value: 2 }
		]);
		expect(mergedCells).toEqual([{ row: 0, column: 0, value: 4 }]);
	});

	it('detects a stuck board', () => {
		expect(
			hasAvailableMove([
				[2, 4],
				[4, 2]
			])
		).toBe(false);
		expect(
			hasAvailableMove([
				[2, 2],
				[4, 8]
			])
		).toBe(true);
	});
});
