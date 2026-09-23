# Eva Games — Rewrite Plan

Status: **agreed — ready for Phase 1** · Branch: `rewrite` · Date: 2026-09-23

## 1. Goals

Replace the current "static site + dashboard that commits HTML to GitHub" setup with a live
application that has:

- **Fan accounts** (username + password) with guest play still allowed.
- A **modular game platform**: every game is a plugin with a config schema, so new games and
  presets are cheap to add.
- **Eva Management System (EMS)**: one dashboard to see people, completions, analytics,
  send messages, send games, manage rewards and the site.
- **Rewards**: points, badges, unlockable content, manual rewards, all optional per game.
  Today's public games stay reward-free unless Eva adds a reward.

## 2. What we keep from the current site

| Keep | Where it lives now | Notes |
|---|---|---|
| Palette (pink/red/rose/mauve/blush, OKLCH) | `css/tokens.css` | Becomes the design-token base for the fan site. EMS gets a calmer, denser variant of it. |
| Advantage wordmark font | `fonts/Advantage-Regular.woff2` | Used only for the "Eva Games" / "Eva de Vil" wordmark. |
| Body art left/right framing | `assets/body-*.png` | Hub + game pages keep the flanking figures. |
| Numbered tile grid (01, 02…) | `css/home.css` | Hub layout concept stays: flat index, available / coming soon / reserved states. |
| Footer with store + social icons | `footer.js`, `assets/*.svg` | Rebuilt as a Svelte component, links editable in EMS. |
| 2048 GIF tiles and animation timing | `games/2048/` | Ported to the plugin SDK. The recent timing work is kept. |
| Memory card images | `games/memory/assets/` | Moved to R2 as the default Memory image set. |
| Brand rules | `PRODUCT.md`, `DESIGN.md` | Still apply: seductive, controlled, no neon or casino look. |

Everything else (generator, GitHub publish flow, vanilla admin SPA) is retired.

## 3. Stack

| Concern | Choice | Why |
|---|---|---|
| App framework | **SvelteKit** + TypeScript, `@sveltejs/adapter-cloudflare` | One codebase for the fan site, EMS and API. SSR plus client islands for games. |
| Hosting | **Cloudflare Workers** (static assets) | Same account as now. Staging on a `*.workers.dev` URL until the domain is available. |
| Database | **Cloudflare D1** + **Drizzle ORM** + drizzle-kit migrations | Typed queries and versioned migrations. |
| Media | **Cloudflare R2** | Images, GIFs and videos. Unlockables are served only through an entitlement-checked route, never as public URLs. |
| Validation | **Zod** | Shared between API and forms. Game config schemas are Zod too, so EMS editor forms are generated from them. |
| Auth | Own session auth: PBKDF2 (WebCrypto) password hashes, hashed session tokens in D1, httpOnly cookies | No email provider needed. |
| Abuse protection | Cloudflare Turnstile on signup/login, rate limiting on auth routes | |
| Charts (EMS) | LayerChart or plain SVG | Light, Svelte-native. |
| Tests | Vitest (logic, schemas, scoring) + Playwright (critical flows) | |
| CI/CD | GitHub Actions → `wrangler deploy` (staging on `rewrite`, prod on `main` at cutover) | |

### Repo layout on `rewrite`

```
app/                        SvelteKit application (the new system)
  src/
    lib/
      server/               db (drizzle schema), auth, permissions, services
      games/                game plugins, one folder per game type
        sdk/                plugin contract, play-session client, scoring helpers
        2048/  memory/  typing/  lines/  jigsaw/  sliding/  wordle/  wordsearch/  scramble/  trivia/
      ui/                   shared components (fan + EMS)
      rewards/              trigger evaluation, entitlements
    routes/
      (fan)/                hub, games, account, inbox, vault
      ems/                  Eva Management System
      api/                  JSON endpoints (play sessions, uploads)
  migrations/
  static/                   fonts, favicons, body art, footer icons
docs/
(legacy files at the root stay untouched until cutover, then get removed)
```

## 4. Game platform (the core of modularity)

Every game type is a plugin that implements one contract:

```ts
export interface GamePlugin<Config, Result> {
  type: string;                    // 'typing', 'jigsaw', …
  name: string;
  configSchema: ZodType<Config>;   // drives the EMS editor + validation
  contentSlots?: ContentSlot[];    // images, phrases, words, questions: what Eva can customise per send
  defaultConfig: Config;
  metrics: MetricDef[];            // e.g. score, moves, time, wpm, accuracy
  completion: CompletionRule;      // default "counts as completed" rule, overridable per preset/assignment
  Component: SvelteComponent;      // receives config + a PlaySession
  verify?(config, result, serverCtx): VerifyOutcome;  // server-side result check where possible
}
```

Concepts:

- **Game type**: code (the plugin), for example "Typing".
- **Preset**: a game type plus saved config and content, for example "2048 (classic)" or
  "Devotion lines ×50". Today's 2048 and Memory become presets. Eva can duplicate, edit and
  create presets. Presets double as templates for sending.
- **Visibility** per preset: `public` (on the hub, guests can play), `members` (logged in),
  `hidden` (only reachable through an assignment).
- **Play session**: the server issues a session when a game starts and receives the result
  when it ends. It stores metrics plus a compact event summary for analytics.
- **Anti-cheat, realistic level**: the server validates duration and bounds on every result.
  Games whose answers the server knows (typing, lines, trivia, word games) are verified
  server-side. Canvas games (2048, jigsaw) are plausibility-checked only, and a reward can be
  set to "Eva approves" when it matters.

### Games for v1

| Game type | Ported/new | Eva-customisable content |
|---|---|---|
| 2048 | port | Tile GIFs, target tile, board size |
| Memory | port | Image set, pair count |
| Typing (sprint) | new | Phrase list, time limit, min WPM and accuracy |
| Lines (repetition) | new | One line, repeat count N, typos allowed, time limit |
| Jigsaw | new | Any image, piece count |
| Sliding puzzle | new | Any image, grid size |
| Wordle-style | new | Word list / daily word |
| Word search | new | Word list, grid size |
| Scramble | new | Word list |
| Trivia / quiz | new | Questions, answers, pass mark (checked server-side) |

## 5. Accounts and roles

- **Guest**: can play `public` presets. Progress is kept locally. On signup Eva's site offers
  "keep your progress", which merges local plays into the new account.
- **Fan account**: username + password, 18+ confirmation at signup, display name, optional
  **OnlyFans** and **LoyalFans** handles.
- **Handles**: self-reported. Eva or staff can tick *verified* per handle in the EMS.
- **Password recovery (no email)**: one-time recovery codes shown at signup, plus a staff-issued
  reset code that Eva can send through the site inbox or an OF/LF DM.
- **Staff**: Eva is `owner`. She can add staff (for example the developer or a chat manager) with
  scoped permissions: people, messages, games, rewards, site, analytics, staff.
- **18+ gate**: shown on the first visit (remembered by cookie) and required again at signup.
  Unlockable content is only served to logged-in, age-confirmed users.
- **Account deletion** by the user, plus a privacy page, because the site stores OF/LF handles.

## 6. Rewards

- **Points**: presets and assignments can award points on completion (0 by default, so existing
  games stay reward-free). Points are kept in a ledger, so every change is traceable.
- **Badges**: Eva-defined, with an image and a rule (for example "complete 10 games", "first
  lines assignment").
- **Reward** (reusable definition), by kind:
  - `media`: images, GIFs or videos from R2, unlocked into the user's **Vault**
  - `task`: instructions from Eva. Per task she chooses whether proof is required and in what form:
    none (she marks it done herself), text, image, or text + image. Submissions go to her review queue,
    where she approves or rejects with a note.
  - `game`: unlocks a hidden preset for that user
  - `manual`: goes into Eva's **fulfilment queue**, for example when she sends something on OF, then marks it done
  - `link/code`: a reveal-once link or code
- **Triggers**: completing preset X, reaching N points, completing an assignment, earning a badge,
  or a manual grant from the EMS.
- Anything that needs Eva's attention lands in the EMS "Needs you" queue.

## 7. Assignments (sending games to people)

Eva sends a game in a four-step flow: **Pick preset → Customise → Who → Rules and reward → Send**.

- **Who**: one user, several users, or a whole list.
- **Customise**: override content for this send (a specific photo as the jigsaw, a specific line for Lines).
- **Rules**: deadline or expiry, attempt limit, target (for example ≥60 WPM and 98% accuracy, or 2048 reaches 512).
- **Message**: a note from Eva shown on the assignment and posted in the user's inbox thread.
- **Reward**: optional reward, plus points.
- The fan sees it under **For you** on the hub, with a countdown and attempts left.
- In the EMS, each assignment shows per-recipient status: not started, in progress, completed, failed or expired.
- Any customised send can be **saved as a new preset**.

## 8. EMS: Eva Management System

Designed for Eva first: big clear actions, few clicks, works on her phone.

| Area | What it does |
|---|---|
| **Home** | Stat cards (active fans 7d, new signups, plays, completions, unread messages, rewards waiting), a "Needs you" queue, a live activity feed, trend charts. |
| **People** | Folder sidebar with Eva's **custom lists** (drag users in, bulk move). Rows are sorted with **favorites pinned on top**, then by latest activity, so new activity rises but never above favorites. Search and filters: has OF/LF handle, verified, active, points, list. |
| **Person page** | Profile, handles with verify toggles, points and badges, lists, private staff notes, activity timeline, all plays with metrics, rewards, message thread, plus **Send game** and **Grant reward** buttons. |
| **Inbox** | Two-way conversation per fan, unread first, favorites pinned, image attachments. Also broadcast to a list or to everyone. |
| **Games** | Preset library (cards with preview), editor generated from the plugin schema with a live preview, visibility, points and reward attachments, duplicate as template. |
| **Assignments** | All sends with status per recipient; resend, extend deadline, cancel. |
| **Rewards** | Reward library, badge designer, point thresholds, fulfilment queue, task submissions to review. |
| **Analytics** | Per game: plays, completion rate, average score and time, drop-off. Per user: engagement over time. Funnel from visit → signup → first play → completion. |
| **Site** | Hub tile order, coming-soon slots, footer links, body art, palette tokens: replaces the old dashboard, but changes go live instantly with no publish step. |
| **Staff and audit** | Staff accounts, permissions, audit log of staff actions. |

## 9. Fan site

- **18+ gate** → **Hub**: same pink atmosphere, wordmark, body art and numbered tiles, plus a
  **For you** strip for assignments when logged in.
- **Game page**: same framing as today (title, instructions, body art), the game component, and
  a result screen with points and rewards earned.
- **Account**: profile, OF/LF handles, points, badges, history.
- **Inbox**: messages from Eva, with replies.
- **Vault**: unlocked rewards.
- **Leaderboards (opt-in)**: per game and for overall points. Fans choose whether they appear, under
  their display name. Eva can turn leaderboards on or off per preset.
- **Notifications**: unread badges in the site. Browser push is opt-in, for new messages,
  assigned games and unlocked rewards. It works on Android and desktop, and on iOS once the
  site is installed to the home screen. There is no email in v1, and it can be added later.
- Mobile-first. WCAG AA contrast and `prefers-reduced-motion` are respected, as today.

## 10. Data model (overview)

`users` · `sessions` · `recovery_codes` · `staff_permissions` · `game_presets` ·
`media_assets` · `preset_media` · `assignments` · `assignment_recipients` · `plays` ·
`play_events_summary` · `points_ledger` · `badges` · `user_badges` · `rewards` ·
`reward_triggers` · `user_rewards` (status: unlocked / pending / fulfilled / submitted /
approved) · `task_submissions` · `lists` · `list_members` · `favorites` (per staff member) ·
`staff_notes` · `conversations` · `messages` · `activity` (feed and sort key) ·
`site_settings` · `footer_links` · `audit_log`

The existing D1 content (game settings, footer links, tokens) is imported by a one-time seed script.

## 11. Phases

Each phase ends deployed to staging and reviewable.

1. **Foundation**: SvelteKit app scaffolded on Workers + D1 + R2, Drizzle schema and migrations,
   auth (fan + staff, recovery codes, Turnstile, rate limit), 18+ gate, design tokens and shared
   UI, game plugin SDK + play sessions, push notification plumbing, **2048 and Memory ported**, hub + game pages, profile with
   OF/LF handles, CI deploy to staging.
2. **EMS core**: Home dashboard, People (lists, favorites, activity sort, person page, notes,
   handle verification), two-way Inbox + broadcast, staff and permissions, audit log, Site settings.
3. **Rewards and assignments**: points ledger, badges, reward library and triggers, Vault,
   fulfilment and review queues, preset editor, Send game flow, For you strip, analytics.
4. **New games**: Typing, Lines, Trivia, Wordle, Scramble, Word search, Jigsaw, Sliding
   (server-verifiable games first).
5. **Cutover**: import production data, final QA, point the domain at the Worker, remove the legacy site.

## 12. Decisions log

- Framework: **SvelteKit**. It was chosen over React Router v7 and Next.js for Cloudflare fit, small mobile bundles and less boilerplate.
- Leaderboards: **opt-in public**, and Eva can toggle them per preset.
- Task proof: **only when Eva asks for it**, in a form she picks per task (text, image or both).
- Staging: **https://eva-games-staging.evagames.workers.dev** until the evagames.org domain is available (Cloudflare account: Henkey123321@proton.me).
- Notifications: **in-site badges plus opt-in browser push**. No email for now, but it may come later.
- Recovery: one-time recovery codes plus a staff-issued reset code.
- Long videos: short clips are stored in R2. Cloudflare Stream is only worth considering if long videos become common.

## 13. Progress

- **Phase 1 (foundation): done** on 2026-09-23 and deployed to staging. Details are in `app/README.md`.
- To do before Phase 3: enable **R2** in the Cloudflare dashboard (needed for media uploads).
