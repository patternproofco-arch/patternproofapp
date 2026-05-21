# Plan — PatternProof: Drive import + universal AI extract + cross-page wiring
# End-to-end app check

## Goal
Verify the core PatternProof flows actually work in the live preview — not just that the pages render, but that data saves, files upload, and AI/pattern features return real results. Report every issue I find with a clear fix.

## What gets tested

1. Sign-in + onboarding gate (already confirmed: account is logged in but blocked by onboarding wall — see "Blocker" below).
2. Journal — add an incident manually, edit it, delete it. Confirm it saves to `incidents` and appears in the list.
3. Journal AI autofill — upload a screenshot and verify the fields get drafted (calls `extractIncidentFromImage` server fn → Lovable AI).
4. Evidence — upload a photo, a PDF, and a short video. Verify each appears with a working signed-URL preview and can be linked to an incident.
5. Voice Notes — record / upload a short audio clip, confirm it plays back.
6. Timeline — confirm new incidents appear in chronological order with correct type colors.
7. Dashboard / Pattern analysis — confirm the pattern summary / counts reflect the test incidents.
8. Escalation Detector — verify it flags escalating severity across the test incidents.
9. Case Builder — create a case, attach incidents + evidence, save.
10. Court Packet — generate and confirm the printable view includes attached items.
11. Attorney Portal — create an access token, open the public `/attorney/<token>` link in a separate tab, confirm only the shared items appear and revoke works.
12. Legal Documents — upload a sample document and verify AI extraction populates fields.
13. OPRA Helper — generate a request letter.
14. Quick Exit + PIN lock — confirm both still work after the recent "PIN only on first page after login" change.
15. Console / network — watch for 4xx, 5xx, RLS errors, and server‑function failures during all of the above.

## Blocker — need your call

Your account has not finished onboarding, so every protected route redirects to `/onboarding`. Pick one:

- **A. Complete onboarding on your account.** I'll pick a 6-digit real PIN + a different 6-digit decoy PIN, a disguise name, and a state, then continue testing. I'll tell you the codes so you can change them afterward, and I'll clean up the test entries I create.
- **B. Test on a fresh throwaway account.** I sign up a new email (signups appear to be open), complete onboarding there, run the full sweep, and your data is never touched.
- **C. You finish onboarding yourself**, then I pick up testing from the dashboard. Slowest for you, cleanest for your data.

Default if you don't pick: **B** (throwaway account) — safest for your real records.

## How I'll run it

- Drive the preview with the browser automation (navigate, click, fill, upload small fixture files I generate in `/tmp`).
- Watch `browser--read_console_logs` and `browser--list_network_requests` after every flow to catch silent failures.
- For server-side features (AI extract, court packet generation, attorney public view) I'll also check the server-fn logs and Supabase analytics if anything looks off.
- For each feature I'll mark it ✅ working, ⚠️ working with caveats, or ❌ broken — with the exact error / repro and a one-line fix recommendation. No code changes in this plan; if you want fixes after the report I'll do them in a follow-up turn.

## Things I already noticed (free of charge)

- The safety modal at onboarding step 0 re-shows every time you land on a protected route while not onboarded, because step state is component-local and the route re-mounts. Low priority — only affects users mid-onboarding.
- `public/manifest.webmanifest` `name` is hard-coded to `"Daily Planner"` (the disguise default). Confirm that's intentional vs. `PatternProof` for the installable PWA name.

## Out of scope

- No code changes in this pass — this is a verification sweep.
- No load / performance testing.
- No security / RLS audit beyond noticing obvious leakage during the flows.
Three connected pieces. I'll build them in this order so each one unlocks the next.

## 1. Google Drive import (Legal Documents page)

- Add a **"Import from Google Drive"** button next to the existing upload control on `legal-documents.tsx`.
- Use the **Google Drive connector** via Lovable's connector gateway (developer-owned account model — the user signs into their own Google account through the connection picker once; subsequent imports use that connection).
- Flow:
  1. User clicks Import → Drive file picker (a simple list-and-search UI fed by `files.list` through the gateway, filtered to PDFs and images).
  2. User picks a file → server function downloads bytes from `files.get?alt=media`, uploads to the existing `evidence-files` storage bucket, then runs the same extraction pipeline as a normal upload.
- New server function `src/lib/drive-import.functions.ts` with `listDriveFiles` and `importDriveFile` (both auth-protected).
- Surface a clear "Connect Google Drive" empty state if the connection isn't linked yet.

## 2. Universal AI extraction (any document type)

Today `extractLegalDocument` only handles images. Expand it so the same auto-fill works on every upload point:

- **PDF support**: switch the extractor to accept PDFs. Strategy: use the Lovable AI Gateway's vision model with PDF input where supported, otherwise fall back to PDF.js text extraction on the server function and send extracted text. (PDF.js is Worker-safe.)
- **New generic extractor** `extractDocument` that returns a typed JSON union based on context:
  - `legal_document` → fields already defined.
  - `incident` → date, time, location, description, abuse_types[], witnesses, emotional_impact.
  - `evidence` → title, date, description, suggested file_type.
  - `voice_note_summary` → title, date, key points (used after voice note transcription).
- Wire **auto-fill** into:
  - Journal "New incident" form (upload a screenshot of a text or email → AI fills the form for review).
  - Evidence upload (AI suggests title and description and links to nearest incident by date).
  - Legal Documents (already wired, swap to the new generic function).
- Every AI-filled field shows a small "AI suggested — edit me" hint and the user must confirm before save.

## 3. Cross-page integrations

The pages exist but don't talk to each other. Wire them up:

- **Legal Documents → Timeline**: each saved legal document with an `effective_date` or `incident_date` appears as a dedicated marker on Timeline (different visual treatment than incidents — uses doc-type accent on the left border).
- **Legal Documents → Case Builder**: Case Builder gains a new "Legal documents" step (between Pattern and Key incidents) that lists the user's documents and lets them attach the relevant ones to the case.
- **Legal Documents → Court Packet**: new **Section 5: Legal Documents** in the printed packet, listing each attached document with case number, court, dates, parties, and key terms. Images get a thumbnail; PDFs get a "see attached" line.
- **Legal Documents → Evidence**: the existing mirror-into-evidence behavior gets a new "Legal Document" filter chip on the Evidence page so users can find them quickly.
- **Recordings → Incidents**: after a recording stops, prompt "Was this an incident? Create one from this recording" → opens the Journal form prefilled from the transcript (uses the new universal extractor).
- **Escalation Detector**: include legal-document events (e.g., a new TRO issued, a violation report) in escalation scoring.

## What I need from you before I start

I'm going to ask one quick question about the Google Drive scope (the only thing I can't infer), then build everything above.

## Technical details

- Drive connector: `standard_connectors--connect` with `connector_id: google_drive`. All Drive calls go through `https://connector-gateway.lovable.dev/google_drive/drive/v3/...` from server functions using `LOVABLE_API_KEY` + `GOOGLE_DRIVE_API_KEY`.
- AI extraction: continue using `google/gemini-2.5-pro` via Lovable AI Gateway for vision; add PDF.js (`pdfjs-dist`) for server-side text fallback (Worker-compatible build).
- All new server functions use `requireSupabaseAuth` middleware and Zod input validation.
- No new tables required — `legal_documents`, `incidents`, `evidence`, `recordings`, `cases` already exist. I'll add a small `legal_document_ids: uuid[]` column to `cases` so attachments persist (one migration).
- Design stays inside the existing token system (`#C99878` bg, `#DEB896` cards, terracotta CTAs, Georgia serif headings, no red/purple).
