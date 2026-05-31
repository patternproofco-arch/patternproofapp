## Attorney Portal — Full Build Plan

This is a large two-sided build. Confirming scope before I touch files.

### What already exists
- `attorney_invitations`, `attorney_client_links`, `attorney_profiles`, `attorney_messages`, `attorney_document_requests`, `attorney_time_logs` tables (full invite + link model)
- `src/lib/attorney-invitations.functions.ts` — create / list / revoke / peek / accept
- `src/lib/attorney-portal.functions.ts` — attorney-side reads
- `src/routes/_authenticated/share-with-attorney.tsx` — basic survivor share UI
- `src/routes/_authenticated/attorney-portal.tsx` — older `attorney_access` UI (legacy)
- `src/routes/accept-invite.$token.tsx` — attorney accepts invite (signed in)
- `src/routes/_attorney/clients.tsx` + `clients.$clientId.tsx` — minimal attorney workspace
- `src/routes/_attorney.tsx` — attorney layout (basic)

I will build on the **invitation/link** system (not the legacy `attorney_access` table) since it has proper RLS, role gating, and email verification.

---

### PART 1 — Survivor share flow (redesigned)

Replace `src/routes/_authenticated/attorney-portal.tsx` with a redesigned share screen that matches the spec:
- Heading + supportive subtext
- Form fields: attorney email, name (opt), firm (opt)
- Three toggles (incidents / evidence / patterns) — on by default
- Optional date range
- Optional private note to attorney (stored on invitation row)
- "Generate Secure Access Link" → creates invitation, shows step 2
- Step 2: full URL `pattern-proof.tech/attorney/[token]`, copy + mailto buttons, expiry note
- Below: list of active links and pending invites with Revoke
- Green dot on the nav item when an active link exists (via FloatingNav)

DB additions needed (small migration):
- `attorney_invitations.firm_name text`
- `attorney_invitations.personal_note text`
- `attorney_invitations.date_range_start date`, `date_range_end date`

### PART 2 — Attorney portal design system

New file `src/styles/attorney.css` (imported only by `_attorney` routes) — completely isolated from survivor pastel system:
- Background `#F4F6F9`, navy `#1B2A4A`, slate, white cards
- Instrument Serif + IBM Plex Sans + IBM Plex Mono from Google Fonts
- Classes: `.att-card`, `.att-btn-primary`, `.att-btn-export`, `.att-btn-secondary`, `.att-tag-*`, `.att-nav`, `.att-nav-tab`, `.att-security-banner`
- No glassmorphism, no particles — the `_attorney` layout will NOT mount `AmbientBackground`

Rewrite `src/routes/_attorney.tsx`:
- Sticky navy top nav with 5 tabs (Overview / Timeline / Patterns / Evidence / Export)
- Security banner row (dismissible per session)
- Client name + Case ID on the right
- Footer with chain-of-custody line
- NO survivor chrome (no AppShell, no AmbientBackground, no FloatingNav)

### PART 3 — Attorney portal pages (under `/clients/$clientId/...`)

Restructure to mirror spec:
```
/clients                              — client picker (existing, restyled)
/clients/$clientId                    — Overview (Page 1) — REWRITE existing
/clients/$clientId/timeline           — Timeline (Page 2) — NEW
/clients/$clientId/patterns           — Pattern analysis (Page 3) — NEW
/clients/$clientId/evidence           — Evidence vault (Page 4) — NEW
/clients/$clientId/export             — Court-ready export (Page 5) — NEW
```

**Page 0 — Access Gate**: token-based gate already lives at `/attorney/$token` and `/accept-invite/$token`. Will restyle accept-invite to match the new attorney design (name, bar #, email, confidentiality checkbox, "Access Case File" navy CTA).

**Page 1 — Overview**: 4 hero stat cards (incidents, evidence, severity, time span) + AI case summary card (uses existing `pattern_analyses` if present, else placeholder) + last 5 incidents + right sidebar (case info, applicable law by state, quick actions).

**Page 2 — Timeline**: filter bar, incidents grouped by month, full descriptions, evidence list per incident with auth badges, attorney-private notes (new table), flag/reviewed toggles.

**Page 3 — Patterns**: frequency bar chart, behavior-type breakdown (donut), escalation line chart with auto-callout, Power & Control wheel grid (8 cells filled/empty by abuse_types match), legal framing callout. Will use `recharts` (already installed via shadcn chart).

**Page 4 — Evidence**: tabbed grid (All/Photos/Screenshots/Documents/Audio), 3-col cards with thumbnail/icon, side panel on click with metadata and download.

**Page 5 — Export**: checklist of sections, format radio (PDF/Word/Print), date range, optional attorney certification block, large green "Generate Report" button. Initial implementation = window.print() against a styled print view; PDF generation TBD.

### PART 4 — New DB (one migration)

```sql
-- richer invitation fields (Part 1)
ALTER TABLE attorney_invitations
  ADD COLUMN firm_name text,
  ADD COLUMN personal_note text,
  ADD COLUMN date_range_start date,
  ADD COLUMN date_range_end date;

-- attorney-only private notes per incident
CREATE TABLE attorney_incident_notes (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null,
  attorney_user_id uuid not null,
  client_user_id uuid not null,
  incident_id uuid not null,
  note text,
  flagged boolean not null default false,
  reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (link_id, incident_id)
);
-- grants + RLS: only the attorney on the link can read/write; survivor cannot see
```

### PART 5 — Server functions (new)

Add to `src/lib/attorney-portal.functions.ts`:
- `getCaseOverview({ clientId })` — stats, summary, last 5 incidents, applicable law
- `getCaseTimeline({ clientId, filters })` — incidents + linked evidence grouped by month
- `getCasePatterns({ clientId })` — aggregations for charts
- `getCaseEvidence({ clientId, type })` — evidence grid data
- `upsertAttorneyNote({ incidentId, note, flagged, reviewed })`
- `logAttorneyAccess({ clientId, page })` — writes to `attorney_time_logs`

All gated by `requireSupabaseAuth` + `has_attorney_access(auth.uid(), client_user_id)`.

---

### Scope confirmation

This is roughly 12–15 new files and one DB migration. I'll skip the legacy `attorney_access` table entirely (won't delete it — just stop using it).

**Open questions before I start:**
1. **AI case summary** — generate live with Lovable AI on each load, or store in `pattern_analyses` and reuse? (Live is simpler; pattern_analyses caching is better long-term.)
2. **Court-ready PDF export** — for v1, is a styled "Print view" (browser → Save as PDF) acceptable, or do you want server-side PDF generation now?
3. **"Email directly to attorney" button** — `mailto:` link (works everywhere, no infra), or proper transactional email via a connector?

Reply with any answers and I'll build the whole thing in one pass.
