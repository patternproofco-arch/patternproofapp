
# PatternProof Audit & Improvement Plan

This is a large scope. I've grouped it into 8 work packages aligned to your list, sequenced so safety-critical work ships first and visual polish lands last. I'll flag what already exists vs. what's new so we don't rebuild duplicate UI.

---

## What already exists (from the codebase)

- **Survivor**: PIN lock (`PinScreen`, `pin-lock.tsx`), onboarding route, dashboard, journal, timeline, evidence, voice notes, court packet, court-ready paywall, escalation detector, pattern analysis, attorney portal handoff, Quick Exit button, cognitive close, notification banner.
- **Attorney**: `_attorney` layout with subscribe, clients list, client detail, billing return.
- **Payments**: Court Ready ($10/mo + PWYC) and Attorney Solo/Firm/Enterprise products live; webhook + entitlement working.
- **No DV-org portal exists yet.**

So this is mostly **refinement + filling gaps**, not a rebuild.

---

## Work packages

### 1. Survivor safety onboarding (refine existing `/onboarding`)
Add a sequenced 6-step intro before the dashboard:
1. **Safe device check** — "Is this device only used by you? If not, here's how to use Quick Exit."
2. **Emergency disclaimer** — "If you are in danger right now, call 911 or the National DV Hotline 1-800-799-7233. PatternProof is not a crisis service."
3. **Quick Exit demo** — show the button, let them try it once.
4. **Notification safety** — "We never send push notifications. Email is opt-in and uses a neutral sender name."
5. **PIN setup** (already exists — wire into this flow as step 5).
6. **Scope disclaimer** — "PatternProof documents patterns. We are not a law firm and do not provide legal advice."
Persist completion in `profiles.onboarding_completed_at`.

### 2. Survivor dashboard (rebuild layout of `/dashboard`)
Card grid:
- **Log an incident** (primary CTA)
- **Recent timeline** (last 5 incidents, link to full timeline)
- **Pattern insights** (top 2 detected patterns, link to `/patterns`)
- **Upcoming court dates** (new — pulls from `incidents` where `category = legal_court` and date is future, plus a new `court_dates` table)
- **Export report** (opens court packet flow)
- **Safety checklist** (PIN set, Quick Exit known, emergency contacts saved, safe device confirmed)

### 3. Incident logging — guided categories
Refactor `src/lib/abuse-types.ts` and the journal form to use this taxonomy:
- Verbal abuse, Physical violence, Sexual violence, Financial control, Threats, Stalking, Harassment, Child-related, Legal/court violation, Property damage, Digital abuse
- Plus **evidence flags** (not categories): Witness present, Police report filed, Medical evidence available
Each category gets a short trauma-informed helper sentence and a color-coded left border (per your design rules — colored border, never colored card bg).

### 4. Pattern detection
Extend `pattern-analysis.functions.ts` to surface these named pattern cards on `/patterns` and the dashboard:
- Repeated custody-exchange conflict (clusters around child handoff times)
- Threats after boundaries are set (threat incidents within 72h of a "no contact"/"boundary" journal entry)
- Harassment spikes after legal action (harassment count rises after a `legal_court` incident)
- Financial control pattern (≥3 financial incidents in 30 days)
- Child-related manipulation pattern (≥3 child-related incidents in 60 days)
Each card: title, plain-language explanation, supporting incident count, "View incidents" link.

### 5. Court-ready exports
Expand `/court-packet` into a chooser with 6 export types:
- Timeline PDF (chronological, all incidents)
- Incident summary (one-pager per incident, last 90 days)
- Evidence packet (incidents + linked evidence files, zipped)
- Attorney brief (timeline + pattern insights + case summary)
- Custody pattern report (filters child-related + custody-exchange patterns)
- Protection order support summary (threats + physical + stalking + witnesses/police flags)
All gated behind existing Court Ready entitlement. Reuse `export-zip.functions.ts`.

### 6. Attorney portal polish
- New headline on `/for-attorneys` and `/subscribe`: **"See the pattern before the hearing."**
- `/clients` dashboard adds: pattern flags column, missing-evidence indicator per client.
- `/clients/$clientId` adds tabs: **Timeline · Patterns · Case Notes · Missing Evidence · Hearing Prep · Court Packet Export**.
- New tables: `attorney_case_notes` (exists as `attorney_incident_notes` — extend), `attorney_missing_evidence_checklist`.
- Hearing prep view = filtered timeline + top 3 patterns + flagged incidents, printable.

### 7. DV organization portal (new)
New `_org` route group mirroring `_attorney`:
- `app_role` enum extended with `'dv_org'`
- New tables: `org_profiles`, `org_client_links` (org ↔ survivor), `advocate_notes`, `safety_plans`, `referrals`, `risk_flags`
- Pages: `/org/intake` (new survivor intake form), `/org/clients` (caseload), `/org/clients/$id` (notes, risk, safety plan, referrals), `/org/handoff` (legal aid handoff PDF export)
- Payment: out of scope this round — orgs are invite-only, manual provisioning via `user_roles` insert.

### 8. Visual design — three brand modes
Token sets in `src/styles.css`, applied per route group:
- **Survivor** (`_authenticated/*`): iridescent pastel teal/purple gradient accents, soft white bg `#FAFBFF`, calm cards. Replaces current cream/terracotta on survivor side per your new direction.
- **Attorney** (`_attorney/*`): navy `#0F1B3D`, white cards, structured dashboard density, IBM Plex Serif headings (already loaded).
- **DV org** (`_org/*`): white bg, gray `#F4F6F8` panels, light blue `#3B6FA0` accents, supportive sans-serif (Inter).
Each mode = its own CSS class on the layout route's `<body>` wrapper; tokens swap via `@theme inline`.

> **Note on the existing palette**: your workspace-knowledge file says cream `#FFFDD0` / terracotta `#E77B56` for survivor, but item 8 of this request asks for iridescent pastel teal/purple on soft white. I'll follow this request and update the survivor palette accordingly. **Confirm if you want me to also update the workspace memory.**

---

## Technical notes

- Migrations needed: `court_dates`, `attorney_missing_evidence_checklist`, `org_profiles`, `org_client_links`, `advocate_notes`, `safety_plans`, `referrals`, `risk_flags`, `app_role` enum add `'dv_org'`, `profiles.onboarding_completed_at`. Each with GRANTs + RLS scoped by `auth.uid()` or `has_role`.
- All new server logic via `createServerFn` in `*.functions.ts`. Org and attorney protected routes go under their respective layout gates.
- Pattern detection runs as a server fn invoked from dashboard/patterns pages, cached via TanStack Query.
- No new payment products this round.
- Quick Exit, cognitive close, notification banner stay as-is — just surface them in onboarding.

---

## Suggested rollout order
1. Migrations + role/enum updates
2. Safety onboarding flow + dashboard rebuild
3. Incident taxonomy refactor + pattern detection expansion
4. Court-ready export chooser
5. Attorney portal polish (tabs + missing evidence)
6. DV org portal (largest new build)
7. Visual mode tokens + applied per layout

---

## Clarifying questions before I start

1. **Survivor palette**: confirm iridescent teal/purple on white (overriding cream/terracotta in your workspace memory)?
2. **DV org access**: invite-only with manual role grant by you for now, or self-signup with verification later?
3. **Court dates source**: new dedicated `court_dates` table, or keep them as a special incident category?
4. **Scope cut for this round**: if I have to defer one of the 8 packages to fit, which is lowest priority for you? (My guess: DV org portal, since it's a net-new build.)

Answer those and I'll proceed in build mode.
