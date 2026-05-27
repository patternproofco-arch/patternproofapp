## Dashboard polish & verify

The Dashboard at `src/routes/_authenticated/dashboard.tsx` already loads incident/evidence counts, a heat map, recent incidents, a "log now" panel, and a next-step card. I'll polish it with richer signal for active users and a real onboarding checklist for new users, then verify end-to-end.

### What changes

**1. Onboarding checklist (replaces empty stat row + next-step card for new users)**

Shown only when the user has nothing yet (`incidents === 0 && evidence === 0 && voice_notes === 0`). A warm, 4-step visual checklist with each step linking to its destination:

```text
[ ] Log your first incident                 → /journal
[ ] Upload a piece of evidence              → /evidence
[ ] Record a voice note                     → /voice-notes
[ ] Shape your case                         → /case-builder
```

Each step row shows a soft check circle (unchecked = ring, checked = filled sage), the warm copy, and a "Start" link. Steps already completed (e.g. they have one voice note but no incidents) render as checked. Below the list: *"Take it at your pace. Every step matters."*

**2. Richer stats for returning users (replaces current 3-up stat grid)**

Five compact stat tiles in a responsive grid (3 cols mobile, 5 cols lg):

- Incidents logged
- Evidence files
- Voice notes
- Months documented
- Last entry (relative: "2 days ago" / "—")

Each tile keeps the left-border accent in a different palette color and stays under the existing `.card-pp` shell.

**3. Quick actions row (new)**

Three pill buttons between hero copy and stats: **Log incident**, **Upload evidence**, **Record voice note**. Uses existing `btn-ghost` styling so it feels light, not a CTA wall. Hidden in the onboarding-checklist state (the checklist already covers it).

**4. Pattern preview card (new, conditional)**

When a `pattern_analyses` row exists for the user, surface a small card on the right rail beneath the "Something just happened" panel:

- Eyebrow: "Latest pattern analysis"
- 2-line clamp of `analysis.pattern_summary`
- "Open analysis →" link to `/patterns`

When no analysis exists but `incidents >= 2`, show a soft prompt instead: *"Ready to see what your records reveal?"* with a link to `/patterns`.

**5. Keep existing pieces**

Heat map (only when incidents exist), recent-incidents list, "Something just happened" CTA panel, encryption reassurance card, `WhyCourtsStruggleModal`, `FirstTimeEducationModal` — all unchanged.

### Implementation notes (technical)

- Extend the existing `useEffect` data fetch to also count `voice_notes` and pull the latest `pattern_analyses` row (`select analysis, created_at limit 1`) and latest incident date.
- All queries stay client-side via `supabase` with `.eq('user_id', user.id)` — matches the project's hooks-direct convention.
- Extract the onboarding checklist into a small in-file component (`OnboardingChecklist`) to keep the main `Dashboard` component well under the 150-line cap (current file is 158 lines, will need a light refactor anyway).
- Extract `StatCard` + the new `PatternPreview` into in-file helpers; if `dashboard.tsx` would exceed ~150 lines, move `OnboardingChecklist` to `src/components/OnboardingChecklist.tsx`.
- Use existing tokens only: `--primary`, `--accent`, `--safe`, `--gold`, `--muted-foreground`, plus type-color tokens. No new colors.
- Copy stays warm and grounded — no "No data found", no exclamation marks, no clinical phrasing.

### Verify

After the edit:
1. Reload `/dashboard` in the preview, dismiss the education + PIN modals.
2. Confirm empty state shows the new checklist (no incidents/evidence/voice notes yet).
3. Confirm the stat row, quick actions, heat map, pattern preview gracefully appear/hide based on data state.
4. Confirm no console errors and the page stays under the existing layout width.
