/**
 * Survivor bottom nav: four tabs (Experience, 2026-10-15). Old routes stay
 * reachable and light up the tab they now live under.
 */
export type NavTabId = "home" | "notes" | "timeline" | "sharing";

export const NAV_TABS: Array<{ id: NavTabId; label: string; to: string; match: string[] }> = [
  { id: "home", label: "Home", to: "/dashboard", match: ["/dashboard"] },
  {
    id: "notes",
    label: "Notes",
    to: "/journal",
    match: [
      "/journal",
      "/drafts",
      "/evidence",
      "/voice-notes",
      "/message-threads",
      "/import-messages",
      "/evidence-review",
      "/live-recording",
    ],
  },
  {
    id: "timeline",
    label: "Timeline",
    to: "/timeline",
    match: ["/timeline", "/calendar", "/patterns", "/court-timeline", "/frequency-matrix"],
  },
  {
    id: "sharing",
    label: "Sharing",
    to: "/access",
    match: [
      "/access",
      "/requests",
      "/case",
      "/case-builder",
      "/court-packet",
      "/communications",
      "/court-dates",
      "/share-with-attorney",
      "/share-with-advocate",
      "/legal-documents",
    ],
  },
];

export function navTabFor(pathname: string): NavTabId | undefined {
  for (const t of NAV_TABS)
    if (t.match.some((m) => pathname === m || pathname.startsWith(m + "/"))) return t.id;
  return undefined;
}

/** Segmented controls at the top of a tab's pages. */
export const SECTION_SEGMENTS: Partial<Record<NavTabId, Array<{ label: string; to: string }>>> = {
  notes: [
    { label: "Notes", to: "/journal" },
    { label: "Drafts", to: "/drafts" },
    { label: "Files", to: "/evidence" },
  ],
  timeline: [
    { label: "List", to: "/timeline" },
    { label: "Calendar", to: "/calendar" },
    { label: "Patterns", to: "/patterns" },
  ],
  sharing: [
    { label: "Who can see", to: "/access" },
    { label: "Prepare to share", to: "/court-packet" },
  ],
};

/** Segments show only on the pages they switch between. */
export function segmentsFor(pathname: string) {
  const tab = navTabFor(pathname);
  const segs = tab ? SECTION_SEGMENTS[tab] : undefined;
  if (!segs || !segs.some((s) => pathname === s.to)) return undefined;
  return segs;
}
