# Org / advocate portal — proposed follow-up plan

Not built yet. This document captures the proposed data model and portal
shape so the next pass can implement it without re-deriving the design.

## Purpose

DV organizations and independent advocates (case managers, social workers,
shelter staff, legal advocates who are not attorneys) already refer
survivors to PatternProof through the referral-link system. Today they have
no way to *help* those survivors inside the product — everything is either
survivor-only or attorney-only. The org/advocate portal fills that gap
without giving advocates attorney-level case tooling (no Deposition Prep,
no billable-time tracking, no professional-review packet generation).

## Personas

- **DV organization staff** (e.g. shelter case manager) — a small number
  of workers under one org, each helping many survivors.
- **Independent advocate** — one worker helping many survivors, not tied
  to a formal org.
- **Survivor** — grants scoped, revocable access, exactly like the
  existing attorney invite flow.

## Data model (proposed)

Reuse existing patterns where possible:

- `advocate_orgs` — one row per DV org (`id`, `name`, `slug`, `created_by`,
  `referral_link_id?`, timestamps). Independent advocates get an implicit
  personal org auto-created on signup.
- `advocate_profiles` — mirror of `attorney_profiles` (`user_id`, `full_name`,
  `org_id`, `role: 'staff' | 'lead' | 'independent'`, onboarded flag,
  confidentiality_accepted_at).
- `advocate_client_links` — mirror of `attorney_client_links` with the same
  scoping fields (`scope_incidents`, `scope_evidence`, `include_all_*`,
  `case_id`, `status`, `revoked_at`). Same case-scoping rules apply.
- `advocate_invitations` — mirror of `attorney_invitations`.
- `advocate_notes` — advocate-authored case notes (not shared with the
  survivor by default), separate from `attorney_incident_notes`.
- Reuse `attorney_document_requests` renamed conceptually as
  "documentation follow-ups" — no schema change, just a `requester_kind`
  column (`attorney` | `advocate`) added to disambiguate.

RLS scoping mirrors attorney-portal rules exactly (survivor-owner OR
advocate-with-active-link, case-scoped intersection).

## Portal shape (routes)

- `/_advocate/` — pathless layout, same guard pattern as `/_attorney/`.
- `/_advocate/clients` — caseload overview (name, last activity, open
  follow-ups, most recent incident date).
- `/_advocate/clients/$clientId` — client detail with a **reduced** tab set:
  - **Overview** — descriptive snapshot only, no legal framing.
  - **Timeline** — read-only, no exhibit labeling.
  - **Follow-ups** — request documentation, mark items resolved.
  - **Safety** — quick-access safety plan template, referral resources,
    "does the survivor have a lawyer yet?" prompt.
- `/_advocate/settings` — profile, org settings (if lead), invite other
  staff to the same org.
- `/_advocate/feedback` — same audience-scoped feedback form pattern.

**Not included** (intentional): Deposition Prep, professional-review
packet export, cross-reference/inconsistencies tab, billable time, court
packet PDF. Those are attorney-only tools.

## Survivor-side changes

- Extend the existing "Share access" flow to offer a third role at
  invitation time: attorney, legal advocate, DV org staff. The role
  determines which portal the invitee lands in and which tabs render.
- Consent copy is different for advocates: they are **not** bound by
  attorney-client privilege — that must be stated up front on both the
  invite and the acceptance screens.

## Cross-portal coordination

When a survivor has both an attorney and an advocate linked to the same
case:
- Both see the same case timeline and evidence (per scoping).
- Follow-up requests are tagged with the requester so neither steps on
  the other.
- Attorney can optionally message the advocate through a scoped
  `attorney_messages`-equivalent channel (`case_collaborators` already
  supports this pattern — reuse rather than duplicate).

## Referral-link tie-in

If a survivor was referred via an org's referral code, the referring org
is offered a one-click invite ("The org that referred you can help you
organize your case — invite them?") on the survivor's dashboard. Never
auto-link.

## Rollout notes

- Ship the schema and RLS in one migration.
- Portal UI is a straight lift of the attorney portal chrome with the
  reduced tab set — do not re-invent the layout.
- Feature-flag the third invite role until at least one partner org has
  agreed to pilot.