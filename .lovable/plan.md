## Communications Log — Polish & Extend

### Current state
Page exists at `/communications` with form (date/time, channel pills, direction, from, content, screenshot upload, harassment flag, notes), list with channel/flag filters, screenshot signed-URL preview, and delete. Schema already supports `linked_incident_id`.

### Changes

**1. Link a communication to an incident (new)**
- Add an Incident select to the form: searchable dropdown of the user's incidents (date · short description), plus "Not linked". Saves to existing `linked_incident_id` column.
- On a comm card, when linked, show a small pill "Linked to incident · {date}" that routes to `/journal` (or incident detail if available). Hover/affordance subtle, no heavy chrome.

**2. Search (new)**
- Single search input above the filter row. Case-insensitive match against `content`, `from_party`, and `notes` (client-side over already-loaded rows).
- Empty-state copy adapts: when search returns 0 with data present → "No communications match that search."

**3. Bulk paste of a text thread (new)**
- Secondary "Paste a thread" button next to "Log a communication" header (toggles a compact panel inside the form column, not a modal).
- Textarea + parser for common formats:
  - `[YYYY-MM-DD HH:MM] Name: message`
  - `MM/DD/YY, HH:MM AM/PM - Name: message` (WhatsApp-style)
  - Plain `Name: message` lines (date defaults to a single user-picked date for the whole thread).
- Shared channel (default `text`), shared date fallback, default direction inferred from `from_party` matching a "Me" label vs other.
- Preview parsed rows in a small list with per-row remove, then "Save N messages" inserts them in one batch.
- Per-row harassment flag toggle in preview (optional).

**4. Polish pass**
- Tighten copy to brand voice; replace any neutral phrasing with grounded warmth (e.g. confirm "Saved. Your record is safe." stays; soften delete confirm to a custom inline confirm instead of `window.confirm`).
- Replace `confirm()` with an inline "Tap again to remove" two-step on the trash button (matches no-modal-for-simple-actions rule).
- Adjust card left-border accent to match channel color when not flagged (flagged stays terracotta `--primary`), using small channel color map in tokens-only fashion (use existing `--accent`, `--secondary`, `--muted` etc., no new hex literals).
- Fix filter row wrapping on the current 744px viewport: make filter chips horizontally scrollable on narrow screens (`overflow-x-auto` + `flex-nowrap` on a wrapper) so they don't push the heading.
- Add a clear "Linked" filter chip alongside "All / Flagged".
- Add visible counts on the list heading: "All communications · {n}".
- Add `aria-label`s to channel/direction pill groups; ensure focus-visible rings use `--accent`.
- Confirm screenshot upload error path actually surfaces filename + retry instruction.
- Add lightweight Zod validation for the form fields (date required, content length ≤ 5000, from_party ≤ 200, notes ≤ 2000) with calm inline messages.

**5. File structure**
- Keep `src/routes/_authenticated/communications.tsx` as the route shell only.
- Extract into `src/components/communications/`:
  - `CommForm.tsx` (single-entry form)
  - `BulkPastePanel.tsx` (thread parser + preview)
  - `CommCard.tsx` (one row)
  - `CommFilters.tsx` (search + chips)
- Shared types in `src/components/communications/types.ts`.
- Keeps each file under the 150-line rule.

### Out of scope
- No dashboard surfacing (per your answer).
- No schema changes — `linked_incident_id` and all fields already exist.
- No realtime, no export changes (court packet integration can be a follow-up).

### Verification
- Log a comm with each channel; confirm card renders with correct icon and left border.
- Link a comm to an existing incident; reload; confirm pill persists and routes.
- Search across content/from/notes; confirm empty-state copy switches.
- Paste a WhatsApp-style thread; confirm parser preview; save; confirm rows appear with correct dates.
- Resize to 744px; confirm filter chips scroll horizontally without breaking heading.
- Delete via two-step button; confirm no native `confirm()` appears.
- No console errors.
