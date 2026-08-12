# PatternProof — Truth & Capability Audit

Audit of public and in-app claims against the actual code, schema, and integrations.
Last run: August 2026. Scope: marketing routes, in-app copy, exports, AI features, pricing.

## Method
Each claim was traced to the code path that would have to be true for it to hold.
Claims that could not be traced were rewritten to what the code actually does, or removed.

## Findings and actions

| Claim | Where | Reality in code | Action |
| --- | --- | --- | --- |
| "private, encrypted, only yours" | `src/routes/index.tsx` survivor card | TLS in transit + provider at-rest encryption; not zero-knowledge; survivor can share scoped links | Rewritten: "private to your account, encrypted in transit and at rest, shared only when you choose" |
| "encrypted" used unqualified | `__root.tsx`, `login.tsx`, `llms.txt`, invite + attorney shells, `_attorney/setup.tsx` | Same as above | All qualified as "in transit and at rest"; `llms.txt` explicitly states it is not end-to-end / zero-knowledge |
| "You never see her records" (DV orgs) | `src/routes/how-it-works.tsx` | Advocates DO see shared records once a survivor grants an advocate link (`advocate_client_links`, `src/lib/advocate.functions.ts`) | Rewritten to: no automatic visibility; survivor grants a scoped, revocable link |
| "often the difference between a case that moves and one that stalls" | `how-it-works.tsx` | Outcome claim with no supporting basis | Removed; replaced with a description of the artifact produced |
| "judges tend to weigh contemporaneous records more heavily" | `src/routes/self-help-guide.tsx` | Empirical claim about judicial behavior, unsupported | Softened to a claim about presentability of contemporaneous, source-linked records |
| "Firm-wide conflict-of-interest detection" | `pricing.tsx`, `_attorney/billing.tsx` | `src/lib/conflict-check.server.ts` scopes strictly to `attorney_user_id` — the signed-in attorney's own caseload only | Rewritten to "Conflict-of-interest check across your own PatternProof caseload" |
| "high / medium severity" pattern labels | `src/routes/demo.tsx` | Live Recurline shows counts only; severity grading was removed as interpretive | Severity labels replaced with entry counts |
| "Patterns — what the AI surfaces that one-off incidents miss" | `demo.tsx` | AI counts recurrence; it does not interpret | Rewritten: "recurrence across entries, counted not interpreted" |
| "Export (.docx)" | `demo.tsx` | `src/lib/export-zip.functions.ts` and `payments.functions.ts` produce PDF + ZIP (CSV/MD); no .docx exists | Changed to "Export packet (PDF)" |

## Verified as accurate (no change needed)
- **Evidence integrity** — SHA-256 file hashing and perceptual dHash near-duplicate detection are implemented in `src/lib/evidence-ingest.functions.ts`.
- **GPS quarantine** — EXIF GPS is stored quarantined and only surfaced with per-item `gps_reveal_opt_in` (`src/lib/evidence-enrichment.functions.ts`).
- **AI neutrality** — `pattern-analysis.functions.ts`, `ai-chat.functions.ts`, and `agent-prompt.ts` forbid diagnosis, legal conclusions, and predictions about judges; unreviewed AI claims are filtered out of exports by `src/lib/pattern-export.ts`.
- **No admissibility promises** — `professional-access.tsx` and `conflict-check.tsx` already disclaim admissibility and independent verification.
- **Clio** — copy claims matter linking and a Clio-compatible ZIP import package only; no two-way sync is advertised anywhere, matching `clio-matters.server.ts` / `export-zip.functions.ts`.
- **Pricing** — Solo $297, Firm Charter $597 (12-month lock), Firm $897 match Stripe lookup keys; Charter cohort cap is 10 and is read live from `getCharterAvailability()`.
- **Survivor tier** — free-forever claims match code: no survivor paywall gates the packet or attorney sharing.

## Standing rules for future copy
1. Never write "encrypted" unqualified — it is TLS + at-rest, not zero-knowledge.
2. Never claim an outcome in court, a judge's reaction, or admissibility.
3. Conflict check is own-caseload scope until a firm-scoped query actually ships.
4. AI output is counts and groupings of what the survivor recorded — never severity, diagnosis, or intent.
5. Advocates and attorneys see what the survivor shares; "never sees" is only true absent a grant.
6. Export formats in copy must match what the export code emits (PDF, ZIP of CSV/MD).
