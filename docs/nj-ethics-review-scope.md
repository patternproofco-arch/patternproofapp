# NJ ethics attorney review — scope note

Required before this system carries real survivor data (see
`docs/breach-and-wrongful-share-response-plan.md`, and the "before real data"
gate in `docs/portal-certification-report.md`). This is a scoping note for
the outside reviewer, not a substitute for their opinion.

## What to review

**1. Staff seats — RPC 5.3 (supervision of nonlawyer assistants)**

A verified attorney can add paralegals/associates as case collaborators
(`case_collaborators`) and grant firm colleagues access to a specific case
(`case_grants`, gated through `grantCaseAccess` in
`src/lib/firm-grants.functions.ts`). Questions for review:

- Does bar-verifying only the named attorney (not each staff member
  individually) satisfy RPC 5.3's supervision requirement, given every staff
  member's access is scoped to cases the supervising attorney already holds
  and dies the moment that attorney is suspended (`assertCaseAccess` in
  `src/lib/attorney-access.server.ts` checks both the acting user's and the
  owning attorney's verification status on every request)?
- Is the current cascade — suspending the attorney cuts off every staff
  member under them on their next request — sufficient supervision evidence,
  or does the firm need its own attestation that it supervises staff access?

**2. Exports — RPC 1.6 (confidentiality)**

Attorney-facing reads (case file view, ZIP export, Clio push) pull directly
from survivor-entered records. Questions for review:

- Is the current default-deny-then-opt-in model for incident location data
  (`redactIncidentLocation` in `src/lib/attorney-access.server.ts` — a
  location is only visible to an attorney once the survivor explicitly marks
  that specific incident) an adequate confidentiality control, or does an
  attorney need to independently attest to safeguarding it once received?
- Clio sync (`src/lib/clio.functions.ts`) moves data to a third-party
  system once an attorney is verified. Does RPC 1.6 require anything beyond
  the existing per-case consent flag (`clio_share_consent` on
  `attorney_client_links`) before that first sync — e.g., a stated retention
  or deletion obligation on the receiving end?
- The 180-day access-reconfirmation cutoff
  (`src/lib/attorney-access-cutoff.server.ts`) is meant to prevent stale,
  unsupervised access to a closed matter. Does the review agree 180 days
  (with reminders at 150/165/175 and a survivor notice at 173) is a
  reasonable interval, or does a shorter default better match confidentiality
  norms for an active vs. closed matter?

## What is out of scope for this review

- General legal-advice quality or case-strategy questions — this system does
  not give legal advice and never claims to.
- The DV-safety design choices (in-app-only survivor notices, no
  email/SMS on revoke or suspend, address redaction by default) — those are
  product decisions already made for survivor safety, not open questions for
  ethics review, though the reviewer should flag if any of them conflict
  with an attorney's own professional obligations.

## Deliverable

A short written opinion (email or memo is fine) that either clears the
current design or lists specific changes required before real survivor data
is allowed through the attorney portal. File it in this repo under `docs/`
once received.
