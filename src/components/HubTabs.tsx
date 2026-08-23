import { Link } from "@tanstack/react-router";
import { useRouterState } from "@tanstack/react-router";

export interface HubTab {
  to: string;
  label: string;
}

/**
 * Flat, quiet tab strip used at the top of each hub (Archive, Recurline,
 * Case, Resources). Purely navigational — every tab is always available.
 */
export function HubTabs({ tabs }: { tabs: HubTab[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav aria-label="Section" className="pp-hub-tabs no-print">
      {tabs.map((t) => {
        const active = pathname === t.to || pathname.startsWith(t.to + "/");
        return (
          <Link key={t.to} to={t.to} className="pp-hub-tab" data-active={active ? "true" : "false"}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export const ARCHIVE_TABS: HubTab[] = [
  { to: "/journal", label: "Marks" },
  { to: "/voice-notes", label: "Voice notes" },
  { to: "/evidence", label: "Evidence" },
  { to: "/message-threads", label: "Message threads" },
  { to: "/timeline", label: "Timeline" },
];

export const RECURLINE_TABS: HubTab[] = [
  { to: "/patterns", label: "Recurline" },
  { to: "/calendar", label: "Marks Calendar" },
];

export const CASE_TABS: HubTab[] = [
  { to: "/case-builder", label: "Case builder" },
  { to: "/court-packet", label: "Court packet" },
  { to: "/communications", label: "Communication log" },
  { to: "/court-dates", label: "Court dates" },
  { to: "/share-with-attorney", label: "Share with attorney" },
  { to: "/share-with-advocate", label: "Share with advocate" },
];

export const RESOURCE_TABS: HubTab[] = [
  { to: "/resources", label: "Resources" },
  { to: "/opra-helper", label: "Records requests" },
  { to: "/court-systems", label: "Court systems guide" },
];
