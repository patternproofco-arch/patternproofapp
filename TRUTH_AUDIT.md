# PatternProof — Truth & Capability Audit

Second pass, August 12 2026. This document records what has been checked, how it was
checked, and what remains unproven. It is not a statement that every user-visible
string in the app has been reviewed — see **Coverage** and **Unresolved** below.

## Evidence levels used here

- **code-verified** — the code path exists and was read end to end. Not executed.
- **runtime-probed** — an actual request was made and the response observed.
- **production-tested** — exercised end to end against live third-party systems with real data.
- **unverified** — asserted somewhere but not demonstrable from code or runtime.

No claim in this document is marked production-tested unless a command in
**Commands run** produced that result.

---

## 1. Clio — NOT verified, all user-facing claims downgraded

What the code actually contains (code-verified):
- `src/lib/clio.server.ts` — full OAuth authorize-URL builder, authorization-code and
  refresh-token exchange against `app.clio.com`, `who_am_i` identity fetch, token refresh
  with persistence to `clio_connections`.
- `src/routes/integrations.clio.callback.ts` — a **server route** (`.ts`, `server.handlers.GET`)
  that consumes a one-time `clio_oauth_states` row, exchanges the code, upserts
  `clio_connections`, and returns a 302 to `/billing?clio=connected|error`.
- `src/lib/clio-matters.server.ts` / `clio-matter-links.functions.ts` — matter list/search and
  matter↔case linking, gated on survivor `clio_share_consent`.
- Secrets `CLIO_CLIENT_ID` and `CLIO_CLIENT_SECRET` exist in the project.

**Resolution of the previously recorded production discrepancy:** project knowledge described
`integrations.clio.callback` as a placeholder React component and flagged the live 302 to
`/billing` as unexplained. That was a stale note. The route is `integrations.clio.callback.ts`,
a server route whose only responses *are* 302s to `/billing` with a `reason` query param. Live
behavior matches the repository. No out-of-repo edge config is involved. **Discrepancy closed.**

**What is still NOT proven:**
- Clio app approval status. Unknown from this repo.
- Whether `CLIO_CLIENT_ID` is accepted by Clio. A runtime probe of
  `GET https://app.clio.com/oauth/authorize?client_id=…` returned `302 → /session/new`
  (Clio's login page). Clio redirects unauthenticated callers to login *before* validating
  the client, so this is **inconclusive** — it proves neither a valid nor an invalid client.
- Token exchange, `who_am_i`, matter list, and matter linking have **never** been executed
  against a live Clio account. No end-to-end test is possible from here without real Clio
  credentials and a real Clio user session, and doing so would create production data.

**Actions taken:** every user-facing Clio surface now says it is unverified beta —
`_attorney/billing.tsx` panel header, explanatory notice, "Try connecting to Clio (beta)"
button, matter-browser caveat; `_attorney.tsx` nav label "Clio (beta)"; the survivor consent
toggle in `share-with-attorney.tsx` states the integration may do nothing yet.

**ZIP export (code-verified, not production-tested):** `src/lib/export-zip.functions.ts` uses
JSZip to emit `incidents.csv`, `evidence.csv`, `communications.csv`, `voice_notes.csv`,
`legal_documents.csv`, `case.json`, `narrative.md`, `manifest.json`,
`provenance-and-integrity.md`, `verify.sh`, plus evidence/voice-note/message-thread folders,
uploaded to the private `exports` bucket. There is **no** `generateClioPackage` function in the
codebase (project knowledge said otherwise — that reference is stale). The app describes this
as a generic "case management import package", which is accurate. Do not describe it as a
Clio-specific or Clio-certified export.

## 2. Firm features — priced claims not enforced anywhere

| Claim (as priced) | Traced to | Verdict | Action |
| --- | --- | --- | --- |
| "Up to 15 attorney seats" / "3–15 seats" | no seat counter, no seat table, no check in `payments.functions.ts`, `firm-grants.functions.ts`, or any middleware | **unsupported** | Replaced everywhere with "Shared firm workspace — invite colleagues to a case (seats not metered today)" |
| "Unlimited active client matters" | no matter cap logic anywhere | technically true only because nothing is enforced | Replaced with "No matter limit enforced today" |
| Solo "Up to 10 active client matters" | no enforcement | **unsupported limit** | Replaced with "Single attorney account (seats and matter counts are not metered today)" |
| "Multi-attorney collaboration and shared case notes" | `firms` table + `attorney_profiles.firm_id` + `case_grants` (`firm-grants.functions.ts` create/join firm, list colleagues, grant/revoke case access) + `attorney_client_links.attorney_case_notes` read/write in `attorney-portal.functions.ts` | **code-verified** | Kept |
| "A caseload view across the firm" | `case_grants` surfaces cases colleagues share with you; there is no unconditional firm-wide view | overstated | FAQ rewritten to "a caseload view of the cases shared with you" |
| "Firm-wide document requests" | `attorney_document_requests` is scoped by `link_id` per client | **unsupported** | Changed to "Per-client document requests" |
| "Firm-wide conflict-of-interest detection" (first pass) | `conflict-check.server.ts` filters on `attorney_user_id` | **unsupported** | Already narrowed to "across your own PatternProof caseload" |

The pricing FAQ now states plainly that seat and matter counts are commercial expectations,
not technical caps.

## 3. Encryption — at-rest downgraded to unverified

Provable from this repo and runtime: HTTPS/TLS in transit, and per-row access control via
Postgres row-level security (policies present on every user table).

**Not provable from here:** at-rest disk/object encryption. It is a managed-platform property
of the infrastructure host. No configuration export, contract, or attestation was available to
inspect during this audit, so it is recorded as **unverified**.

Public copy changed from "Encrypted in transit and at rest" to "Protected with per-user access
controls and encrypted in transit" in: `index.tsx` (×2), `__root.tsx` (meta, og, twitter, both
JSON-LD descriptions), `login.tsx` (meta ×2, body), `how-it-works.tsx`, `pricing.tsx` (feature
bullet), `survivor-invite.$token.tsx`, `live-recording.tsx`, `_attorney/setup.tsx`.
`privacy.tsx`, `pricing.tsx` FAQ, and `public/llms.txt` now say at-rest encryption is a host
platform feature that we have not independently audited or certified.

## 4. "Confidential" removed as a product promise

`_attorney.tsx` chrome said "Encrypted in transit · confidential". "Confidential" is a legal
representation with no documented technical or policy basis behind it, so it is now
"Encrypted in transit · access logged". Remaining uses of "confidential" are **attorney-side
acknowledgements** the professional themselves affirms (`accept-invite`, `collaborator-invite`,
`_attorney/setup`, `_attorney/trust`) or descriptions of third-party hotlines' own stated
policy (`resources.tsx`) — those are not PatternProof promises and were left alone.

## 5. Integrity features — code-verified only

- **SHA-256 hashing** and **perceptual dHash near-duplicate detection**: implemented in
  `src/lib/evidence-ingest.functions.ts`. **Code-verified, not production-tested.** No synthetic
  upload run was performed in this pass, so hash correctness, dHash threshold behavior at
  Hamming distance 10, and the survivor-facing duplicate flow are unproven at runtime.
- **GPS quarantine**: `src/lib/evidence-enrichment.functions.ts` stores EXIF GPS in quarantined
  columns and only surfaces coordinates when `gps_reveal_opt_in` is set for that item.
  **Code-verified, not production-tested** — no test confirming an attorney-side view actually
  omits GPS was run.

Public copy about these features describes what they do; none of it claims third-party
certification, so no copy change was required. Do not add one until runtime tests exist.

## 6. Pricing and entitlement — code-verified, checkout not tested this pass

- Lookup keys `attorney_solo_monthly`, `attorney_firm_charter_monthly`, `attorney_firm_monthly`,
  `court_ready_monthly`, and pay-what-you-can ($1–$500) exist in `src/lib/payments.functions.ts`.
- `getCharterAvailability()` enforces a 10-seat Charter cohort and drives the live count on
  `/pricing` — no hardcoded number in copy.
- `isAttorneyEntitled()` requires an active Solo/Charter/Firm subscription.
- The `entitlements` table and the `checkout.session.completed` webhook handler in
  `src/routes/api/public/payments/webhook.ts` exist and write via service role.

**Not tested in this pass:** that the corresponding Stripe live products/prices resolve, that a
live checkout completes, or that the webhook fires and writes an entitlement row end to end.
Code-verified only. A prior session reported a successful production attorney checkout; that
result is not reproduced or confirmed here.

## 7. Survivor pricing — "forever" removed

"Free forever", "always free", and "free, and always" are unbounded future promises with no
binding policy behind them. Changed to present-tense "free" / "at no cost" / "Survivors do not
pay today" in `pricing.tsx` (meta description, og:description, tier sub-label, quote, DV-org
bullet, two FAQ answers), `how-it-works.tsx`, and `_authenticated/court-ready.tsx`.

## 8. First-pass items carried forward (still correct)

- Survivor card "only yours" → shared-when-you-choose wording (`index.tsx`).
- DV-org "You never see her records" → no automatic visibility; scoped, revocable grant
  (`how-it-works.tsx`).
- Outcome claim "difference between a case that moves and one that stalls" removed.
- "Judges tend to weigh contemporaneous records more heavily" softened (`self-help-guide.tsx`).
- Demo severity labels → entry counts. The demo's "Export (.docx)" button was changed to
  "Export packet (PDF)": the demo shows a survivor record, and survivor-side exports emit PDF
  and a ZIP of CSV/MD/JSON, not .docx. **Correction to the first pass:** a real .docx export
  *does* exist, but only on the attorney side — `_attorney/clients.$clientId.tsx` builds a
  Professional-Review Packet with the `docx` library (`Packer.toBlob`). Attorney-facing copy may
  accurately mention .docx; survivor-facing copy may not.
- AI neutrality constraints in `pattern-analysis.functions.ts`, `ai-chat.functions.ts`,
  `agent-prompt.ts`; unreviewed AI claims filtered from exports by `pattern-export.ts`.

---

## Unresolved / Not end-to-end tested

1. **Clio, entirely.** App-approval status unknown; OAuth token exchange, identity fetch, matter
   list/search, and matter linking have never run against a live Clio account. The authorize
   probe was inconclusive. All UI is labeled unverified beta pending a real test.
2. **At-rest encryption.** Relies on the infrastructure host's platform behavior. No
   configuration evidence, contract, or attestation was inspected.
3. **SHA-256 / dHash / GPS quarantine.** Code-verified only; no synthetic-data runtime test.
4. **Stripe live checkout and webhook delivery.** Code-verified only; not exercised this pass.
5. **Seat and matter metering.** Does not exist. Firm/Solo tier differences are commercial, not
   technical. Anyone on any paid plan can currently add as many colleagues and matters as the
   UI permits.
6. **Email deliverability, transcription accuracy, and OCR accuracy.** Never in scope for this
   audit; no claims about them were reviewed.
7. **Advocate-side data visibility.** The narrowed copy is based on reading the grant logic, not
   on logging in as an advocate and confirming the rendered fields.

## Coverage

Reviewed: the marketing and legal routes (`index`, `how-it-works`, `pricing`, `for-attorneys`,
`demo`, `sample-case`, `privacy`, `terms`, `professional-access`, `self-help-guide`,
`resources`, `waitlist`, `llms.txt`, `__root` metadata), the attorney billing/subscribe/setup
surfaces, the invite routes, and the Clio, export, conflict-check, evidence-ingest,
evidence-enrichment, pattern-analysis, and payments modules.

**Not exhaustively reviewed:** every string in the authenticated survivor app (dashboard,
archive/journal, timeline, evidence, voice notes, communications, message threads, court packet,
patterns, settings, onboarding, agent), the advocate and org portals, admin routes, and email
templates. This audit does **not** claim that every user-visible claim in the product has been
checked.

## Commands run

```
bunx tsgo --noEmit    # PASS — no output, exit 0
bun run build         # PASS — "✓ built in 24.65s", nitro/cloudflare output generated, exit 0
bun run lint          # FAIL — 9,487 problems, ~all prettier/prettier formatting errors,
                      #   pre-existing and repo-wide (9,409 auto-fixable). No correctness
                      #   errors attributable to this audit's edits. Not fixed here: a
                      #   repo-wide reformat would bury the audit diff.
curl -sI "https://app.clio.com/oauth/authorize?client_id=…&redirect_uri=…"
                      # → HTTP 302, Location: /session/new  (INCONCLUSIVE — Clio redirects
                      #   unauthenticated callers to login before validating client_id)
```

**Tests:** the project has no test suite. `package.json` scripts are dev/build/build:dev/
preview/lint/format/seo:check/security:audit — there is no `test` script, and a repo-wide
search for `*.test.*` / `*.spec.*` outside `node_modules` returned nothing. So "run the tests"
could not be satisfied: there are none to run. Typecheck and production build are the only
automated gates that exist.

## Standing rules for future copy

1. Never write "encrypted" unqualified. In transit = provable. At rest = host platform,
   unverified. Never imply zero-knowledge/E2E.
2. Never claim a court outcome, admissibility, or how a judge will react.
3. Conflict check is the signed-in attorney's own caseload.
4. AI output is counts and groupings of what the survivor recorded — no severity, diagnosis,
   or intent.
5. Advocates and attorneys see what the survivor shares; "never sees" is false once a grant exists.
6. Export copy must match what the export code emits: PDF and a ZIP of CSV/MD/JSON. No .docx.
7. Do not price a feature that has no enforcement. If seats or matter caps are sold, meter them first.
8. Clio stays labeled unverified beta until an end-to-end run against a live Clio account is recorded here.
9. No "forever" / "always" pricing promises.
