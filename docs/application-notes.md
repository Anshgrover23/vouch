# Product notes

Vouch is the Interfaze-backed receipt split: grocery paper or a Venmo/Zelle screenshot in, merchant / date / total / line items out, housemates tap what they owe.

## What the demo should prove

- Interfaze `precontext` (confidence + bounding boxes) is on the canvas, not hidden.
- Worker claims jobs with `FOR UPDATE SKIP LOCKED`. Cheap OCR first, then structured extract.
- Human edits never overwrite `model_value`.
- Fixture fallback so review still opens if Interfaze cannot fetch a localhost image.
- Share is a link + display name. Export is one line for the group chat.

## Demo clicks

1. `/` landing
2. `/new` → grocery sample → scan
3. Review: tap **I owe this** on two lines
4. Copy share link → `/s/...` as a second name
5. Copy split
