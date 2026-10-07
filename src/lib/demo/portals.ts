/**
 * Fictional, no-account demo portals. Every path here stays under /demo/*.
 * Nothing in src/lib/demo may import Supabase, server functions, network, or
 * browser storage — see src/__tests__/demo-no-live-data.test.ts.
 */
export type DemoPortalId = "survivor" | "attorney" | "org" | "prep";

export const DEMO_PORTALS: ReadonlyArray<{
  id: DemoPortalId;
  to: "/demo" | "/demo/attorney" | "/demo/org" | "/demo/prep";
  label: string;
  blurb: string;
}> = [
  { id: "survivor", to: "/demo", label: "Survivor", blurb: "Journal, timeline, evidence, packet" },
  { id: "attorney", to: "/demo/attorney", label: "Attorney", blurb: "Work queue and binder" },
  {
    id: "org",
    to: "/demo/org",
    label: "Organization",
    blurb: "Partner dashboard and grant preview",
  },
  { id: "prep", to: "/demo/prep", label: "Court prep", blurb: "Study modules and practice" },
];

export const DEMO_LABEL = "DEMO · Fictional · Read-only";

export const DEMO_ROBOTS_META = { name: "robots", content: "noindex, nofollow" } as const;

/** Toast copy for any save / export / share / upload control in the demo. */
export const DEMO_ONLY_TOAST = "Demo only. Nothing is saved, exported, or shared here.";
