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
    <nav
      aria-label="Section"
      className="no-print mb-6 flex flex-wrap gap-x-5 gap-y-2"
      style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8 }}
    >
      {tabs.map((t) => {
        const active = pathname === t.to || pathname.startsWith(t.to + "/");
        return (
          <Link
            key={t.to}
            to={t.to}
            className="text-[13px]"
            style={{
              color: active ? "var(--foreground)" : "var(--muted-foreground)",
              fontWeight: active ? 700 : 500,
              paddingBottom: 6,
              marginBottom: -9,
              borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent",
            }}
          >
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
