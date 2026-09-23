import { z } from 'zod';
import type { GameManifest } from '../sdk/types';

const DEFAULT_CARD_FILES = [
	'F2yts5RboAAu1tm.jpg',
	'F5hq-xXaMAA0q0d.jpg',
	'Fnl3kLIaQAAY4jz.jpg',
	'G8IZLrVW8AY7tKp.jpg',
	'GbFQKLMXIAAiBx1.jpg',
	'HAWBPhPW0AAbr92.jpg',
	'HAWKeW3XgAA6rTc.jpg',
	'HCSGH9VWcAAhS_D.jpg',
	'HCSTsveXsAAaJdx.jpg',
	'HDd2VvHbMAA1Wsl.jpg',
	'ezgif-5165d37e138bb8df.gif',
	'ezgif-52fbe9c3e6eeade0.gif',
	'ezgif-53d2d19e80426395.gif',
	'ezgif-5407f2824cddc904.gif',
	'ezgif-56821225cf48a2d9.gif',
	'ezgif-58880e33036ee96e.gif',
	'ezgif-5960e6312fc124e5.gif',
	'ezgif-7115b1b0e36f338a.gif',
	'ezgif-735ff11df7dd1869.gif',
	'ezgif-7366d247ca88a409.gif',
	'ezgif-742d821db30ca5bc.gif'
];

export const DEFAULT_CARD_IMAGES = DEFAULT_CARD_FILES.map((f) => `/games/memory/cards/${f}`);

export const configMemory = z
	.object({
		pairs: z.number().int().min(2).max(18).default(8),
		flipBackDelayMs: z.number().int().min(200).max(3000).default(760),
		cardBackText: z.string().max(3).default('E'),
		winMessage: z.string().max(40).default('Cleared'),
		winCopy: z.string().max(200).default('The room is yours.'),
		/** Image pool; each round picks `pairs` of them at random. Empty = bundled set. */
		images: z.array(z.string()).default([])
	})
	.refine(
		(c) => (c.images.length === 0 ? DEFAULT_CARD_IMAGES.length : c.images.length) >= c.pairs,
		{
			message: 'Need at least as many images as pairs',
			path: ['images']
		}
	);
export type ConfigMemory = z.infer<typeof configMemory>;

export const resultMemory = z.object({
	moves: z.number().int().min(0),
	timeSeconds: z.number().int().min(0),
	pairs: z.number().int().min(1),
	cleared: z.boolean()
});
export type ResultMemory = z.infer<typeof resultMemory>;

/** Minimum ms per card flip we accept from a human. */
const MIN_FLIP_MS = 120;

export const manifestMemory: GameManifest<ConfigMemory, ResultMemory> = {
	type: 'memory',
	name: 'Memory',
	description: 'Turn over cards two at a time and find every pair.',
	configSchema: configMemory,
	resultSchema: resultMemory,
	metrics: [
		{ key: 'moves', label: 'Moves', value: (r) => r.moves },
		{
			key: 'time',
			label: 'Time',
			value: (r) =>
				`${Math.floor(r.timeSeconds / 60)}:${String(r.timeSeconds % 60).padStart(2, '0')}`
		}
	],
	// Fewer moves is better; time breaks ties (moves × 10000 + seconds keeps ordering in one number).
	score: (r) => r.moves * 10000 + Math.min(r.timeSeconds, 9999),
	scoreOrder: 'asc',
	isComplete: (config, r) => r.cleared && r.pairs === config.pairs,
	verify(config, r, { durationMs }) {
		if (r.pairs !== config.pairs)
			return { verification: 'rejected', reason: 'pair count does not match preset' };
		if (r.cleared && r.moves < r.pairs)
			return { verification: 'rejected', reason: 'fewer moves than pairs' };
		if (durationMs < r.moves * 2 * MIN_FLIP_MS) {
			return { verification: 'rejected', reason: 'flips faster than humanly possible' };
		}
		// Client timer vs server clock: allow slack for network and the timer starting on first flip.
		if (r.timeSeconds * 1000 > durationMs + 5000) {
			return { verification: 'rejected', reason: 'reported time longer than the session' };
		}
		return { verification: 'plausible' };
	}
};
