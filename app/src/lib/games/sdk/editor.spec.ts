import { describe, expect, it } from 'vitest';
import { manifest2048 } from '../2048/manifest';
import { manifestMemory } from '../memory/manifest';
import { describeTarget, diffConfig, meetsTargets, readEditorForm, readTargets } from './editor';

function form(entries: Record<string, string>) {
	const f = new FormData();
	for (const [k, v] of Object.entries(entries)) f.append(k, v);
	return f;
}

describe('editor forms', () => {
	it('parses numbers, selects, text and unchecked booleans', () => {
		const values = readEditorForm(
			manifest2048.editor,
			form({ cfg_winValue: '512', cfg_boardSize: '5', cfg_winMessage: 'Good pet' })
		);
		expect(values).toMatchObject({
			winValue: 512,
			boardSize: 5,
			winMessage: 'Good pet',
			backgroundDefault: false
		});
		expect(manifest2048.configSchema.safeParse(values).success).toBe(true);
	});

	it('ignores select values that are not offered', () => {
		expect(readEditorForm(manifest2048.editor, form({ cfg_winValue: '999' }))).not.toHaveProperty(
			'winValue'
		);
	});

	it('stores only what changed', () => {
		const base = manifestMemory.configSchema.parse({});
		expect(diffConfig(base, { ...base, pairs: 6 })).toEqual({ pairs: 6 });
	});

	it('every editor field maps to a real config key', () => {
		for (const m of [manifest2048, manifestMemory]) {
			const defaults = m.configSchema.parse({}) as Record<string, unknown>;
			for (const field of m.editor) expect(defaults).toHaveProperty(field.key);
		}
	});
});

describe('targets', () => {
	const r = { moves: 14, timeSeconds: 50, pairs: 8, cleared: true };

	it('reads, clamps and skips empty targets', () => {
		expect(
			readTargets(manifestMemory.targets, form({ tgt_maxMoves: '12', tgt_maxSeconds: '' }))
		).toEqual([{ key: 'maxMoves', value: 12 }]);
		expect(readTargets(manifestMemory.targets, form({ tgt_maxSeconds: '1' }))).toEqual([
			{ key: 'maxSeconds', value: 5 }
		]);
	});

	it('checks results and fails closed on unknown keys', () => {
		expect(meetsTargets(manifestMemory, r, [{ key: 'maxMoves', value: 20 }])).toBe(true);
		expect(meetsTargets(manifestMemory, r, [{ key: 'maxMoves', value: 12 }])).toBe(false);
		expect(meetsTargets(manifestMemory, r, [{ key: 'nope', value: 1 }])).toBe(false);
		expect(meetsTargets(manifestMemory, r, [])).toBe(true);
	});

	it('describes targets in plain words', () => {
		expect(describeTarget(manifestMemory.targets, { key: 'maxMoves', value: 20 })).toBe(
			'In at most 20 moves'
		);
		expect(describeTarget(manifest2048.targets, { key: 'minScore', value: 5000 })).toBe(
			'Score at least 5000'
		);
	});
});
