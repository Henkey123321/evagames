import type { GameTemplate } from "../../types.js";

export const templateMemory: GameTemplate = {
	id: "memory",
	name: "Memory",
	version: "1.0.0",
	description:
		"Card-matching game — turn over pairs and clear the board with as few moves as possible.",
	settings: [
		// ── Simple settings ──
		{
			key: "instructions",
			label: "Instructions",
			description: "Help text shown above the game board.",
			type: "textarea",
			default:
				"Turn over two cards. Keep the pair, remember the room, clear the board with as few moves as possible.",
			advanced: false,
			group: "copy",
		},
		{
			key: "win_message",
			label: "Win message",
			description: "Title shown when the board is cleared.",
			type: "text",
			default: "Cleared",
			advanced: false,
			group: "copy",
		},
		{
			key: "win_copy",
			label: "Win copy",
			description:
				"Body text template. Use {moves} and {time} as placeholders.",
			type: "text",
			default: "The room is yours.",
			advanced: false,
			group: "copy",
		},
		{
			key: "card_back_text",
			label: "Card back text",
			description: "Letter or symbol shown on the back of each card.",
			type: "text",
			default: "E",
			advanced: false,
			group: "visuals",
		},

		// ── Advanced settings ──
		{
			key: "pairs",
			label: "Number of pairs",
			description:
				"How many pairs to match (board will have 2× this many cards).",
			type: "number",
			default: 8,
			validation: { min: 2, max: 20, required: true },
			advanced: true,
			group: "gameplay",
		},
		{
			key: "flip_back_delay_ms",
			label: "Flip-back delay (ms)",
			description:
				"How long mismatched cards stay visible before flipping back.",
			type: "number",
			default: 760,
			validation: { min: 200, max: 3000 },
			advanced: true,
			group: "timing",
		},
	],
	assetSlots: [
		{
			key: "card_image",
			label: "Card images",
			description:
				"Images used as card faces. The game picks random pairs from this pool each round.",
			accept: "image/jpeg,image/png,image/gif,image/webp",
			cropAspectRatio: 1,
			required: true,
			multiple: true,
		},
	],
};
