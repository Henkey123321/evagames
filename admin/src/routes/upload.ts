import { Hono } from "hono";
import type { Env, AuthUser } from "../types.js";

type Vars = { user: AuthUser };
const upload = new Hono<{ Bindings: Env; Variables: Vars }>();

// POST /api/upload — upload file, commit to GitHub repo
upload.post("/", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const targetPath = formData.get("path") as string | null; // e.g. "games/2048/images/tile-2.gif"

  if (!file) return c.json({ error: "No file provided" }, 400);
  if (!targetPath) return c.json({ error: "Target path required" }, 400);

  const maxSize = 25 * 1024 * 1024; // 25MB (GitHub blob limit)
  if (file.size > maxSize) return c.json({ error: "File too large (max 25MB)" }, 413);

  const ghToken = c.env.GITHUB_TOKEN;
  const ghRepo = c.env.GITHUB_REPO;
  const ghBranch = c.env.GITHUB_BRANCH || "main";

  if (!ghToken || !ghRepo) {
    return c.json({ error: "GitHub not configured." }, 500);
  }

  // Read file as base64
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);

  const api = `https://api.github.com/repos/${ghRepo}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${ghToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    "User-Agent": "goddess-dashboard/1.0",
  };

  // Use the Contents API for single-file commits (simpler)
  // First check if file exists to get its SHA for updating
  let existingSha: string | undefined;
  const checkRes = await fetch(`${api}/contents/${targetPath}?ref=${ghBranch}`, { headers });
  if (checkRes.ok) {
    const existing = await checkRes.json() as { sha: string };
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

  return c.json({ ok: true, path: targetPath, originalName: file.name, size: file.size }, 201);
});

export default upload;
