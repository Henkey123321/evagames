import { describe, expect, it } from 'vitest';
import { manifest2048 } from './2048/manifest';
import { manifestMemory } from './memory/manifest';

const cfg2048 = manifest2048.configSchema.parse({});
const cfgMemory = manifestMemory.configSchema.parse({});
const long = { durationMs: 600_000 };

describe('2048 manifest', () => {
	it('fills defaults matching the original game', () => {
		expect(cfg2048).toMatchObject({
			boardSize: 4,
			winValue: 2048,
			moveDurationMs: 150,
			fourSpawnChance: 0.1
		});
	});

	it('completes only when the target tile is reached', () => {
		expect(
			manifest2048.isComplete(cfg2048, { score: 20000, highestTile: 2048, moves: 900, won: true })
		).toBe(true);
		expect(
			manifest2048.isComplete(cfg2048, { score: 9000, highestTile: 1024, moves: 600, won: false })
		).toBe(false);
	});

	it('rejects impossible results', () => {
		const ok = { score: 20000, highestTile: 2048, moves: 900, won: true };
		expect(manifest2048.verify(cfg2048, ok, long).verification).toBe('plausible');
		expect(manifest2048.verify(cfg2048, { ...ok, highestTile: 2000 }, long).verification).toBe(
			'rejected'
		);
		expect(manifest2048.verify(cfg2048, { ...ok, moves: 20 }, long).verification).toBe('rejected');
		expect(manifest2048.verify(cfg2048, ok, { durationMs: 2_000 }).verification).toBe('rejected');
		expect(manifest2048.verify(cfg2048, { ...ok, won: false }, long).verification).toBe('rejected');
	});
});

describe('memory manifest', () => {
	it('fills defaults matching the original game', () => {
		expect(cfgMemory).toMatchObject({ pairs: 8, flipBackDelayMs: 760, cardBackText: 'E' });
	});

	it('refuses configs with fewer images than pairs', () => {
		expect(manifestMemory.configSchema.safeParse({ pairs: 4, images: ['a', 'b'] }).success).toBe(
			false
		);
	});

	it('scores fewer moves as better and checks timing', () => {
		const r = { moves: 12, timeSeconds: 40, pairs: 8, cleared: true };
		expect(manifestMemory.isComplete(cfgMemory, r)).toBe(true);
		expect(manifestMemory.score(r)).toBeLessThan(
			manifestMemory.score({ ...r, moves: 13, timeSeconds: 1 })
		);
		expect(manifestMemory.verify(cfgMemory, r, { durationMs: 41_000 }).verification).toBe(
			'plausible'
		);
		expect(manifestMemory.verify(cfgMemory, r, { durationMs: 1_000 }).verification).toBe(
			'rejected'
		);
		expect(
			manifestMemory.verify(cfgMemory, { ...r, moves: 5 }, { durationMs: 41_000 }).verification
		).toBe('rejected');
	});
});
