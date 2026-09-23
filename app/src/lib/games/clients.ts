/** Browser-side game loaders. Each game's DOM code and CSS are split into their own chunk. */
import type { GameClient } from './sdk/types';

export const gameClients: Record<string, () => Promise<GameClient>> = {
	'2048': () => import('./2048/client').then((m) => m.client2048),
	memory: () => import('./memory/client').then((m) => m.clientMemory)
};
