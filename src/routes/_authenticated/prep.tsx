import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CourtPrepNav } from "@/components/prep/CourtPrepNav";
import { CourtPrepSafetyBanner } from "@/components/prep/CourtPrepSafetyBanner";
import { PrepSessionChrome } from "@/components/prep/PrepSessionChrome";
import { HubTabs, RESOURCE_TABS } from "@/components/HubTabs";

export const Route = createFileRoute("/_authenticated/prep")({
  component: PrepLayout,
  // Soft signal for headers / docs: prep routes must not be offline-cached.
  staticData: { prepNoStore: true },
});

function PrepLayout() {
  return (
    <PrepSessionChrome>
      <div className="space-y-4">
        <div className="no-print">
          <HubTabs tabs={RESOURCE_TABS} />
        </div>
        <header className="no-print">
          <p
            className="text-[11px] uppercase tracking-[0.14em]"
            style={{ color: "var(--pp-muted)", fontFamily: "var(--font-mono)" }}
          >
            Court prep
          </p>
          <h1
            className="mt-1 text-2xl"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--pp-ink)" }}
          >
            Study and practice for hearing day
          </h1>
        </header>
        <div className="no-print">
          <CourtPrepSafetyBanner />
        </div>
        <CourtPrepNav />
        <Outlet />
      </div>
    </PrepSessionChrome>
  );
}
