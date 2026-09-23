# Eva Games (rewrite)

SvelteKit app on Cloudflare Workers + D1. Plan and phases: [`../docs/REWRITE_PLAN.md`](../docs/REWRITE_PLAN.md).

Staging: https://eva-games-staging.evagames.workers.dev (deploys automatically from the `rewrite` branch).

## Local development

```sh
npm install
cp .dev.vars.example .dev.vars      # then fill in VAPID_PRIVATE_KEY (see below)
npm run db:migrate:local            # creates/updates the local D1 database
npm run dev
```

Open http://localhost:5173, pass the 18+ gate, then create the owner account at
`/setup?token=<SETUP_TOKEN from .dev.vars>`.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Node, with D1 emulated by wrangler) |
| `npm run check` | Type check (svelte-check) |
| `npm test` | Unit tests (vitest) |
| `npm run build && npx wrangler dev` | Run the production bundle in the real Workers runtime |
| `npm run db:generate` | Generate a SQL migration after editing `src/lib/server/db/schema.ts` |
| `npm run db:migrate:local` / `db:migrate:remote` | Apply migrations |
| `npm run gen` | Regenerate `worker-configuration.d.ts` after editing `wrangler.jsonc` |
| `npm run vapid` | Generate a new web-push key pair |

## Structure

```
src/lib/games/            game plugins: <type>/manifest.ts (server-safe) + client.ts (DOM)
src/lib/games/sdk/        the plugin contract (types.ts)
src/lib/server/           db schema, auth, sessions, play verification, push, guards
src/lib/ui/               shared Svelte components
src/lib/styles/           design tokens + CSS carried over from the original site
src/routes/(fan)/         fan pages: hub, play, gate, login/signup/recover, account
src/routes/ems/           Eva Management System (Phase 2)
src/routes/api/           JSON endpoints: play sessions, push subscriptions
migrations/               D1 SQL migrations (0001_seed.sql seeds the 2048 + Memory presets)
```

## Adding a game type

1. `src/lib/games/<type>/manifest.ts`: config schema (zod), result schema, `isComplete`, `verify`, `score`.
2. `src/lib/games/<type>/client.ts`: `mount(target, { config, session, storage })`. Call
   `session.begin()` on the first real move and `session.finish(result)` when the round ends.
3. Register it in `src/lib/games/registry.ts` and `src/lib/games/clients.ts`.
4. Add a preset row (migration now; the EMS game editor in Phase 3).

## Deployment (Cloudflare account: Henkey123321@proton.me)

Check `npx wrangler whoami` shows that account before running any remote command.

Secrets (set once per environment with `npx wrangler secret put <NAME>`):

- `SETUP_TOKEN`: one-time token for `/setup` (owner account creation). The page 404s once an owner exists.
- `VAPID_PRIVATE_KEY`: web-push private key matching `VAPID_PUBLIC_KEY` in `wrangler.jsonc`.
- `TURNSTILE_SECRET` (optional): with `TURNSTILE_SITE_KEY` in `wrangler.jsonc`, enables the captcha on login/signup.

GitHub Actions (`.github/workflows/deploy-staging.yml`) needs the repo secrets `CF_STAGING_API_TOKEN`
(Workers Scripts: Edit, D1: Edit) and `CF_STAGING_ACCOUNT_ID`. The legacy `CLOUDFLARE_*` secrets are left for the old dashboard deploy on `main`.

R2 (media uploads) is not enabled on the account yet. Enable it in the Cloudflare dashboard before Phase 3.
