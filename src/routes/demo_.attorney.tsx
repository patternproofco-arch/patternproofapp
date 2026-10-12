import { createFileRoute } from "@tanstack/react-router";
import attorneyCss from "@/styles/attorney.css?url";
import { DemoAttorneyPortal } from "@/components/demo/DemoAttorneyPortal";
import { DemoPortalShell } from "@/components/demo/DemoPortalShell";
import { DEMO_ROBOTS_META } from "@/lib/demo/portals";

/** Fictional, no-account attorney portal. Fixture data only; no sign-in, no network. */
export const Route = createFileRoute("/demo_/attorney")({
  head: () => ({
    meta: [{ title: "Attorney portal demo (fictional) | PatternProof" }, DEMO_ROBOTS_META],
    links: [{ rel: "stylesheet", href: attorneyCss }],
  }),
  component: DemoAttorneyPage,
});

function DemoAttorneyPage() {
  return (
    <DemoPortalShell
      portal="attorney"
      persona="attorney"
      eyebrow="Attorney portal · demo"
      title="A sample caseload and binder"
      intro="Fictional clients and records showing how shared material reaches an attorney. Click around: nothing here is real, and nothing is saved."
    >
      <DemoAttorneyPortal />
    </DemoPortalShell>
  );
}
