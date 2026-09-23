import type { z } from 'zod';

/**
 * A game plugin is split in two so the server never loads DOM code:
 *
 *  - `GameManifest` (manifest.ts): pure data + validation. Imported by the server
 *    to validate preset configs, check results and decide completion.
 *  - `GameClient` (client.ts): mounts the playable game into a DOM element.
 *    Loaded lazily in the browser only.
 */
export interface GameManifest<Config = any, Result = any> {
	/** Stable id stored in presets, e.g. '2048'. Never rename. */
	type: string;
	name: string;
	description: string;
	configSchema: z.ZodType<Config>;
	/** Shape of the result the client reports when a round ends. */
	resultSchema: z.ZodType<Result>;
	/** Metrics shown in analytics / EMS, in display order. */
	metrics: MetricDef<Result>[];
	/** Headline number for sorting and leaderboards. */
	score(result: Result): number;
	scoreOrder: 'asc' | 'desc';
	/**
	 * Only completed rounds count for bests and leaderboards. True for games ranked by
	 * "fewest moves" (an abandoned Memory round would otherwise win); false for 2048,
	 * where any finished round's score counts.
	 */
	rankCompletedOnly: boolean;
	/** How a stored score reads on leaderboards (defaults to the number). */
	formatScore?(score: number): string;
	/** Whether a round counts as completed under this config. */
	isComplete(config: Config, result: Result): boolean;
	/**
	 * Server-side sanity check. `server` = the server could fully verify the result,
	 * `plausible` = it passed bounds/timing checks only, `rejected` = impossible result.
	 */
	verify(config: Config, result: Result, ctx: VerifyContext): VerifyOutcome;
}

export interface MetricDef<Result> {
	key: string;
	label: string;
	value(result: Result): number | string;
}

export interface VerifyContext {
	/** Server-measured time between start and finish. */
	durationMs: number;
}

export type VerifyOutcome =
	{ verification: 'server' | 'plausible' } | { verification: 'rejected'; reason: string };

/* ── Client side ────────────────────────────────────────────────────── */

export interface GameClient<Config = any, Result = any> {
	mount(target: HTMLElement, ctx: GameContext<Config, Result>): MountedGame;
	/**
	 * Storage keys used by the original static site (same origin after cutover),
	 * read as a fallback so fans keep their saved boards and best scores.
	 */
	legacyStorage?: Record<string, string>;
}

export interface MountedGame {
	destroy(): void;
}

export interface GameContext<Config, Result> {
	config: Config;
	session: PlaySession<Result>;
	/** localStorage namespaced to this preset; failures are swallowed. */
	storage: GameStorage;
}

export interface PlaySession<Result> {
	/**
	 * Call when a round actually starts (first move / first flip), not on page load.
	 * Safe to call repeatedly: only the first call per round opens a session.
	 */
	begin(): void;
	/** Call once when a round ends. Resolves with the server's verdict (or null offline). */
	finish(result: Result): Promise<FinishResponse | null>;
	/** Call when the player abandons a round (e.g. presses New game mid-round). */
	reset(): void;
}

export interface FinishResponse {
	completed: boolean;
	verification: 'server' | 'plausible' | 'rejected';
	score: number;
	/** Present when the player is signed in and this beat their previous best. */
	personalBest?: boolean;
	/** Points, badges and rewards this round earned (signed-in players). */
	pointsAwarded?: number;
	badges?: string[];
	rewards?: { name: string; pending: boolean }[];
}

export interface GameStorage {
	get<T>(key: string): T | null;
	set(key: string, value: unknown): void;
	remove(key: string): void;
}
