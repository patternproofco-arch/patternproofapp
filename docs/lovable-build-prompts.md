# PatternProof — Lovable Build Prompts

# Paste each prompt into Lovable one at a time, in order.

# Each prompt references the design system doc (patternproof_design_system.md) — keep both open.

---

## PROMPT 1: Foundation + Safety Infrastructure

Build the foundational shell of a mobile-first React app called PatternProof. This is a trauma-informed documentation app for domestic violence survivors. The app must feel calm, safe, and premium.

TECH STACK: React + Tailwind CSS + Supabase (auth + database). Mobile-first, single column layout, max-width 480px centered on desktop.

FONTS: Import Nunito (weights 300,400,500,600,700,800) from Google Fonts. Set Nunito as the default font family globally.

COLOR SYSTEM (set as CSS variables in :root):

- Background: #F0F2F5 (pale cool gray)
- Surface (cards): #F0F2F5 (same as bg — neumorphism)
- Accent purple: #D4C5F0
- Accent cyan: #C5E8F0
- Accent lavender-blue: #C8D9F0
- Accent purple-cyan: #D0DBF0
- Link color: #B8A9D9
- Text primary: #5A5A6A
- Text secondary: #6A6A7A
- Text tertiary: #7A7A8A
- Text muted: #A8A8B8
- NO pure black (#000000) anywhere

NEUMORPHIC SHADOWS (set as Tailwind extensions or CSS classes):

- Raised: box-shadow: 8px 8px 16px #D1D9E6, -8px -8px 16px #FFFFFF
- Inset: box-shadow: inset 8px 8px 16px #D1D9E6, inset -8px -8px 16px #FFFFFF
- Small: box-shadow: 4px 4px 8px #D1D9E6, -4px -4px 8px #FFFFFF
- NO borders on cards. NO single drop shadows. Always paired light + dark.

BORDER RADIUS: Cards 20px, small elements 16px, pill nav 24px, buttons 12px, circles 50%.

BUILD THESE SCREENS:

1. PIN LOCK SCREEN

- Full screen, neumorphic background
- Centered: small lock icon in neumorphic circle (60px)
- "PatternProof" text below (18px, Nunito 600, #6A6A7A) — only visible when NOT in disguise mode
- 4-dot PIN input (neumorphic dots, fill with #D4C5F0 as entered)
- Number pad: 3x4 grid of neumorphic circular buttons (60px each), Nunito 600, #5A5A6A
- "Use Face ID" button below (text link, #B8A9D9)
- When in DISGUISE MODE: title shows "Daily Planner" instead of "PatternProof", lock icon becomes a calendar icon, accent colors shift to neutral gray (#C0C0C8)

2. EXIT SAFELY BUTTON

- Fixed position, top-left corner, ALWAYS visible on every screen
- Neumorphic circle (40px) with a discrete door/exit icon (20px, #7A7A8A)
- On click: INSTANTLY redirect to https://weather.com (window.location.replace, no transition, no animation)
- Must work even if page is mid-load (put in App root, outside any route)
- Add a keydown listener: pressing Escape twice rapidly also triggers exit
- NO confirmation dialog. NO delay. This is a safety feature.

3. APP DISGUISE TOGGLE

- In settings screen, a toggle "App Disguise Mode"
- When ON:
  - Document title becomes "Daily Planner"
  - App header shows "Daily Planner" with calendar icon instead of "PatternProof"
  - All branding text swaps to "Daily Planner"
  - Favicon swaps to a calendar emoji
  - The disguise must be convincing — zero DV-related language visible
- Store preference in localStorage

4. BOTTOM NAVIGATION (5 tabs)

- Floating neumorphic pill bar, 24px radius, 16px margin from edges
- 5 icons evenly spaced: Home, Archive, Recurline, Case, Resources
- Active tab: inset neumorphic shadow + 4px accent dot below (#D4C5F0)
- Inactive: line icons in #A8A8B8
- Icons: 24px, simple line style (lucide-react or similar)
- Nav background: same #F0F2F5 (neumorphic)

5. APP SHELL + ROUTING

- React Router with 5 routes: /home, /archive, /recurline, /case, /resources
- App.tsx wraps everything: PIN gate → App shell (with Exit Safely + Bottom Nav) → Routes
- Exit Safely button renders at App level, above all routes
- Use a layout component that includes the nav bar

DO NOT build the content screens yet — just the shell, safety features, and navigation. Make sure the neumorphic style is consistent everywhere. No borders, no drop shadows, always paired light/dark neumorphic shadows.

---

## PROMPT 2: Survivor Home Screen

Build the Survivor Home screen for PatternProof. Mobile-first, Nunito font, neumorphic design system.

LAYOUT (top to bottom):

1. HEADER

- Left: "Hello," in Nunito 400, #7A7A8A, 20px. Below it: "Gracie" in Nunito 700, #5A5A6A, 24px. (Pull name from Supabase auth user, fallback to "there")
- Right: notification bell icon inside a neumorphic circle (36px), pastel purple (#D4C5F0) background, white bell icon (18px). Small red dot (8px) top-right of circle if unread notifications exist.

2. 2x2 CARD GRID

- Two columns, 16px gap, full width minus 16px padding each side
- Each card: neumorphic raised (8px 8px 16px #D1D9E6, -8px -8px 16px #FFFFFF), 20px radius, min-height 120px, 16px internal padding
- Each card has a pastel circle icon (48px) centered horizontally, with a label (14px, Nunito 600, #7A7A8A) below it (8px gap)
- Card 1: "Archive" — purple circle (#D4C5F0), folder/box icon (24px white)
- Card 2: "Timeline" — cyan circle (#C5E8F0), clock/timeline icon (24px white)
- Card 3: "Case" — lavender-blue circle (#C8D9F0), briefcase icon (24px white)
- Card 4: "Resources" — purple-cyan circle (#D0DBF0), life-buoy icon (24px white)
- On tap: navigate to respective route
- On press: switch to inset neumorphic shadow (active state)

3. CONNECTING THREAD

- A thin (2px) curved gradient line connecting the 2x2 grid cards down to the list items below
- Gradient: #D4C5F0 (top) → #C5E8F0 (bottom)
- Opacity: 0.6
- Position: absolute, z-index 0 (behind cards, cards are z-index 1)
- Should curve gently, not rigid straight lines. Use SVG path or a div with border-radius curves.

4. "RECENT" SECTION

- Header row: "Recent" in Nunito 700, #6A6A7A, 18px on the left. "view all" in Nunito 400, #B8A9D9, 13px on the right (clickable, navigates to /archive)
- Thread continues connecting down to this section

5. RECENT ITEMS LIST

- Two list item cards, full width minus 16px margins, 12px gap between them
- Each card: neumorphic raised, 20px radius, 16px padding, flex row layout
- Left: neumorphic small circle (40px) with icon (20px white)
- Right of icon: title (15px, Nunito 600, #6A6A7A) and subtitle (12px, Nunito 300, #A8A8B8)
- Item 1: purple circle (#D4C5F0), document icon, "Custody exchange log" / "2 hours ago"
- Item 2: cyan circle (#C5E8F0), image icon, "Text screenshot uploaded" / "Yesterday"
- On tap: navigate to the item detail

6. SPACING

- 32px top padding (below status bar)
- 16px horizontal padding (screen edges)
- 24px between header and card grid
- 24px between card grid and Recent section
- 12px between list items

DATA: Connect to Supabase. The recent items should pull from an "entries" table (id, title, type, created_at). The type maps to icon color: "log" = purple, "evidence" = cyan, "note" = lavender. Sort by created_at desc, limit 5. If no entries, show an empty state: "No entries yet" in Nunito 400, #A8A8B8, centered.

IMPORTANT: NO pure black text. NO borders. NO drop shadows. Always neumorphic paired shadows. Nunito font everywhere.

---

## PROMPT 3: Archive Screen (was Journal)

Build the Archive screen for PatternProof. This is where survivors view all their documented entries (called "Marks"). Mobile-first, Nunito font, neumorphic design.

LAYOUT:

1. HEADER

- "Archive" in Nunito 700, #5A5A6A, 24px, left-aligned
- Right: filter icon in neumorphic small circle (36px), #D4C5F0 background

2. FILTER CHIPS

- Horizontal scrollable row of pill-shaped chips
- Chips: "All" (active — inset shadow, #D4C5F0 background), "Logs", "Evidence", "Notes", "Voice"
- Inactive chips: neumorphic raised, #F0F2F5 surface, text in #7A7A8A
- Active chip: inset shadow, white text
- Chip radius: 12px, 8px padding vertical, 16px horizontal

3. ENTRY LIST

- Vertical list of neumorphic cards, full width minus 16px margins, 12px gap
- Each card: neumorphic raised, 20px radius, 16px padding
- Card layout (flex row):
  - Left: neumorphic circle (40px) with type-colored icon
  - Center: title (15px, Nunito 600, #6A6A7A), subtitle showing date + type (12px, Nunito 300, #A8A8B8)
  - Right: chevron icon (#A8A8B8)
- Type colors: "log" = #D4C5F0 (purple), "evidence" = #C5E8F0 (cyan), "note" = #C8D9F0 (lavender), "voice" = #D0DBF0 (purple-cyan)
- On tap: navigate to entry detail view

4. CONNECTING THREAD

- Thread runs vertically along the left side connecting all list items
- Gradient: #D4C5F0 → #C5E8F0, 2px, opacity 0.6, z-index 0

5. FLOATING ADD BUTTON

- Neumorphic circle (56px), #D4C5F0 background, white "+" icon (28px)
- Fixed bottom-right, 16px from bottom (above nav bar), z-index 10
- On tap: open new entry modal

6. EMPTY STATE

- If no entries: centered illustration (neumorphic circle with document icon), "No Marks yet" in Nunito 600, #7A7A8A, "Tap + to document your first entry" in Nunito 300, #A8A8B8

DATA: Supabase "entries" table. Fields: id, user_id, title, type (log/evidence/note/voice), created_at, updated_at. Enable Row Level Security — users see only their own entries. Order by created_at desc. Filter by type if chip selected.

---

## PROMPT 4: Recurline Screen (Pattern Visualization)

Build the Recurline screen for PatternProof. This shows neutral frequency data — NO labels, NO pattern names, NO interpretation. Just counts and neutral visual patterns. The human draws conclusions.

SAFETY RULE: This screen must NEVER label, name, or diagnose "patterns of abuse." It shows frequency counts and neutral visual patterns only. Category names are neutral: "Messages", "Calls", "In-Person", "Other". No interpretive text. No "escalation" language. No risk indicators.

LAYOUT:

1. HEADER

- Back arrow (left), "Recurline" centered (Nunito 700, #5A5A6A, 20px)

2. PROGRESS SECTION

- "Progress" header (Nunito 700, #6A6A7A, 18px)
- Concentric ring chart:
  - 3 overlapping partial rings, centered
  - Ring thickness: 12px, gap between rings: 4px
  - Outer ring: #D4C5F0 (pastel purple)
  - Middle ring: #C5E8F0 (pastel cyan)
  - Inner ring: #C8D9F0 (lavender-blue)
  - Each ring is partially filled (arc length = percentage of total for that category)
  - Background track: same color as ring at 15% opacity (full circle)
  - Use SVG circle elements with strokeDasharray for partial fill
  - Chart container: 200px x 200px, centered

3. LEGEND (below chart)

- 4 items in a 2x2 grid or vertical list
- Each item: colored dot (8px circle) + label + percentage
- "MESSAGES 42%" — purple dot (#D4C5F0), label in Nunito 400 uppercase 11px 0.5px letter-spacing #7A7A8A, value in Nunito 600 13px #5A5A6A
- "CALLS 28%" — cyan dot (#C5E8F0)
- "IN-PERSON 18%" — lavender dot (#C8D9F0)
- "OTHER 12%" — blue dot (#D0DBF0)
- Labels are NEUTRAL category names only. No interpretation.

4. TIME MANAGEMENT SECTION

- "Time management" header (Nunito 700, #6A6A7A, 18px)
- Tab pills: "Day" "Week" (active, underlined #D4C5F0) "Month" "Year"
  - 13px Nunito 400, inactive #A8A8B8, active #5A5A6A with 2px underline
  - 16px gap between tabs

5. LINE GRAPH

- Smooth curved line in #D4C5F0 (pastel purple)
- X-axis labels: Sun, Mon, Tue, Wed, Thu, Fri, Sat (12px Nunito 300 #A8A8B8)
- No visible y-axis or grid lines (or very faint horizontal line at 10% opacity)
- One data point highlighted with a small floating white card:
  - Neumorphic tooltip, 12px radius, 6px 6px 14px #D1D9E6, -6px -6px 14px #FFFFFF
  - Shows count: "12 contacts" (13px Nunito 600 #5A5A6A)
  - Positioned above the highlighted point with a small triangle pointer

6. CONNECTING THREAD

- Thread runs from the ring chart down through the legend to the line graph
- Gradient: #D4C5F0 → #C5E8F0, 2px, opacity 0.6

DATA: Supabase "entries" table. Count entries grouped by type for the ring chart. Count entries grouped by day-of-week for the line graph. All counts are raw frequency — NO computed risk levels, NO labels, NO interpretation. The user sees numbers and draws their own conclusions.

CRITICAL: No text anywhere on this screen that labels, interprets, or names patterns. No "escalation", "risk", "warning", "concern" language. Just neutral counts in a neutral visual format.

---

## PROMPT 5: Case Builder Screen

Build the Case Builder screen for PatternProof. This helps survivors compile their evidence into a court-ready packet. This feature is FREE and UNGATED for all survivors — never behind a paywall.

LAYOUT:

1. HEADER

- "Case" in Nunito 700, #5A5A6A, 24px
- Right: export icon in neumorphic circle (36px), #C8D9F0 background

2. CASE SUMMARY CARD

- Neumorphic raised card, 20px radius, 16px padding
- Case title (editable): "Custody Case — Burns" (18px Nunito 700 #5A5A6A)
- Court date (if set): "Next hearing: Sep 15, 2026" (13px Nunito 300 #A8A8B8)
- Progress bar: neumorphic inset track (6px height, full width, #F0F2F5 inset) with pastel purple fill (#D4C5F0) showing completion percentage

3. EVIDENCE SECTIONS (vertically stacked, connected by thread)

- Thread: #C8D9F0 → #D4C5F0 gradient, 2px, opacity 0.6, connecting all sections
- Each section: neumorphic card with:
  - Section title (15px Nunito 600 #6A6A7A) + count badge (neumorphic small circle, 24px, accent color, white number)
  - List of selected items (3 max visible, "show all" link in #B8A9D9 if more)
- Sections:
  a. "Timeline Events" — purple accent (#D4C5F0) — items pulled from entries tagged "timeline"
  b. "Evidence Files" — cyan accent (#C5E8F0) — uploaded documents/screenshots
  c. "Communication Log" — lavender accent (#C8D9F0) — call/text records
  d. "Voice Notes" — purple-cyan accent (#D0DBF0) — transcribed audio

4. COURT PACKET EXPORT

- Neumorphic button (full width, 12px radius, 16px padding)
- "Generate Court Packet (PDF)" in Nunito 600, white text
- Button background: #D4C5F0
- On tap: compiles selected items into a PDF with cover page, table of contents, timeline, evidence index
- Loading state: button shows inset shadow + "Generating..." text

5. SHARE WITH ATTORNEY

- Below export button, a text link: "Share with attorney" (#B8A9D9, 13px Nunito 400)
- On tap: modal to enter attorney email, sends a secure link

DATA: Supabase "cases" table (id, user_id, title, court_date, created_at) and "case_items" table (id, case_id, entry_id, section). RLS enabled. PDF generation can use a library like jsPDF or react-pdf.

SAFETY: This feature must be accessible to ALL users regardless of subscription tier. No paywall, no gating, no "upgrade to access" prompt.

---

## PROMPT 6: Resources Screen

Build the Resources screen for PatternProof. Mobile-first, Nunito, neumorphic design.

LAYOUT:

1. HEADER

- "Resources" in Nunito 700, #5A5A6A, 24px

2. RESOURCE CARDS (vertical list, connected by thread)

- Thread: #D0DBF0 → #C5E8F0, 2px, opacity 0.6
- Each card: neumorphic raised, 20px radius, 16px padding, 12px gap
- Card layout: icon circle (40px, accent color) on left, title + subtitle on right
- Resources:
  a. "NJ Court Systems Guide" — purple (#D4C5F0), courthouse icon, "How NJ family court works" subtitle
  b. "OPRA Helper" — cyan (#C5E8F0), document icon, "Request public records in NJ"
  c. "Legal Documents" — lavender (#C8D9F0), file icon, "Templates and guides"
  d. "Safety Planning" — purple-cyan (#D0DBF0), shield icon, "Create a safety plan"
  e. "DV Organizations" — purple (#D4C5F0), heart icon, "Find local support"
  f. "Emergency Resources" — cyan (#C5E8F0), phone icon, "24/7 hotlines"

3. EMERGENCY BANNER (top of screen, above cards)

- Neumorphic card, slightly different — inset shadow, #F0F2F5 surface
- "If you're in immediate danger, call 911" in Nunito 600, #5A5A6A, centered
- Below: "National DV Hotline: 1-800-799-7233" in Nunito 400, #B8A9D9
- Phone numbers are clickable (tel: links)

IMPORTANT: This screen must NOT contain any text telling a survivor to leave their abuser. Resources are informational only. Safety planning is about preparation, not directive action.

---

## PROMPT 7: Attorney Portal

Build the Attorney Portal for PatternProof. This is a separate interface for attorneys to manage cases and generate court packets. Premium, authoritative feel.

SWITCH FONT: Use Manrope (import from Google Fonts, weights 300,400,500,600,700,800). Set Manrope as font for the attorney portal.

COLOR SYSTEM (attorney portal — blue tint throughout):

- Background: #EDF0F5 (pale blue-gray)
- Surface: #EDF0F5 (same as bg)
- Shadow dark: #C5D1E0 (blue-tinted)
- Shadow light: #FFFFFF
- Accent blue 1: #A8C4E0 (Cases)
- Accent blue 2: #B8B8E0 (Clients — periwinkle)
- Accent blue 3: #9BB8D0 (Court Packets — steel blue)
- Accent blue 4: #8BAFD0 (Evidence — deeper blue)
- Link: #7B9FCC
- Text primary: #3A3A4A (slightly stronger than survivor)
- Text secondary: #5A5A6A
- Text tertiary: #6A6A7A
- Text muted: #A8A8B8

NEUMORPHIC SHADOWS (blue-tinted):

- Raised: 8px 8px 16px #C5D1E0, -8px -8px 16px #FFFFFF
- Inset: inset 8px 8px 16px #C5D1E0, inset -8px -8px 16px #FFFFFF
- Small: 4px 4px 8px #C5D1E0, -4px -4px 8px #FFFFFF

LAYOUT — ATTORNEY HOME:

1. HEADER

- Left: "Attorney Portal" in Manrope 700, #3A3A4A, 24px. Below: firm name (Manrope 400, #6A6A7A, 13px) — pulled from user profile
- Right: settings gear in neumorphic circle (36px), #A8C4E0 background

2. 2x2 CARD GRID (blue-tinted, connected by thread)

- Thread: #A8C4E0 → #7B9FCC gradient, 2px, opacity 0.6
- Cards: neumorphic raised (blue-tinted shadows), 20px radius, 16px padding
- Card 1: "Cases" — blue circle (#A8C4E0), briefcase icon (24px white)
- Card 2: "Clients" — periwinkle circle (#B8B8E0), users icon (24px white)
- Card 3: "Court Packets" — steel blue circle (#9BB8D0), file-text icon (24px white)
- Card 4: "Evidence" — deeper blue circle (#8BAFD0), folder icon (24px white)

3. "ACTIVE MATTERS" SECTION

- Header: "Active Matters" (Manrope 700, #5A5A6A, 18px) + "view all" (#7B9FCC, 13px Manrope 400)
- Thread continues down

4. MATTER LIST

- Neumorphic cards (blue-tinted shadows), 20px radius, 16px padding, 12px gap
- Each: blue circle icon (40px) + title (15px Manrope 600, #5A5A6A) + subtitle (12px Manrope 300, #A8A8B8)
- Item 1: #A8C4E0, "Custody case — Burns" / "Updated 2 hours ago"
- Item 2: #B8B8E0, "Restraining order petition" / "3 items pending"

5. BOTTOM NAV (blue-tinted neumorphic pill, 4 icons: Home, Cases, Packets, Settings)

DATA: Supabase "cases" table with attorney_id field. RLS: attorneys see only cases assigned to them. The attorney portal is a SEPARATE route/layout from the survivor app (/attorney/* routes).

IMPORTANT: Manrope font, NOT Nunito. Blue tint on ALL shadows and surfaces. Text slightly stronger (#3A3A4A) than survivor side. No purple, no cyan, no sage. Everything blue.

---

## PROMPT 8: DV Organization Portal

Build the DV Organization Portal for PatternProof. This is for DV advocacy organizations to manage clients and resources. Calm, grounded, nurturing.

FONT: Nunito (same as survivor — warm and approachable, since DV orgs serve survivors).

COLOR SYSTEM (DV org — sage tint throughout):

- Background: #EDF0EC (pale sage-gray)
- Surface: #EDF0EC (same as bg)
- Shadow dark: #C5D1C0 (sage-tinted)
- Shadow light: #FFFFFF
- Accent sage 1: #A8C4A8 (Clients)
- Accent sage 2: #8BB8A0 (Resources — muted teal-green)
- Accent sage 3: #C4D4B8 (Reports — sage-cream)
- Accent sage 4: #9BB890 (Advocates — deeper sage)
- Link: #A8C4A8
- Text: same as survivor (#5A5A6A primary, #6A6A7A secondary, #7A7A8A tertiary, #A8A8B8 muted)

NEUMORPHIC SHADOWS (sage-tinted):

- Raised: 8px 8px 16px #C5D1C0, -8px -8px 16px #FFFFFF
- Inset: inset 8px 8px 16px #C5D1C0, inset -8px -8px 16px #FFFFFF
- Small: 4px 4px 8px #C5D1C0, -4px -4px 8px #FFFFFF

LAYOUT — DV ORG HOME:

1. HEADER

- Left: "DV Org Portal" or org name (Nunito 700, #5A5A6A, 24px). Below: "NJCEDV" (Nunito 400, #7A7A8A, 13px)
- Right: settings icon in neumorphic circle (36px), #A8C4A8 background

2. 2x2 CARD GRID (sage-tinted, connected by thread)

- Thread: #A8C4A8 → #8BB8A0 gradient, 2px, opacity 0.6
- Cards: neumorphic raised (sage-tinted shadows), 20px radius, 16px padding
- Card 1: "Clients" — sage circle (#A8C4A8), users icon (24px white)
- Card 2: "Resources" — teal-green circle (#8BB8A0), life-buoy icon (24px white)
- Card 3: "Reports" — sage-cream circle (#C4D4B8), bar-chart icon (24px white)
- Card 4: "Advocates" — deeper sage circle (#9BB890), heart icon (24px white)

3. "RECENT ACTIVITY" SECTION

- Header: "Recent Activity" (Nunito 700, #6A6A7A, 18px) + "view all" (#A8C4A8, 13px)

4. ACTIVITY LIST

- Neumorphic cards (sage-tinted), 20px radius, 16px padding, 12px gap
- Each: sage circle icon (40px) + title (15px Nunito 600, #6A6A7A) + subtitle (12px Nunito 300, #A8A8B8)
- Item 1: #A8C4A8, "New client intake — Sarah K." / "2 hours ago"
- Item 2: #8BB8A0, "Safety plan updated — Maria L." / "Yesterday"

5. BOTTOM NAV (sage-tinted neumorphic pill, 4 icons: Home, Clients, Reports, Settings)

DATA: Supabase "org_clients" table with org_id field. RLS: org users see only their org's clients. Separate route/layout (/dvorg/* routes).

IMPORTANT: Nunito font. Sage tint on ALL shadows and surfaces. No purple, no cyan, no blue, no orange. Everything sage-green. Calm, grounded, nurturing.
