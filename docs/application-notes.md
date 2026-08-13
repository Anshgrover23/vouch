# Product notes

Vouch is the Interfaze-backed receipt split: grocery paper or a Venmo/Zelle screenshot in, merchant / date / total / line items out, housemates tap what they owe.

## What the demo should prove

- Receipt photos live in Supabase Storage. Review JSON is an image URL, not megabytes of base64.
- Interfaze `precontext` (confidence + bounding boxes) is on the canvas, not hidden.
- Worker claims jobs with `FOR UPDATE SKIP LOCKED`. One Interfaze extract call (HTTPS URL in production).
- Human edits never overwrite `model_value`.
- Fixture fallback so review still opens if Interfaze cannot fetch a localhost image.
- Share is a link + display name. Export is one line for the group chat.
- Failed OCR is a compact retry card, not the full canvas. Claim buttons stay visible but disabled until **That's me**.

## Demo clicks

1. `/` landing — Vouch logo goes home
2. `/new` → grocery sample or a photo → scan
3. Review: name + **That's me**, tap **I owe this** on two lines
4. Copy share link → `/s/...` as a second name
5. Copy split
