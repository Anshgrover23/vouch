# Product notes

Vouch is the Interfaze-backed receipt split: grocery paper or a Venmo/Zelle screenshot in, merchant / date / total / line items out, housemates tap what they owe. Accounts, groups, and an editable review canvas sit on top of that.

## What the product should prove

- Email/password signup and login. Session cookie signed with `SESSION_SECRET`. Middleware sends `/new`, `/inbox`, `/groups`, `/account`, and `/review/...` to `/login` until you are onboarded.
- Receipt photos live in Supabase Storage. Review JSON is an image URL, not megabytes of base64.
- Interfaze `precontext` (confidence + bounding boxes) is on the canvas, not hidden.
- Worker claims jobs with `FOR UPDATE SKIP LOCKED`. One Interfaze extract call (HTTPS URL in production).
- Human edits never overwrite `model_value`. Owners can skip junk OCR lines and rename items; total recomputes.
- No photo: type merchant, date, total, and lines. Same tap canvas.
- Fixture fallback so review still opens if Interfaze cannot fetch a localhost image.
- Share is a link + display name. Export is one line for the group chat.
- Failed OCR is a compact retry card, not the full canvas. Claim buttons stay visible but disabled until identity is confirmed.
- Groups: name a household or trip, add people before they sign up, star from the list, pairwise balances, mark settled, download CSV.
- Seeded `demo@proofsheet.dev` cannot log in (no password hash). Use `/signup`.

## Demo clicks

1. `/` — guest: How it works, Features, Sign in, Get started. Signed in: New receipt.
2. `/signup` → onboarding (name a group or skip).
3. `/new` → grocery sample, a photo, or type the lines.
4. Review: confirm who you are, skip a junk line if needed, tap **I owe this** on two lines, invite a housemate.
5. Copy share link → `/s/...` as a second name.
6. Copy split. Open `/groups` and star the household.
