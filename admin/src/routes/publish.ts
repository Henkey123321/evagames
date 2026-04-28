import { Hono } from "hono";
import type { Env, AuthUser, PublishStatusRow } from "../types.js";

type Vars = { user: AuthUser };
const publish = new Hono<{ Bindings: Env; Variables: Vars }>();

// GET /api/publish/status
publish.get("/status", async (c) => {
  const status = await c.env.DB.prepare("SELECT * FROM publish_status WHERE id = 1")
    .first<PublishStatusRow>();

  const hasChanges = status
    ? !status.last_published_at || status.last_modified_at > status.last_published_at
    : true;

  return c.json({ status, hasUnpublishedChanges: hasChanges });
});

// POST /api/publish — generate site and commit to GitHub
publish.post("/", async (c) => {
  const user = c.get("user");
  const ghToken = c.env.GITHUB_TOKEN;
  const ghRepo = c.env.GITHUB_REPO;
  const ghBranch = c.env.GITHUB_BRANCH || "main";

  if (!ghToken || !ghRepo) {
    return c.json({ error: "GitHub not configured. Set GITHUB_TOKEN and GITHUB_REPO." }, 500);
  }

  try {
    const { generateSite } = await import("../generator/index.js");
    const result = await generateSite(c.env.DB);

    // Commit all generated files to GitHub
    const fileList = Array.from(result.files.keys());
    await commitToGitHub(ghToken, ghRepo, ghBranch, result.files, `chore: publish from Goddess's Dashboard`);

    // Update publish status
    await c.env.DB.prepare(
      "UPDATE publish_status SET last_published_at = datetime('now'), published_by = ?, snapshot_hash = ? WHERE id = 1",
    ).bind(user.id, result.hash).run();

    // Log
    await c.env.DB.prepare(
      "INSERT INTO edit_history (user_id, entity_type, entity_id, action, diff_json) VALUES (?, 'site', 'all', 'publish', ?)",
    ).bind(user.id, JSON.stringify({ filesGenerated: fileList.length })).run();

    return c.json({ ok: true, files: fileList, hash: result.hash });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: "Publish failed: " + message }, 500);
  }
});

// ── GitHub API helpers ──

const GH_API = "https://api.github.com";

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    "User-Agent": "goddess-dashboard/1.0",
  };
}

async function commitToGitHub(
  token: string,
  repo: string,
  branch: string,
  files: Map<string, string>,
  message: string,
): Promise<string> {
  const headers = ghHeaders(token);
  const api = `${GH_API}/repos/${repo}`;

  // 1. Get latest commit on branch
  const refRes = await fetch(`${api}/git/ref/heads/${branch}`, { headers });
  if (!refRes.ok) {
    const body = await refRes.text();
    throw new Error(`GitHub: could not get ref (${refRes.status}) - ${body}`);
  }
  const ref = await refRes.json() as { object: { sha: string } };
  const latestSha = ref.object.sha;

  // 2. Get tree SHA from that commit
  const commitRes = await fetch(`${api}/git/commits/${latestSha}`, { headers });
  const commitData = await commitRes.json() as { tree: { sha: string } };
  const baseTreeSha = commitData.tree.sha;

  // 3. Create blobs for each file
  const tree: { path: string; mode: string; type: string; sha: string }[] = [];
  for (const [path, content] of files) {
    const blobRes = await fetch(`${api}/git/blobs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content, encoding: "utf-8" }),
    });
    if (!blobRes.ok) throw new Error(`GitHub: blob creation failed for ${path}`);
    const blob = await blobRes.json() as { sha: string };
    tree.push({ path, mode: "100644", type: "blob", sha: blob.sha });
  }

  // 4. Create new tree
  const treeRes = await fetch(`${api}/git/trees`, {
    method: "POST",
    headers,
    body: JSON.stringify({ base_tree: baseTreeSha, tree }),
  });
  if (!treeRes.ok) throw new Error("GitHub: tree creation failed");
  const newTree = await treeRes.json() as { sha: string };

  // 5. Create commit
  const newCommitRes = await fetch(`${api}/git/commits`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message, tree: newTree.sha, parents: [latestSha] }),
  });
  if (!newCommitRes.ok) throw new Error("GitHub: commit creation failed");
  const newCommit = await newCommitRes.json() as { sha: string };

  // 6. Update branch reference
  const updateRes = await fetch(`${api}/git/refs/heads/${branch}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ sha: newCommit.sha }),
  });
  if (!updateRes.ok) throw new Error("GitHub: ref update failed");

  return newCommit.sha;
}

export default publish;
