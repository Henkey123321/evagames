import { z } from 'zod';
import type { GameManifest } from '../sdk/types';

const TILE_VALUES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048] as const;

export const config2048 = z.object({
	boardSize: z.number().int().min(3).max(6).default(4),
	winValue: z.number().int().min(16).max(8192).default(2048),
	fourSpawnChance: z.number().min(0).max(1).default(0.1),
	moveDurationMs: z.number().int().min(60).max(400).default(150),
	backgroundDefault: z.boolean().default(true),
	winMessage: z.string().max(40).default('2048'),
	winCopy: z.string().max(200).default('The room is complete.'),
	loseMessage: z.string().max(40).default('Game over'),
	loseCopy: z.string().max(200).default('No more moves.'),
	/** Tile value → image URL. Missing values fall back to the bundled GIFs. */
	tiles: z.record(z.string(), z.string()).default({})
});
export type Config2048 = z.infer<typeof config2048>;

export const result2048 = z.object({
	score: z.number().int().min(0),
	highestTile: z.number().int().min(0),
	moves: z.number().int().min(0),
	won: z.boolean()
});
export type Result2048 = z.infer<typeof result2048>;

export const defaultTileUrl = (value: number) =>
	(TILE_VALUES as readonly number[]).includes(value) ? `/games/2048/tiles/${value}.gif` : '';

const isPowerOfTwo = (n: number) => n > 0 && (n & (n - 1)) === 0;

export const manifest2048: GameManifest<Config2048, Result2048> = {
	type: '2048',
	name: '2048',
	description: 'Slide and merge tiles until you reach the target tile.',
	configSchema: config2048,
	resultSchema: result2048,
	metrics: [
		{ key: 'score', label: 'Score', value: (r) => r.score },
		{ key: 'highestTile', label: 'Highest tile', value: (r) => r.highestTile },
		{ key: 'moves', label: 'Moves', value: (r) => r.moves }
	],
	score: (r) => r.score,
	scoreOrder: 'desc',
	rankCompletedOnly: false,
	isComplete: (config, r) => r.highestTile >= config.winValue,
	verify(config, r, { durationMs }) {
		if (r.highestTile !== 0 && !isPowerOfTwo(r.highestTile)) {
			return { verification: 'rejected', reason: 'highest tile is not a power of two' };
		}
		if (r.won !== r.highestTile >= config.winValue) {
			return { verification: 'rejected', reason: 'win flag does not match highest tile' };
		}
		// Every move spawns at most a 4, so the board total grows by ≤4 per move (+ two starting tiles).
		if (r.highestTile > 8 + r.moves * 4) {
			return { verification: 'rejected', reason: 'highest tile unreachable in that many moves' };
		}
		// Rounds resumed from a saved board open a fresh session, so timing is only a loose floor.
		if (r.moves > 0 && durationMs < r.moves * 15) {
			return { verification: 'rejected', reason: 'moves faster than humanly possible' };
		}
		return { verification: 'plausible' };
	}
};
