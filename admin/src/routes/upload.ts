import { Hono } from "hono";
import type { AuthUser, Env } from "../types.js";

type Vars = { user: AuthUser };
const upload = new Hono<{ Bindings: Env; Variables: Vars }>();

function safeRepoPath(path: string): boolean {
	return (
		/^[a-zA-Z0-9/_\-.]+$/.test(path) &&
		!path.includes("..") &&
		!path.startsWith("/")
	);
}

// POST /api/upload — upload file, commit to GitHub repo, optionally attach to a game asset slot.
upload.post("/", async (c) => {
	const formData = await c.req.formData();
	const file = formData.get("file") as File | null;
	const targetPath = formData.get("path") as string | null; // e.g. "games/2048/assets/2.gif"
	const gameSlug = formData.get("game_slug") as string | null;
	const slotKey = formData.get("slot_key") as string | null;
	const filename =
		(formData.get("filename") as string | null) ||
		targetPath?.split("/").pop() ||
		file?.name ||
		"upload";

	if (!file) return c.json({ error: "No file provided" }, 400);
	if (!targetPath) return c.json({ error: "Target path required" }, 400);
	if (!safeRepoPath(targetPath))
		return c.json({ error: "Invalid target path" }, 400);

	const maxSize = 25 * 1024 * 1024; // 25MB (GitHub blob limit)
	if (file.size > maxSize)
		return c.json({ error: "File too large (max 25MB)" }, 413);

	const ghToken = c.env.GITHUB_TOKEN;
	const ghRepo = c.env.GITHUB_REPO;
	const ghBranch = c.env.GITHUB_BRANCH || "main";

	if (!ghToken || !ghRepo) {
		return c.json({ error: "GitHub not configured." }, 500);
	}

	const buffer = await file.arrayBuffer();
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.length; i++)
		binary += String.fromCharCode(bytes[i]);
	const base64 = btoa(binary);

	const api = `https://api.github.com/repos/${ghRepo}`;
	const headers: Record<string, string> = {
		Authorization: `Bearer ${ghToken}`,
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
		"Content-Type": "application/json",
		"User-Agent": "goddess-dashboard/1.0",
	};

	let existingSha: string | undefined;
	const checkRes = await fetch(
		`${api}/contents/${targetPath}?ref=${ghBranch}`,
		{ headers },
	);
	if (checkRes.ok) {
		const existing = (await checkRes.json()) as { sha: string };
		existingSha = existing.sha;
	}

	const body: Record<string, string> = {
		message: `asset: upload ${file.name}`,
		content: base64,
		branch: ghBranch,
	};
	if (existingSha) body.sha = existingSha;

	const putRes = await fetch(`${api}/contents/${targetPath}`, {
		method: "PUT",
		headers,
		body: JSON.stringify(body),
	});

	if (!putRes.ok) {
		const err = await putRes.text();
		return c.json({ error: `GitHub upload failed: ${err}` }, 500);
	}

	if (gameSlug && slotKey) {
		const game = await c.env.DB.prepare("SELECT id FROM games WHERE slug = ?")
			.bind(gameSlug)
			.first<{ id: number }>();
		if (!game) return c.json({ error: "Game not found after upload" }, 404);

		const maxOrder = await c.env.DB.prepare(
			"SELECT MAX(sort_order) as m FROM game_assets WHERE game_id = ? AND slot_key = ?",
		)
			.bind(game.id, slotKey)
			.first<{ m: number | null }>();

		await c.env.DB.prepare(
			"INSERT INTO game_assets (game_id, slot_key, filename, original_name, mime_type, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
		)
			.bind(
				game.id,
				slotKey,
				filename,
				file.name,
				file.type || "application/octet-stream",
				(maxOrder?.m ?? 0) + 1,
			)
			.run();
		await c.env.DB.prepare(
			"UPDATE publish_status SET last_modified_at = datetime('now') WHERE id = 1",
		).run();
		await c.env.DB.prepare(
			"INSERT INTO edit_history (user_id, entity_type, entity_id, action, diff_json) VALUES (?, 'game_asset', ?, 'create', ?)",
		)
			.bind(
				c.get("user").id,
				gameSlug,
				JSON.stringify({ slotKey, filename, targetPath }),
			)
			.run();
	}

	return c.json(
		{
			ok: true,
			path: targetPath,
			filename,
			originalName: file.name,
			size: file.size,
		},
		201,
	);
});

export default upload;
