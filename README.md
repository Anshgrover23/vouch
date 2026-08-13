# Vouch

Roommate and trip splits that cite the paper. Upload a grocery receipt or a Venmo/Zelle screenshot. Interfaze reads merchant, date, total, and line items. Housemates tap **I owe this** or **Not mine**. When people have vouched, you copy a line for the group chat:

`HILLCREST MARKET 13 Aug — $84.20 — 3 people vouched`

## Run locally

Needs Docker (Postgres), Node 20+, and [pnpm](https://pnpm.io/).

```bash
cp .env.example .env.local
# paste INTERFAZE_API_KEY if you have one
pnpm install
pnpm local
```

That starts Postgres, migrates, seeds, then the Next.js app and the worker.

- App: [http://localhost:3000](http://localhost:3000)
- New receipt: [http://localhost:3000/new](http://localhost:3000/new)

`.env.local` is gitignored. Never commit it.

## Environment

| Variable | Required | What it does |
| --- | --- | --- |
| `DATABASE_URL` | yes | Local Docker Postgres (`postgres://proofsheet:proofsheet@localhost:5432/proofsheet`) |
| `SESSION_SECRET` | yes | Signs the demo session cookie |
| `INTERFAZE_API_KEY` | no | Live OCR. Empty → fixture receipts |
| `PROOFSHEET_FIXTURE` | no | Set `1` to force fixtures even with a key |

Optional keys in `.env.example` (Supabase, Stripe, eval sidecar) are stubs. The Vouch flow does not need them yet.

## How extraction works

The browser never talks to Interfaze. Next.js writes a job. The Node worker claims it with `FOR UPDATE SKIP LOCKED`, calls Interfaze, and stores fields plus bounding boxes.

- **No key** → Hillcrest Market / payment fixtures, boxes already placed.
- **Key present** → live Interfaze. If Interfaze cannot fetch the image (localhost URLs, `file_processing_error`), the worker falls back to the same fixtures so review still opens.

Live OCR on a real receipt needs a URL Interfaze can fetch (deployed HTTPS) or sending the image bytes instead of `http://localhost:3000/samples/...`.

## Demo path

1. Open `/new`
2. Pick **Grocery receipt** (or drop a JPG/PNG/WEBP, max 8MB)
3. **Read the receipt** — wait for the scan
4. Type a display name, tap lines you owe
5. **Copy share link** — housemates join at `/s/...` with a name, no account
6. **Copy split** for the chat

## Repo layout

```
apps/web       Next.js 15 app (landing, /new, review, share)
apps/worker    Job loop → Interfaze
packages/db    Drizzle schema + SQL migrations
packages/interfaze  Live + fixture providers
packages/ui    Design tokens
```

Internal package names are still `@proofsheet/*`. The product name is Vouch.

## Scripts

```bash
pnpm local          # docker + migrate + seed + web + worker
pnpm build          # production build (web)
pnpm db:migrate
pnpm db:seed
```
