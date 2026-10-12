import { createFileRoute } from "@tanstack/react-router";
import { DemoPortalShell } from "@/components/demo/DemoPortalShell";
import { DemoPrepPortal } from "@/components/demo/DemoPrepPortal";
import { DEMO_ROBOTS_META } from "@/lib/demo/portals";

/** Fictional, no-account court-prep portal. Static content; practice held in memory only. */
export const Route = createFileRoute("/demo_/prep")({
  head: () => ({
    meta: [{ title: "Court prep demo (fictional) | PatternProof" }, DEMO_ROBOTS_META],
  }),
  component: DemoPrepPage,
});

function DemoPrepPage() {
  return (
    <DemoPortalShell
      portal="prep"
      persona="survivor"
      eyebrow="Court prep · demo"
      title="Study modules and practice"
      intro="Procedural study modules and a printable clerk-question guide. Practice text stays in this tab's memory and is cleared when you leave."
    >
      <DemoPrepPortal />
    </DemoPortalShell>
  );
}
