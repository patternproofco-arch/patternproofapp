# PatternProof Design System — Claude Code Implementation Spec

## Overview

PatternProof is a trauma-informed documentation and evidence management SaaS for domestic violence survivors. The design system serves three audiences, each with a distinct visual personality while sharing one design language.

**Three portals, one system:**
1. **Survivor** — warm, safe, approachable (Nunito, purple-cyan)
2. **Attorney** — premium, authoritative, precise (Manrope, blue tint)
3. **DV Organization** — grounded, nurturing, calm (Nunito, sage tint)

---

## 1. Typography

### Survivor & DV Org Portals
- **Font Family:** Nunito
- **Import:** `@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600;700;800&display=swap');`
- **Weights:**
  - 700 (Bold): Greetings, section headers
  - 600 (Semi-bold): Card labels, list item titles
  - 400 (Regular): Body text, nav labels, tabs
  - 300 (Light): Timestamps, subtitles, secondary data, percentages

### Attorney Portal
- **Font Family:** Manrope
- **Import:** `@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap');`
- **Weights:**
  - 700 (Bold): Firm name, section headers
  - 600 (Semi-bold): Card labels, list item titles
  - 400 (Regular): Body text, nav labels, tabs
  - 300 (Light): Timestamps, subtitles, secondary data

### Type Scale
| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| Greeting name | 24px | 700 | 32px |
| Section header | 18px | 700 | 24px |
| Card label | 14px | 600 | 20px |
| List item title | 15px | 600 | 22px |
| Body / nav label | 13px | 400 | 18px |
| Timestamp / subtitle | 12px | 300 | 16px |
| Legend label | 11px | 400 | 16px |
| Legend value | 13px | 600 | 16px |

### Text Colors — NO pure black anywhere
| Token | Hex | Usage |
|------|-----|-------|
| `text-primary` | #5A5A6A | Greetings, main headers (survivor/DV org) |
| `text-primary-attorney` | #3A3A4A | Greetings, main headers (attorney — slightly stronger) |
| `text-secondary` | #6A6A7A | Section headers |
| `text-tertiary` | #7A7A8A | Card labels, body |
| `text-muted` | #A8A8B8 | Timestamps, subtitles, percentages |
| `text-link` | portal-specific accent | "view all" links |

Letter spacing: neutral/standard. Sentence case throughout. No wide tracking, no all-caps except legend category labels (which use uppercase with 0.5px letter-spacing).

---

## 2. Color System

### Survivor Portal
| Token | Hex | Usage |
|------|-----|-------|
| `bg-survivor` | #F0F2F5 | App background (pale cool gray) |
| `surface-survivor` | #F0F2F5 | Card surface (same as bg — neumorphism) |
| `accent-purple` | #D4C5F0 | Primary accent (Archive, links, icons) |
| `accent-cyan` | #C5E8F0 | Secondary accent (Timeline) |
| `accent-lavender-blue` | #C8D9F0 | Tertiary accent (Case) |
| `accent-purple-cyan` | #D0DBF0 | Quaternary accent (Resources) |
| `link-survivor` | #B8A9D9 | "view all" links, active states |

### Attorney Portal — Blue Tint Throughout
| Token | Hex | Usage |
|------|-----|-------|
| `bg-attorney` | #EDF0F5 | App background (pale blue-gray) |
| `surface-attorney` | #EDF0F5 | Card surface (same as bg) |
| `accent-blue-1` | #A8C4E0 | Primary accent (Cases) |
| `accent-blue-2` | #B8B8E0 | Secondary accent (Clients — periwinkle) |
| `accent-blue-3` | #9BB8D0 | Tertiary accent (Court Packets — steel blue) |
| `accent-blue-4` | #8BAFD0 | Quaternary accent (Evidence — deeper blue) |
| `link-attorney` | #7B9FCC | "view all" links, active states |

### DV Org Portal — Sage Tint Throughout
| Token | Hex | Usage |
|------|-----|-------|
| `bg-dvorg` | #EDF0EC | App background (pale sage-gray) |
| `surface-dvorg` | #EDF0EC | Card surface (same as bg) |
| `accent-sage-1` | #A8C4A8 | Primary accent (Clients) |
| `accent-sage-2` | #8BB8A0 | Secondary accent (Resources — muted teal-green) |
| `accent-sage-3` | #C4D4B8 | Tertiary accent (Reports — sage-cream) |
| `accent-sage-4` | #9BB890 | Quaternary accent (Advocates — deeper sage) |
| `link-dvorg` | #A8C4A8 | "view all" links, active states |

### Marketing Only (NEVER in-app)
| Token | Hex | Usage |
|------|-----|-------|
| `cta-terracotta` | #E77B56 | Marketing pages, CTAs, social media ONLY |

---

## 3. Neumorphic Shadow System

The core visual language. Elements appear extruded from the same-color background using paired light/dark shadows. Subtle but visible — enough to read the raised edge, not a deep 3D extrusion.

### Survivor Portal Shadows
```css
/* Raised / elevated state (default for cards, list items, nav bar) */
box-shadow:
  8px 8px 16px #D1D9E6,   /* dark shadow, bottom-right */
  -8px -8px 16px #FFFFFF;  /* light highlight, top-left */

/* Inset / pressed state (active nav tab, pressed buttons) */
box-shadow:
  inset 8px 8px 16px #D1D9E6,   /* dark shadow, top-left (reversed) */
  inset -8px -8px 16px #FFFFFF;  /* light highlight, bottom-right (reversed) */

/* Small elements (icons, circles, chips) */
box-shadow:
  4px 4px 8px #D1D9E6,
  -4px -4px 8px #FFFFFF;

/* Floating tooltip / popup */
box-shadow:
  6px 6px 14px #D1D9E6,
  -6px -6px 14px #FFFFFF;
```

### Attorney Portal Shadows (Blue-Tinted)
```css
/* Raised state */
box-shadow:
  8px 8px 16px #C5D1E0,   /* blue-tinted dark shadow */
  -8px -8px 16px #FFFFFF;

/* Inset state */
box-shadow:
  inset 8px 8px 16px #C5D1E0,
  inset -8px -8px 16px #FFFFFF;

/* Small elements */
box-shadow:
  4px 4px 8px #C5D1E0,
  -4px -4px 8px #FFFFFF;
```

### DV Org Portal Shadows (Sage-Tinted)
```css
/* Raised state */
box-shadow:
  8px 8px 16px #C5D1C0,   /* sage-tinted dark shadow */
  -8px -8px 16px #FFFFFF;

/* Inset state */
box-shadow:
  inset 8px 8px 16px #C5D1C0,
  inset -8px -8px 16px #FFFFFF;

/* Small elements */
box-shadow:
  4px 4px 8px #C5D1C0,
  -4px -4px 8px #FFFFFF;
```

### Shadow Tokens
| Portal | Shadow Color (Dark) | Shadow Color (Light) |
|--------|---------------------|---------------------|
| Survivor | #D1D9E6 | #FFFFFF |
| Attorney | #C5D1E0 | #FFFFFF |
| DV Org | #C5D1C0 | #FFFFFF |

### Shadow Rules
- Blur radius: 16px for standard cards, 8px for small elements
- Offset: 8px for standard, 4px for small
- Card and background must share the same base color (neumorphism requires same-color surface + bg)
- Active/pressed states reverse the shadow direction (inset)
- Never use plain `box-shadow` with a single drop shadow — always paired light + dark

---

## 4. Border Radius

| Element | Radius |
|---------|--------|
| Cards (grid, list items) | 20px |
| Small cards / chips | 16px |
| Circular icons / avatars | 50% (fully round) |
| Bottom navigation bar | 24px (pill shape) |
| Buttons | 12px |
| Tooltips | 12px |
| Input fields | 12px |
| Tabs | 8px |

---

## 5. Connecting Thread Element

A signature visual element: a thin, curved gradient line that connects cards and boxes throughout the app, showing flow and relationship between sections. This is decorative but functional — it guides the user's eye through the journey of the screen.

### Implementation
```css
.thread-line {
  position: absolute;
  width: 2px;
  border-radius: 2px;
  /* Survivor: */
  background: linear-gradient(180deg, #D4C5F0 0%, #C5E8F0 100%);
  /* Attorney: */
  background: linear-gradient(180deg, #A8C4E0 0%, #7B9FCC 100%);
  /* DV Org: */
  background: linear-gradient(180deg, #A8C4A8 0%, #8BB8A0 100%);
  opacity: 0.6;
  z-index: 0; /* behind cards */
}
```

### Thread Behavior
- 2px width, soft and curved (use SVG path or border-radius curves, not rigid straight lines)
- Gradient flows vertically (top to bottom) using the portal's two accent colors
- Opacity: 0.6 (subtle, not bold)
- Runs behind cards (z-index: 0), cards sit above (z-index: 1)
- Connects: 2x2 grid cards → list items below → continues to next section
- Should feel like a gentle path, not a rigid connector
- On screens with charts/graphs, the thread can wrap around or flow into the chart area

### Thread per Portal
| Portal | Gradient Start | Gradient End |
|--------|---------------|---------------|
| Survivor | #D4C5F0 (pastel purple) | #C5E8F0 (pastel cyan) |
| Attorney | #A8C4E0 (soft blue) | #7B9FCC (deeper blue) |
| DV Org | #A8C4A8 (soft sage) | #8BB8A0 (muted teal-green) |

---

## 6. Layout & Spacing

### Screen Structure
```
┌─────────────────────────────┐
│ Status Bar (system)          │
├─────────────────────────────┤
│ Header (greeting + icon)     │
├─────────────────────────────┤
│                              │
│  2x2 Card Grid               │
│  ┌──────┐  ┌──────┐         │
│  │ Card │~~~│ Card │  (~ = thread)
│  └──────┘  └──────┘         │
│  ┌──────┐  ┌──────┐         │
│  │ Card │~~~│ Card │         │
│  └──────┘  └──────┘         │
│      |                       │
│      ~ (thread continues)    │
│      |                       │
├─────────────────────────────┤
│ Section Header + view all    │
├─────────────────────────────┤
│  ┌─────────────────────┐    │
│  │ List Item 1         │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ List Item 2         │    │
│  └─────────────────────┘    │
├─────────────────────────────┤
│   ┌─────────────────────┐   │
│   │  Bottom Nav (pill)  │   │
│   └─────────────────────┘   │
└─────────────────────────────┘
```

### Spacing Tokens
| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Tight gaps, icon padding |
| `sm` | 8px | Small element gaps |
| `md` | 12px | Card internal padding |
| `lg` | 16px | Section gaps, screen edge padding |
| `xl` | 24px | Between major sections |
| `2xl` | 32px | Top/bottom screen padding |

### Card Grid
- 2 columns, equal width
- Gap between cards: 16px
- Card internal padding: 16px
- Card min height: 120px
- Icon circle: 48px diameter, centered horizontally in card
- Label: 14px, 600 weight, below icon with 8px gap

### List Items
- Full width with 16px horizontal margin
- Internal padding: 16px
- Icon circle: 40px diameter, left-aligned
- Title: 15px, 600 weight
- Subtitle: 12px, 300 weight, #A8A8B8
- Gap between items: 12px

### Bottom Navigation
- Floating pill shape, 24px radius
- 16px margin from left/right/bottom
- Internal padding: 12px vertical, 16px horizontal
- 4 icons evenly spaced
- Active icon: inset neumorphic shadow + small accent dot below (4px diameter)
- Icon size: 24px
- Nav background: same as app bg (neumorphic)

---

## 7. Component Specs

### 7.1 Icon Tiles (in cards)
- Solid pastel-colored circle, 48px diameter
- Simple line icon centered (24px), white or slightly darker shade of the circle color
- No border on circle
- Circle sits on the neumorphic card surface (no additional shadow on circle itself for small elements, use 4px shadow)

### 7.2 Concentric Ring Chart (Recurline)
- 3 overlapping partial rings, each representing a category
- Ring thickness: 12px
- Ring gap: 4px between rings
- Ring colors (survivor): #D4C5F0 (outer), #C5E8F0 (middle), #C8D9F0 (inner)
- Ring colors (attorney): #A8C4E0, #B8B8E0, #9BB8D0
- Ring colors (DV org): #A8C4A8, #8BB8A0, #C4D4B8
- Each ring partially filled (percentage-based arc)
- Background track: same color as ring at 15% opacity
- Legend below: colored dot (8px) + uppercase label + percentage value
- Labels: 11px, 400 weight, uppercase, 0.5px letter-spacing
- CRITICAL: Legend shows neutral category names and counts/percentages ONLY. Never label, name, or interpret "patterns of abuse." The human draws conclusions.

### 7.3 Line Graph
- Smooth curve path in portal's primary accent color
- X-axis: days of week (Sun, Mon, Tue, Wed, Thu, Fri, Sat)
- Y-axis: implicit (no visible axis lines)
- One data point highlighted with a small floating white tooltip card
- Tooltip: 12px radius, neumorphic shadow, shows count value
- Tooltip text: 13px, 600 weight
- Graph background: transparent
- Grid lines: none, or very faint horizontal line at 15% opacity

### 7.4 Tabs (Day/Week/Month/Year)
- Pill-shaped, 8px radius
- Active tab: underline in portal accent color (2px, full width of text)
- Inactive tabs: text in #A8A8B8
- Tab text: 13px, 400 weight
- Gap between tabs: 16px

### 7.5 Notification Bell
- Circle: 36px diameter, pastel accent color
- Bell icon: 18px, centered, white
- Positioned top-right of header
- Optional: small red dot (8px) for unread, top-right of circle

---

## 8. Safety UI Components (Non-Negotiable)

### 8.1 Exit Safely Button
- Persistent, accessible from anywhere in the app
- NOT part of the bottom navigation
- Positioned: fixed, top-left or floating, always visible
- Style: neumorphic circle (40px) with discrete exit icon
- On tap: instantly redirects to a neutral site (weather, news, etc.)
- Must work even if page is mid-load
- This is core safety infrastructure — any change requires highest review

### 8.2 App Disguise ("Daily Planner")
- App icon and title display as "Daily Planner" on device home screen
- In-app header can optionally show "Daily Planner" in disguise mode
- Toggle in settings
- Disguise must be convincing — no DV-related language visible when active
- Core safety infrastructure

### 8.3 PIN & Biometric Lock
- PIN gate on app launch
- Biometric (Face ID / fingerprint) option
- Lock screen: neumorphic, minimal, no app branding when disguised

---

## 9. Responsive Behavior

- Mobile-first design (primary target)
- Min screen width: 320px
- Tablet: scale cards to maintain 2-column grid, increase max-width to 640px
- Desktop (attorney portal): max-width 1200px, cards can expand to 3-4 columns
- Thread element adapts: vertical on mobile, can flow horizontally on wider screens

---

## 10. Accessibility

- All text colors meet WCAG AA contrast against their respective backgrounds
- #A8A8B8 on #F0F2F5 = 2.8:1 (AA for large text only; use #8A8A9A for small text where needed)
- #5A5A6A on #F0F2F5 = 7.1:1 (AAA pass)
- Touch targets: minimum 44px
- Focus states: 2px outline in portal accent color
- Reduce motion: neumorphic shadows become flat borders (1px solid #D1D9E6)
- Screen reader: all interactive elements labeled, thread is aria-hidden

---

## 11. Implementation Notes for Claude Code

### CSS Variable Setup
```css
:root {
  /* Portal-agnostic tokens (override per portal) */
  --font-primary: 'Nunito', sans-serif;
  --font-attorney: 'Manrope', sans-serif;

  /* Default = Survivor portal */
  --bg: #F0F2F5;
  --surface: #F0F2F5;
  --shadow-dark: #D1D9E6;
  --shadow-light: #FFFFFF;
  --accent-1: #D4C5F0;
  --accent-2: #C5E8F0;
  --accent-3: #C8D9F0;
  --accent-4: #D0DBF0;
  --link: #B8A9D9;
  --thread-start: #D4C5F0;
  --thread-end: #C5E8F0;

  --text-primary: #5A5A6A;
  --text-secondary: #6A6A7A;
  --text-tertiary: #7A7A8A;
  --text-muted: #A8A8B8;

  --radius-card: 20px;
  --radius-small: 16px;
  --radius-pill: 24px;
  --radius-button: 12px;

  --shadow-raised: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
  --shadow-inset: inset 8px 8px 16px var(--shadow-dark), inset -8px -8px 16px var(--shadow-light);
  --shadow-small: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
}

/* Attorney portal override */
[data-portal="attorney"] {
  --font-primary: 'Manrope', sans-serif;
  --bg: #EDF0F5;
  --surface: #EDF0F5;
  --shadow-dark: #C5D1E0;
  --accent-1: #A8C4E0;
  --accent-2: #B8B8E0;
  --accent-3: #9BB8D0;
  --accent-4: #8BAFD0;
  --link: #7B9FCC;
  --thread-start: #A8C4E0;
  --thread-end: #7B9FCC;
  --text-primary: #3A3A4A;
}

/* DV Org portal override */
[data-portal="dvorg"] {
  --bg: #EDF0EC;
  --surface: #EDF0EC;
  --shadow-dark: #C5D1C0;
  --accent-1: #A8C4A8;
  --accent-2: #8BB8A0;
  --accent-3: #C4D4B8;
  --accent-4: #9BB890;
  --link: #A8C4A8;
  --thread-start: #A8C4A8;
  --thread-end: #8BB8A0;
}
```

### Tailwind Config (if using Tailwind)
```js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        nunito: ['Nunito', 'sans-serif'],
        manrope: ['Manrope', 'sans-serif'],
      },
      colors: {
        // Survivor
        'pp-bg': '#F0F2F5',
        'pp-purple': '#D4C5F0',
        'pp-cyan': '#C5E8F0',
        'pp-lavender': '#C8D9F0',
        'pp-link': '#B8A9D9',
        // Attorney
        'pp-att-bg': '#EDF0F5',
        'pp-att-blue': '#A8C4E0',
        'pp-att-steel': '#9BB8D0',
        // DV Org
        'pp-dv-bg': '#EDF0EC',
        'pp-sage': '#A8C4A8',
        'pp-sage-deep': '#8BB8A0',
        // Text
        'pp-text': '#5A5A6A',
        'pp-text-2': '#6A6A7A',
        'pp-text-3': '#7A7A8A',
        'pp-text-muted': '#A8A8B8',
        // Marketing only
        'pp-terracotta': '#E77B56',
      },
      borderRadius: {
        'pp-card': '20px',
        'pp-small': '16px',
        'pp-pill': '24px',
      },
    },
  },
};
```

### Neumorphic Card Component (React)
```jsx
const NeuCard = ({ children, className = '', inset = false, small = false }) => {
  const shadowClass = inset
    ? 'shadow-neu-inset'
    : small
    ? 'shadow-neu-small'
    : 'shadow-neu-raised';

  return (
    <div className={`bg-pp-bg rounded-pp-card ${shadowClass} ${className}`}>
      {children}
    </div>
  );
};
```

### Thread Component (React)
```jsx
const ThreadLine = ({ portal = 'survivor' }) => {
  const gradients = {
    survivor: 'linear-gradient(180deg, #D4C5F0, #C5E8F0)',
    attorney: 'linear-gradient(180deg, #A8C4E0, #7B9FCC)',
    dvorg: 'linear-gradient(180deg, #A8C4A8, #8BB8A0)',
  };

  return (
    <div
      className="absolute w-[2px] rounded-full opacity-60 z-0"
      style={{ background: gradients[portal] }}
      aria-hidden="true"
    />
  );
};
```

---

## 12. Standing Safety Rules — NEVER Violate

1. **Never label, name, or auto-diagnose "patterns of abuse."** Surface frequency counts and neutral visual patterns only. The human draws the conclusion.
2. **Never gate a survivor-critical feature behind payment.** Case Builder and core documentation are free, permanently.
3. **Never write copy implying a survivor should leave their abuser.**
4. **Exit Safely and App Disguise are core safety infrastructure** — any change touching them is high-stakes. Treat with highest review priority.
5. **Never use terracotta (#E77B56) in-app.** It is marketing/CTA accent ONLY.

---

## 13. Do NOT Include

- No dark mode (survivors need calm, not contrast)
- No animations beyond 200ms ease-out (avoid triggering startle responses)
- No haptic feedback without user opt-in
- No notifications that could reveal app purpose when disguised
- No card borders or outlines (neumorphism uses shadows only, no borders)
- No single drop shadows (always paired light + dark)
- No pure black (#000000) text anywhere
- No orange/peach/terracotta in any in-app surface
