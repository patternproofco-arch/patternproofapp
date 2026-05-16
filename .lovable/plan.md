# Plan — PatternProof: Drive import + universal AI extract + cross-page wiring

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
