## Plan: Close remaining feature gaps

Based on the previous audit, the core 7 pages, AI Sidekick, 5 "exceptional" features, SEO, sidebar reorg, Attorney Portal, journal OCR, and bulk past-incident flows are all live. Three known bugs were already fixed last turn. What's left worth shipping now:

### 1. Cryptographic chain-of-custody certificate in ZIP export
Currently `export-zip.functions.ts` bundles files + audit-log entry hashes, but does not emit a per-file tamper-evident certificate. Add:
- For each evidence file: compute SHA-256 of the bytes, capture original filename, MIME, size, upload timestamp, linked incident id, uploader user id.
- Emit `chain-of-custody.pdf` (or `.md` fallback if PDF rendering is too heavy in the Worker) listing every artifact with its hash, plus a manifest-level hash-of-hashes.
- Add a `verify.sh` helper that re-hashes the `evidence/` folder against `manifest.json` so a third party can confirm nothing was altered.

### 2. End-to-end smoke audit of all shipped features
Walk each route + key action and confirm it loads and saves cleanly. Anything broken gets fixed in the same pass. Focus areas based on past test reports:
- Onboarding → safety modal (already patched, reverify it doesn't reappear)
- Journal: manual entry, OCR autofill, "Add from Journal Entry" multi-incident split, "Add Multiple Past Incidents" all 4 recall modes
- Timeline / Calendar heat map / Patterns analysis refresh
- Evidence upload + linking to incidents
- Voice Notes record + transcribe
- Communications log
- Case Builder + Court Packet print
- Attorney Portal: invite, accept, multi-tab case view, first-time welcome, time logging
- OPRA Helper letter generation
- Settings: PIN lock, export ZIP download
- Login: single-tap toggle on mobile viewport

### 3. Fix anything the smoke audit surfaces
Bug fixes only — no scope creep. If a feature is broken, repair it. If a feature is merely "could be nicer," leave it alone and note it.

### Out of scope (explicitly not doing)
- Tier 2+ features previously deferred (PWA disguise tweaks beyond manifest name, geofenced lock, app-switcher blur, witness mgmt, expense tracker, multi-state FOIA, mood check-in, offline sync, global search, EXIF)
- Phase 3+ of the logo/UX spec
- Any new feature not previously requested

### Deliverable
A short report: ✅ verified working / 🛠 fixed during audit / ⚠️ known gap intentionally left. Plus the chain-of-custody certificate live in the next ZIP export.

Approve and I'll switch to build mode and ship it.