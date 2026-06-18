# Next Build — MVP Finish + Landing Page Rebuild

This is a big batch. To ship it cleanly and not break things, I'll do it in two phases. Approve and I'll execute in order.

---

## Phase A — Finish the MVP launch plan (remaining items)

### A1. Nav cleanup (survivor)
Trim `AppShell` sidebar to 7 items: Dashboard, Journal, Timeline, Evidence, Patterns, Court Packet, Resources. Move Calendar, OPRA, Escalation detector, Live recording, Communications, Abuser tactics, Court systems, Why courts struggle, Legal documents, Attorney portal, Case builder, Share with attorney out of the primary nav (routes stay; just unlinked).

### A2. Merge education pages → `/resources`
Replace `_authenticated/resources.tsx` with a tabbed page that surfaces existing content from `court-systems`, `why-courts-struggle`, `abuser-tactics`. Leave the original routes redirecting to `/resources?tab=...`.

### A3. Iridescent re-skin (survivor authed area)
Replace remaining terracotta `#E77B56` / tan `#DEB896` usages in `_authenticated/*` with the teal→purple iridescent tokens already in `styles.css`. White card surfaces, soft pastel header strip on Dashboard.

### A4. Court Packet PDF polish
Add cover page (client name, case type, date range, jurisdiction, disclaimer), 1-page pattern summary, evidence index with numbered references, witness list, voice-note transcript section. Neutral first-person language pass.

### A5. Consolidate attorney invite flow
Pick `/accept-invite/$token` as canonical. Make `/attorney/$token` redirect to it. Single token table, single accept handler.

### A6. Upgrade prompts
Inline upsell on Court Packet export for free users; one dismissible banner on Patterns page after 5+ incidents.

### A7. Court-ready thanks → toast
Remove `/court-ready-thanks` route; replace with toast + redirect to `/court-packet`.

### A8. Onboarding gate
Gate `/onboarding` on `profiles.onboarded_at`; returning users go straight to `/dashboard`.

---

## Phase B — Landing page rebuild (`/`, `/for-attorneys`, new `/for-organizations`)

### B1. Convert `/` from redirect → real landing
Authed users still auto-redirect to `/dashboard`. Unauthed users see the new multi-audience landing.

### B2. Hero
- Headline: "The proof is in the patterns."
- Sub: "P4TTERN PR00F turns scattered incidents, evidence, and timelines into organized patterns survivors can document, attorneys can review, and advocates can understand faster."
- Visual: iridescent particle field that organizes into the P4TTERN PR00F mark (CSS/SVG canvas animation — no new deps).
- CTAs: "Start documenting" / "For attorneys" / "For DV organizations".

### B3. Survivor section
- "Scattered moments become a pattern." Interactive slider component (`<PatternRevealSlider />`) — left: scattered particles + screenshot/text/voice glyphs; right: organized timeline that forms the words "FIND THE PATTERNS". CTA: "Start with one incident".

### B4. Attorney section (navy)
- Headline + pain bullets exactly as specified.
- **Attorney Savings Calculator** (`<AttorneyROICalculator />`):
  - Sliders: clients/mo, manual hours/client, hourly value, monthly revenue/client.
  - Outputs: monthly hours lost, hours recovered (assume 70% reduction), value recovered, additional case capacity, monthly ROI net of $297.
- CTAs: "Calculate time saved" (scroll-to) / "Start attorney beta".
- Pricing psychology block: "If P4TTERN PR00F saves your team even 2 billable hours a month, it can pay for itself." Before/after comparison.

### B5. DV org section (light blue/gray)
- Headline + pain bullets as specified.
- **Capacity Calculator** (`<OrgCapacityCalculator />`):
  - Sliders: survivors/mo, intake hours/survivor, advocate hourly cost, time saved %.
  - Outputs: hours saved, value recovered, additional survivor capacity, handoff readiness score.
- Invite-only block: "DV organization access is currently invite-only." CTA: "Request org access" → mailto or simple form route (`/request-org-access`, stub).

### B6. Positioning copy
Sprinkle the specified phrases in dividers between sections. Strip the weak phrases anywhere they currently appear.

### B7. Final CTA band
"Stop searching through the chaos. Start seeing the pattern." with three buttons.

### B8. SEO + metadata
New title, description, OG image hint, canonical, JSON-LD `Product` schema with three offerings (Survivor Free, Attorney Solo, DV Org Invite).

---

## Technical notes

- New files: `src/components/landing/Hero.tsx`, `SurvivorSection.tsx`, `PatternRevealSlider.tsx`, `AttorneySection.tsx`, `AttorneyROICalculator.tsx`, `OrgSection.tsx`, `OrgCapacityCalculator.tsx`, `FinalCTA.tsx`. Each under 150 lines per project conventions.
- New route: `src/routes/for-organizations.tsx`, `src/routes/request-org-access.tsx`.
- Reuse existing `Logo` component with the correct `variant` per section.
- Use existing shadcn `Slider`, `Card`, `Button`. No new deps.
- Particle animation: lightweight canvas in `PatternRevealSlider` and Hero; respects `prefers-reduced-motion`.
- All numbers/formulas live in pure functions exported from each calculator for easy tuning.

---

## Out of scope (still)
- DV org portal app surface (only the public-facing "request access" page).
- Live Stripe go-live.
- Real testimonials (placeholders).
- Hearing prep beyond the existing stub.

Approve and I'll execute Phase A then Phase B in order.