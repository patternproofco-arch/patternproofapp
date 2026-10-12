import { createFileRoute } from "@tanstack/react-router";
import { DemoOrgPortal } from "@/components/demo/DemoOrgPortal";
import { DemoPortalShell } from "@/components/demo/DemoPortalShell";
import { DEMO_ROBOTS_META } from "@/lib/demo/portals";

/** Fictional, no-account organization partner portal. Fixture data only. */
export const Route = createFileRoute("/demo_/org")({
  head: () => ({
    meta: [{ title: "Organization portal demo (fictional) | PatternProof" }, DEMO_ROBOTS_META],
  }),
  component: DemoOrgPage,
});

function DemoOrgPage() {
  return (
    <DemoPortalShell
      portal="org"
      persona="org"
      eyebrow="Organization portal · demo"
      title="A sample partner dashboard"
      intro="A fictional advocacy organization's view: counts of shared records, referrals, and a grant report preview built from invented rows. Nothing here is real, and nothing is saved."
    >
      <DemoOrgPortal />
    </DemoPortalShell>
  );
}
