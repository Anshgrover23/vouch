# Vouch

Roommate and trip splits that cite the paper. Upload a grocery receipt or a Venmo/Zelle screenshot. Interfaze reads merchant, date, total, and line items. Housemates tap **I owe this** or **Not mine**. When people have vouched, you copy a line for the group chat:

`HILLCREST MARKET 13 Aug — $84.20 — 3 people vouched`

## Run locally

Needs Docker (Postgres), Node 20+, and [pnpm](https://pnpm.io/).

```bash
cp .env.example .env.local
# paste INTERFAZE_API_KEY
pnpm install
pnpm local
```

- App: [http://localhost:3000](http://localhost:3000)
- New receipt: [http://localhost:3000/new](http://localhost:3000/new)

`.env.local` is gitignored. Never commit it.

## Environment

| Variable | Required | What it does |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres. Local Docker, or pooled Supabase/Neon in production |
| `SESSION_SECRET` | yes | Signs the demo session cookie |
| `INTERFAZE_API_KEY` | for live OCR | Empty → fixture receipts |
| `NEXT_PUBLIC_APP_URL` | yes in prod | `https://vouch.anshgrover.com` |
| `PROOFSHEET_FIXTURE` | no | Set `1` to force fixtures even with a key |

## Production (`vouch.anshgrover.com`)

You need **three services**. Nothing else (no Stripe, GraphQL, Fly, or Python).

1. **Interfaze** — key you already have. [dashboard](https://interfaze.ai/dashboard)
2. **Hosted Postgres** — [Supabase](https://supabase.com/dashboard) (Postgres that matches Interfaze’s stack) or [Neon](https://neon.tech). Copy the **pooled** connection string into `DATABASE_URL`.
3. **Vercel** — hosts the Next.js app. Worker is not required in production: the app processes extract jobs on the request path.

### 1. Database

Create a free Supabase project. In SQL editor, you can skip this if you migrate from your laptop:

```bash
DATABASE_URL='postgres://...pooler.supabase.com:6543/postgres' pnpm db:migrate
DATABASE_URL='postgres://...pooler.supabase.com:6543/postgres' pnpm db:seed
```

Use the pooler URI (`6543` / `pooler` in the host). Turn off prepared statements is already handled when the URL contains `pooler`.

### 2. Vercel

Import [Anshgrover23/vouch](https://github.com/Anshgrover23/vouch).

- Framework: Next.js
- Root Directory: `apps/web`
- Include files outside the root (pnpm workspace) — Vercel does this by default for pnpm

Environment variables (Production):

```
DATABASE_URL=           # pooled Postgres URI
SESSION_SECRET=         # openssl rand -hex 32
INTERFAZE_API_KEY=      # same key as local
NEXT_PUBLIC_APP_URL=https://vouch.anshgrover.com
PROOFSHEET_FIXTURE=0
```

Live OCR often takes 15–40s. Vercel Hobby functions time out at 10s. Use **Pro** (60s) or the grocery sample may fall back to fixtures.

### 3. Hostinger DNS (anshgrover.com stays where it is)

In Vercel → Project → Settings → Domains → add `vouch.anshgrover.com`.

In Hostinger hPanel → DNS zone for `anshgrover.com` → add:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `vouch` | `cname.vercel-dns.com` |

(Vercel shows the exact target if it differs.) Do **not** change A records for the apex `anshgrover.com`. Wait for DNS (often a few minutes, sometimes up to an hour).

### Check live OCR

Open `https://vouch.anshgrover.com/new` → Grocery receipt → Read. Review should show **live** fields from the real paper, not Hillcrest fixtures. If you still see fixtures, the Interfaze call failed (timeout or key) — check Vercel function logs.

## How extraction works

The browser never talks to Interfaze. Next.js writes a job, then processes it (locally a Node worker also claims jobs with `FOR UPDATE SKIP LOCKED`). Images are sent as data URLs so Interfaze does not need to fetch `localhost`.

- **No key** → Hillcrest Market / payment fixtures
- **Key present** → live Interfaze. On failure (timeouts, `model_error`), fixture fallback so review still opens

## Demo path

1. `/new` → grocery sample or drop a JPG/PNG/WEBP (max 8MB)
2. Wait for the scan
3. Display name, tap lines you owe
4. Copy share link → `/s/...`
5. Copy split for the chat

## Repo layout

```
apps/web       Next.js 15 (landing, /new, review, share)
apps/worker    Local job loop (optional in production)
packages/db    Drizzle schema + SQL migrations
packages/interfaze  Live + fixture providers
packages/ui    Design tokens
```

Internal packages are still `@proofsheet/*`. The product name is Vouch.

## Scripts

```bash
pnpm local          # docker + migrate + seed + web + worker
pnpm build          # production build (web)
pnpm db:migrate
pnpm db:seed
```
