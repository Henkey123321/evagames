import type { GameTemplate } from "../types.js";
import { template2048 } from "./game-templates/2048.js";
import { templateMemory } from "./game-templates/memory.js";

export const gameTemplates: Record<string, GameTemplate> = {
  "2048": template2048,
  memory: templateMemory,
};

export function getTemplate(id: string): GameTemplate | undefined {
  return gameTemplates[id];
}

export function listTemplates(): GameTemplate[] {
  return Object.values(gameTemplates);
}
