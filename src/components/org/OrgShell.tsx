import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3, BookOpen, ClipboardList, Clock, Home, LogOut, Settings,
  ShieldCheck, Share2, Users,
} from "lucide-react";
import { OrgCubeMark } from "@/components/org/OrgCubeMark";
import { quickExit } from "@/lib/quick-exit";

export type OrgNavKey =
  | "home" | "shared" | "referrals" | "requests" | "consent"
  | "follow-up" | "resources" | "reports" | "team" | "settings"
  /** legacy alias kept so existing callers keep compiling */
  | "organization";

interface OrgShellProps {
  /** Optional override; by default the current route decides. */
  active?: OrgNavKey;
  /** Kept for callers that pre-date route-derived nav state. */
  showOrganization?: boolean;
  showSharedSurvivors?: boolean;
  /** Small line in the rail footer, e.g. the organization name. */
  accountLabel?: string | null;
  onSignOut?: () => void;
  children: React.ReactNode;
}

const NAV = [
  { key: "home", label: "Dashboard", to: "/org-portal", icon: Home },
  { key: "shared", label: "Clients", to: "/advocate-cases", icon: Users },
  { key: "referrals", label: "Referrals", to: "/org/referrals", icon: Share2 },
  { key: "requests", label: "Record requests", to: "/org/record-requests", icon: ClipboardList },
  { key: "consent", label: "Consent centre", to: "/org/consent", icon: ShieldCheck },
  { key: "follow-up", label: "Follow-ups", to: "/org/follow-ups", icon: Clock },
  { key: "resources", label: "Resources", to: "/org/resources", icon: BookOpen },
  { key: "reports", label: "Reports", to: "/org/reports", icon: BarChart3 },
  { key: "team", label: "Team", to: "/org/team", icon: Users },
  { key: "settings", label: "Organization", to: "/org/settings", icon: Settings },
] as const;

const TABS: OrgNavKey[] = ["home", "shared", "requests", "consent", "resources"];

function keyForPath(pathname: string): OrgNavKey {
  const hit = [...NAV].sort((a, b) => b.to.length - a.to.length).find((n) => pathname.startsWith(n.to));
  return (hit?.key ?? "home") as OrgNavKey;
}

export function OrgShell({ active, accountLabel, onSignOut, children }: OrgShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = active === "organization" ? "home" : (active ?? keyForPath(pathname));

  return (
    <div className="orgx" data-persona="org">
      <div className="orgx-layout">
        <nav className="orgx-rail" aria-label="DV organization navigation">
          <span className="orgx-brand">
            <OrgCubeMark size={32} />
            <span style={{ minWidth: 0 }}>
              <span className="orgx-brand__word">PatternProof</span>
              <span className="orgx-brand__sub">DV organization portal</span>
            </span>
          </span>

          <div className="orgx-rail-scroll">
            {NAV.map(({ key, label, to, icon: Icon }) => (
              <Link key={key} to={to} className="orgx-navitem" aria-current={current === key ? "page" : undefined}>
                <Icon size={18} strokeWidth={1.7} aria-hidden />
                <span>{label}</span>
              </Link>
            ))}
          </div>

          <div className="orgx-rail-foot">
            <Link to="/privacy" className="orgx-navitem">
              <ShieldCheck size={18} strokeWidth={1.7} aria-hidden />
              <span>Privacy</span>
            </Link>
            <button
              type="button"
              className="orgx-navitem"
              onClick={() => quickExit()}
              title="Signs you out of PatternProof and leaves for another site. It cannot clear browser history or stop device monitoring."
            >
              <LogOut size={18} strokeWidth={1.7} aria-hidden />
              <span>Quick Exit</span>
            </button>
            {onSignOut ? (
              <button type="button" className="orgx-navitem" onClick={onSignOut}>
                <LogOut size={18} strokeWidth={1.7} aria-hidden />
                <span>Sign out</span>
              </button>
            ) : null}
            {accountLabel ? (
              <span className="orgx-muted" style={{ fontSize: 12, padding: "6px 13px" }}>{accountLabel}</span>
            ) : null}
          </div>
        </nav>

        <div style={{ minWidth: 0 }}>
          <header className="orgx-topbar">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <OrgCubeMark size={28} />
              <span style={{ display: "grid", minWidth: 0 }}>
                <span className="orgx-brand__word">PatternProof</span>
                <span className="orgx-brand__sub">DV organization portal</span>
              </span>
            </span>
            <button type="button" className="orgx-btn orgx-btn-quiet" style={{ minHeight: 36, padding: "6px 12px" }} onClick={() => quickExit()}>
              Quick Exit
            </button>
          </header>

          <main className="orgx-main">{children}</main>
        </div>
      </div>

      <nav className="orgx-tabbar" aria-label="DV organization navigation">
        {TABS.map((key) => {
          const item = NAV.find((n) => n.key === key)!;
          const Icon = item.icon;
          return (
            <Link key={key} to={item.to} className="orgx-tab" aria-current={current === key ? "page" : undefined}>
              <Icon size={19} strokeWidth={1.7} aria-hidden />
              <span>{item.label === "Record requests" ? "Requests" : item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
