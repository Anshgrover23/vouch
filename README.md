<p align="center">
  <strong>Vouch</strong>
</p>

<p align="center">
  Split the receipt, not the friendship.
</p>

<p align="center">
  <a href="https://vouch.anshgrover.com">Website</a>
  ·
  <a href="./docs/architecture.md">Docs</a>
  ·
  <a href="https://github.com/Anshgrover23/vouch/issues">Issues</a>
</p>

<p align="center">
  <a href="https://github.com/Anshgrover23/vouch/actions/workflows/build.yml"><img src="https://github.com/Anshgrover23/vouch/actions/workflows/build.yml/badge.svg" alt="Build" /></a>
  <a href="https://github.com/Anshgrover23/vouch/actions/workflows/test.yml"><img src="https://github.com/Anshgrover23/vouch/actions/workflows/test.yml/badge.svg" alt="Test" /></a>
</p>

<p align="center">
  <video src="apps/web/public/demo/vouch.mp4" width="920" controls playsinline poster="apps/web/public/demo/vouch-poster.jpg">
    <a href="https://vouch.anshgrover.com">Watch the 60-second film</a>
  </video>
</p>

## About

Vouch is a receipt-split app. Sign up, snap the paper or type the lines, housemates tap **I owe this** or **Not mine**. Groups keep who owes whom. When people have vouched, you copy a line for the chat:

```
HILLCREST MARKET 13 Aug — $84.20 — 3 people vouched
```

The receipt is the proof. Splitwise makes you type. Vouch makes you tap.

## Features

- [x] Snap a receipt — Interfaze reads merchant, date, total, and every priced line
- [x] No photo? Type the lines. Same tap canvas
- [x] Housemates tap **I owe this**, **Split equally**, or **Not mine**
- [x] Share by link (`/s/...`) — guests do not need an account
- [x] Invite friends as named seats before they join
- [x] Groups for a household or a trip, with who-owes-whom
- [x] Star groups, activity, settle up, CSV of every item
- [x] Analytics: spend over time, who paid vs share, merchants
- [x] Currency from the paper (₹ and $)
- [x] Skip junk OCR lines; the total recomputes

## Stack

| Layer | What |
| --- | --- |
| App | [Next.js](https://nextjs.org/) 15 App Router, React 19 |
| Database | Postgres + [Drizzle](https://orm.drizzle.team/) |
| Files | [Supabase Storage](https://supabase.com/storage) (`receipts` bucket) |
| OCR | [Interfaze](https://interfaze.ai) — the browser never talks to it |
| Hosting | [Vercel](https://vercel.com) |
| Tests | Node test runner + [Playwright](https://playwright.dev) |
| Monorepo | pnpm workspaces + Turborepo |

## Getting Started

### Cloud

The hosted app is at [vouch.anshgrover.com](https://vouch.anshgrover.com). Sign up and split a receipt. The 60-second film is on the homepage.

### Prerequisites

- Docker (Postgres)
- Node 20+
- [pnpm](https://pnpm.io/) 9

### Run locally

```bash
git clone https://github.com/Anshgrover23/vouch.git
cd vouch
cp .env.example .env.local
# paste INTERFAZE_API_KEY for live OCR (empty → fixture receipts)
pnpm install
pnpm local
```

| | |
| --- | --- |
| App | [http://localhost:3000](http://localhost:3000) |
| Sign up | [http://localhost:3000/signup](http://localhost:3000/signup) |
| New receipt | [http://localhost:3000/new](http://localhost:3000/new) (signed in) |

`pnpm local` starts Docker Postgres, migrates, seeds, then the Next.js app and a local worker.

`.env.local` is gitignored. Never commit it.

### Configuration

Copy [`.env.example`](./.env.example) to `.env.local`.

| Variable | Required | What it does |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres. Docker locally, pooled Supabase/Neon in production |
| `SESSION_SECRET` | yes | Signs the session cookie. Same value for Node and Edge |
| `INTERFAZE_API_KEY` | for live OCR | Empty → fixture receipts |
| `NEXT_PUBLIC_APP_URL` | yes in prod | `https://vouch.anshgrover.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | for Storage | Project URL, e.g. `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | for Storage | Secret key (`sb_secret_…`). Server only |
| `PROOFSHEET_FIXTURE` | no | Set `1` to force fixtures even with a key |

Without the Storage pair, local writes `public/uploads/` and sends Interfaze a small data URL. Production without those keys falls back to a resized data URL in Postgres (slow). With them, files go in the public `receipts` bucket and Interfaze fetches the HTTPS URL.

## Documentation

- [Architecture](./docs/architecture.md) — runtime diagram, auth, extract pipeline, groups
- [Environment example](./.env.example)

How extraction works, short version: the browser never talks to Interfaze. Next.js resizes the JPEG (max edge 1800px), stores it, writes a job, then processes it. Locally a Node worker also claims jobs with `FOR UPDATE SKIP LOCKED`.

| Setup | What Interfaze sees |
| --- | --- |
| Storage configured | Public HTTPS URL in `documents.source_url` |
| Local without Storage | Small data URL (`localhost` is unreachable) |
| No API key | Hillcrest Market / payment fixtures |
| Key present | Live extract. On timeout or `model_error`, fixture fallback so review still opens |

Document and split JSON return an image URL, never the bytes.

### Using the app

1. `/signup` — name, email, password (8+). First run goes to `/onboarding` (start a group or skip).
2. `/new` — snap a receipt, use a sample, or type the lines. Optional group on the receipt.
3. `/review/[id]` — confirm who you are, tap lines you owe, invite housemates. Share link is `/s/...`.
4. `/groups` — households and trips. Star from the list. Balances, analytics, activity, CSV.
5. `/inbox` — your splits. `/account` — name and password.

`/new`, `/inbox`, `/groups`, `/account`, and `/review/...` require a signed-in, onboarded session. Share links (`/s/...`) do not.

Seeded `demo@proofsheet.dev` has no password hash and cannot log in. Create a real account.

## Development

```
apps/web            Next.js (landing, auth, /new, inbox, review, groups, share)
apps/ios            Native SwiftUI app against the same API
apps/worker         Local job loop (optional in production)
packages/db         Drizzle schema + SQL migrations
packages/interfaze  Live + fixture providers
packages/ui         Design tokens
docs/architecture.md
```

Internal packages are still `@proofsheet/*`. The product name is Vouch.

```bash
pnpm local          # docker + migrate + seed + web + worker
pnpm dev            # turbo dev (needs Postgres already up)
pnpm test           # unit: web lib + Interfaze
pnpm test:e2e       # Playwright against localhost:3000
pnpm build          # production build (web)
pnpm db:migrate
pnpm db:seed
```

### Tests

```bash
pnpm test           # unit
pnpm test:e2e       # Playwright (needs Postgres)
```

GitHub Actions on push and PR:

| Check | What it runs |
| --- | --- |
| **Build** | `pnpm --filter @proofsheet/web build` |
| **Test / unit** | `pnpm test` |
| **Test / e2e** | Postgres 16, `pnpm db:migrate`, Playwright Chromium with `PROOFSHEET_FIXTURE=1` |

E2E CI does **not** use production `DATABASE_URL` or secrets. It boots its own database and a dummy `SESSION_SECRET`.

Local e2e: `pnpm local` (or Postgres on `:5432`), then `pnpm test:e2e`. Playwright starts `pnpm dev` unless something is already on port 3000.

## Deployment

Live: [vouch.anshgrover.com](https://vouch.anshgrover.com). Three services. Nothing else.

1. **Interfaze** — OCR key. [dashboard](https://interfaze.ai/dashboard)
2. **Supabase** — Postgres **and** Storage (same project). [dashboard](https://supabase.com/dashboard)
3. **Vercel** — Next.js app. Worker is not required in production: extract runs on the request path.

### Database + Storage

Create a Supabase project. Migrate from your laptop:

```bash
DATABASE_URL='postgres://...pooler.supabase.com:6543/postgres' pnpm db:migrate
DATABASE_URL='postgres://...pooler.supabase.com:6543/postgres' pnpm db:seed
```

Use the pooler URI (`6543` / `pooler` in the host). Prepared statements are already disabled when the URL contains `pooler`.

In **Settings → API Keys**:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL` (no `/rest/v1`)
- **Secret keys** → `sb_secret_…` → `SUPABASE_SERVICE_ROLE_KEY`

The app creates a public `receipts` bucket on first upload if it is missing.

### Vercel

Import [Anshgrover23/vouch](https://github.com/Anshgrover23/vouch).

- Framework: Next.js
- Root Directory: `apps/web`

Environment (Production + Preview):

```
DATABASE_URL=                    # pooled Postgres URI
SESSION_SECRET=                  # openssl rand -hex 32
INTERFAZE_API_KEY=               # same key as local
NEXT_PUBLIC_APP_URL=https://vouch.anshgrover.com
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=       # sb_secret_…
PROOFSHEET_FIXTURE=0
```

Redeploy after adding Storage keys. Env vars do not apply to a deploy that already ran.

Live OCR often takes 15–40s. That wait is Interfaze, not the upload. Vercel Hobby functions time out at 10s. Use **Pro** (60s) or the grocery sample may fall back to fixtures.

<details>
<summary>Custom domain and live OCR check</summary>

Add `vouch.anshgrover.com` in Vercel → Project → Settings → Domains.

In the DNS zone for `anshgrover.com`:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `vouch` | `cname.vercel-dns.com` |

Do **not** change A records for the apex `anshgrover.com`.

Open `https://vouch.anshgrover.com/new` → drop a photo → Read. Vercel logs should show:

```
[upload] resized … storage=true
[extract] interfaze …ms bytes=https://….supabase.co/storage/v1/object/public/receipts/….jpg
```

If `bytes=` is a huge number or `storage=false`, the Storage env vars are missing on that deploy. Review should show **live** fields from the real paper, not Hillcrest fixtures.

</details>

## Contributing

Issues and pull requests are welcome.

1. Fork the repo and create a branch
2. `pnpm local`, then `pnpm test` and `pnpm test:e2e` before you open a PR
3. Keep secrets out of git (`.env.local`, `SUPABASE_SERVICE_ROLE_KEY`)

Good first surface area: copy, landing, e2e coverage, extract fixtures.

## Links

- [Website](https://vouch.anshgrover.com)
- [Architecture](./docs/architecture.md)
- [Interfaze](https://interfaze.ai)
- [Issues](https://github.com/Anshgrover23/vouch/issues)
