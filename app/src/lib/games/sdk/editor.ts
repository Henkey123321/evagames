/* Turning editor forms into game configs and targets, and checking targets against results. */
import type { EditorField, GameManifest, TargetDef } from './types';

export const CONFIG_PREFIX = 'cfg_';
export const TARGET_PREFIX = 'tgt_';

export interface TargetValue {
	key: string;
	value: number;
}

/** Reads editor fields (named `cfg_<key>`) from a form. Unchecked booleans read as false. */
export function readEditorForm(fields: EditorField[], form: FormData): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const field of fields) {
		const raw = form.get(CONFIG_PREFIX + field.key);
		if (field.type === 'boolean') {
			out[field.key] = raw === 'on';
		} else if (field.type === 'number') {
			if (raw !== null && String(raw).trim() !== '') out[field.key] = Number(raw);
		} else if (field.type === 'select') {
			if (raw === null) continue;
			const option = field.options.find((o) => String(o.value) === String(raw));
			if (option) out[field.key] = option.value;
		} else if (raw !== null) {
			out[field.key] = String(raw);
		}
	}
	return out;
}

/** Only the keys whose values differ from `base`, so sends store small overrides. */
export function diffConfig(base: Record<string, unknown>, next: Record<string, unknown>) {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(next)) {
		if (JSON.stringify(base[key]) !== JSON.stringify(value)) out[key] = value;
	}
	return out;
}

/** Reads optional targets (named `tgt_<key>`); empty inputs are skipped, values are clamped. */
export function readTargets<R>(defs: TargetDef<R>[], form: FormData): TargetValue[] {
	const out: TargetValue[] = [];
	for (const def of defs) {
		const raw = form.get(TARGET_PREFIX + def.key);
		if (raw === null || String(raw).trim() === '') continue;
		const value = Math.round(Number(raw));
		if (!Number.isFinite(value)) continue;
		out.push({ key: def.key, value: Math.min(def.max, Math.max(def.min, value)) });
	}
	return out;
}

/** True when every target is met. Unknown target keys fail closed. */
export function meetsTargets<C, R>(
	manifest: GameManifest<C, R>,
	result: R,
	targets: TargetValue[]
) {
	return targets.every((t) => {
		const def = manifest.targets.find((d) => d.key === t.key);
		return def ? def.check(result, t.value) : false;
	});
}

export function describeTarget<R>(defs: TargetDef<R>[], target: TargetValue) {
	const def = defs.find((d) => d.key === target.key);
	return def ? `${def.label} ${target.value}${def.unit ?? ''}` : '';
}
