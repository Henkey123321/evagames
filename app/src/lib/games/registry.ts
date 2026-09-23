/**
 * Game type registry (server-safe: manifests only, no DOM code).
 * To add a game: create src/lib/games/<type>/{manifest,client}.ts and register it here
 * and in clients.ts.
 */
import type { GameManifest } from './sdk/types';
import { manifest2048 } from './2048/manifest';
import { manifestMemory } from './memory/manifest';

const manifests: GameManifest[] = [manifest2048, manifestMemory];

export const gameManifests: ReadonlyMap<string, GameManifest> = new Map(
	manifests.map((m) => [m.type, m])
);

export function getManifest(type: string): GameManifest | undefined {
	return gameManifests.get(type);
}
