# Vouch

Roommate and trip splits that cite the paper. Sign up, snap a receipt or type the lines, housemates tap **I owe this** or **Not mine**. Groups keep who owes whom. When people have vouched, you copy a line for the group chat:

`HILLCREST MARKET 13 Aug — $84.20 — 3 people vouched`

## Run locally

Needs Docker (Postgres), Node 20+, and [pnpm](https://pnpm.io/).

```bash
cp .env.example .env.local
# paste INTERFAZE_API_KEY
# optional: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for live Storage
pnpm install
pnpm local
```

- App: [http://localhost:3000](http://localhost:3000)
- Sign up: [http://localhost:3000/signup](http://localhost:3000/signup)
- New receipt: [http://localhost:3000/new](http://localhost:3000/new) (signed in)

`.env.local` is gitignored. Never commit it.

## Environment

| Variable | Required | What it does |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres. Local Docker, or pooled Supabase/Neon in production |
| `SESSION_SECRET` | yes | Signs the session cookie. Must match across Node and Edge middleware |
| `INTERFAZE_API_KEY` | for live OCR | Empty → fixture receipts |
| `NEXT_PUBLIC_APP_URL` | yes in prod | `https://vouch.anshgrover.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | for Storage | Project URL, e.g. `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | for Storage | Secret key (`sb_secret_…`). Server only |
| `PROOFSHEET_FIXTURE` | no | Set `1` to force fixtures even with a key |

Without the Storage pair, local writes `public/uploads/` and inlines a small data URL for Interfaze. Production without those keys falls back to a resized data URL in Postgres (slow). With them, files go in the public `receipts` bucket and Interfaze fetches the HTTPS URL.

## Production (`vouch.anshgrover.com`)

You need **three services**. Nothing else (no Stripe, GraphQL, Fly, or Python).

1. **Interfaze** — key you already have. [dashboard](https://interfaze.ai/dashboard)
2. **Supabase** — Postgres **and** Storage (same project). [dashboard](https://supabase.com/dashboard)
3. **Vercel** — hosts the Next.js app. Worker is not required in production: the app processes extract jobs on the request path.

### 1. Database + Storage

Create a free Supabase project. Migrate from your laptop:

```bash
DATABASE_URL='postgres://...pooler.supabase.com:6543/postgres' pnpm db:migrate
DATABASE_URL='postgres://...pooler.supabase.com:6543/postgres' pnpm db:seed
```

Use the pooler URI (`6543` / `pooler` in the host). Prepared statements are already disabled when the URL contains `pooler`.

In **Settings → API Keys**, copy:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL` (no `/rest/v1`)
- **Secret keys** → `sb_secret_…` → `SUPABASE_SERVICE_ROLE_KEY`  
  (The legacy `service_role` JWT still works; prefer the new secret.)

The app creates a public `receipts` bucket on first upload if it is missing. You can also create it in **Storage → New bucket** (`receipts`, public).

### 2. Vercel

Import [Anshgrover23/vouch](https://github.com/Anshgrover23/vouch).

- Framework: Next.js
- Root Directory: `apps/web`
- Include files outside the root (pnpm workspace) — Vercel does this by default for pnpm

Environment variables (Production + Preview):

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

### 3. Hostinger DNS (anshgrover.com stays where it is)

In Vercel → Project → Settings → Domains → add `vouch.anshgrover.com`.

In Hostinger hPanel → DNS zone for `anshgrover.com` → add:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `vouch` | `cname.vercel-dns.com` |

(Vercel shows the exact target if it differs.) Do **not** change A records for the apex `anshgrover.com`. Wait for DNS (often a few minutes, sometimes up to an hour).

### Check live OCR

Open `https://vouch.anshgrover.com/new` → drop a photo → Read. Vercel logs should show:

```
[upload] resized … storage=true
[extract] interfaze …ms bytes=https://….supabase.co/storage/v1/object/public/receipts/….jpg
```

If `bytes=` is a huge number or `storage=false`, the Storage env vars are missing on that deploy. Review should show **live** fields from the real paper, not Hillcrest fixtures.

## How extraction works

The browser never talks to Interfaze. Next.js resizes the JPEG (max edge 1800px), stores it, writes a job, then processes it (locally a Node worker also claims jobs with `FOR UPDATE SKIP LOCKED`).

- **Storage configured** → public HTTPS URL in `documents.source_url`. Interfaze fetches that file.
- **Local without Storage** → `/uploads/…` on disk; Interfaze gets a small data URL because it cannot fetch localhost.
- **No key** → Hillcrest Market / payment fixtures
- **Key present** → live Interfaze. On failure (timeouts, `model_error`), fixture fallback so review still opens

Document and split JSON return an image URL, never the bytes.

Owners can skip junk OCR lines, rename items, and the receipt total recomputes. No photo? Type merchant, date, total, and lines on `/new`.

## Using the app

1. `/signup` — name, email, password (8+). First run goes to `/onboarding` (start a group or skip).
2. `/new` — snap a receipt, use a sample, or type the lines. Optional group on the receipt.
3. `/review/[id]` — confirm who you are, tap lines you owe, invite housemates. Share link is `/s/...`.
4. `/groups` — households and trips. Star from the list. Balances, totals, activity, CSV.
5. `/inbox` — your splits. `/account` — name and password.

`/new`, `/inbox`, `/groups`, `/account`, and `/review/...` require a signed-in, onboarded session. Share links (`/s/...`) do not.

Seeded `demo@proofsheet.dev` has no password hash and cannot log in. Create a real account.

## Tests and CI

```bash
pnpm test           # unit: web lib + Interfaze
pnpm test:e2e       # Playwright against localhost:3000 (needs Postgres)
```

GitHub Actions on push and PR:

| Check | What it runs |
| --- | --- |
| **Build** | `pnpm --filter @proofsheet/web build` |
| **Test / unit** | `pnpm test` |
| **Test / e2e** | Docker-matching Postgres 16, `pnpm db:migrate`, Playwright Chromium with `PROOFSHEET_FIXTURE=1` |

E2E CI does **not** use production `DATABASE_URL` or secrets. It boots its own database and a dummy `SESSION_SECRET`. No GitHub Secrets to add for these jobs.

Local e2e: `pnpm local` (or Postgres on `:5432`), then `pnpm test:e2e`. Playwright starts `pnpm dev` unless something is already on port 3000.

## Repo layout

```
apps/web       Next.js 15 (landing, auth, /new, inbox, review, groups, share)
apps/worker    Local job loop (optional in production)
packages/db    Drizzle schema + SQL migrations (including auth + groups)
packages/interfaze  Live + fixture providers
packages/ui    Design tokens
```

Internal packages are still `@proofsheet/*`. The product name is Vouch.

## Scripts

```bash
pnpm local          # docker + migrate + seed + web + worker
pnpm test           # unit tests
pnpm test:e2e       # Playwright
pnpm build          # production build (web)
pnpm db:migrate
pnpm db:seed
```
