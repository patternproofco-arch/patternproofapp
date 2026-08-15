import { Link } from "@tanstack/react-router";
import { Building2, BookOpen, Clock, Home, LogOut, ShieldCheck, Users } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { quickExit } from "@/lib/quick-exit";

export type OrgNavKey = "home" | "shared" | "follow-up" | "resources" | "organization";

interface OrgShellProps {
  /** Which rail item is the current page. */
  active: OrgNavKey;
  /** Only shown when the signed-in account really has partner access. */
  showOrganization?: boolean;
  /** Only shown when the signed-in account really has shared workspaces. */
  showSharedSurvivors?: boolean;
  /** Small right-aligned line in the rail footer, e.g. the org name. */
  accountLabel?: string | null;
  onSignOut?: () => void;
  children: React.ReactNode;
}

const ICONS = { home: Home, shared: Users, "follow-up": Clock, resources: BookOpen, organization: Building2 } as const;

export function OrgShell({
  active,
  showOrganization = false,
  showSharedSurvivors = true,
  accountLabel,
  onSignOut,
  children,
}: OrgShellProps) {
  const item = (key: OrgNavKey, label: string, to?: string) => {
    const Icon = ICONS[key];
    const current = active === key;
    if (!to) {
      return (
        <span key={key} className="orgx-navitem" data-inert="true" aria-disabled="true">
          <Icon size={18} strokeWidth={1.7} aria-hidden />
          <span>{label}</span>
          <span style={{ marginLeft: "auto", fontSize: 11 }} className="orgx-muted">
            Coming during pilot
          </span>
        </span>
      );
    }
    return (
      <Link key={key} to={to} className="orgx-navitem" aria-current={current ? "page" : undefined}>
        <Icon size={18} strokeWidth={1.7} aria-hidden />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <div className="orgx" data-persona="org">
      <div className="orgx-layout">
        <nav className="orgx-rail" aria-label="Organization navigation">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "4px 14px 22px" }}>
            <BrandMark size={26} />
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 20 }}>PatternProof</span>
          </span>

          <div className="orgx-rail-scroll">
            {item("home", "Home", showSharedSurvivors ? "/advocate-cases" : showOrganization ? "/org-portal" : undefined)}
            {showSharedSurvivors ? item("shared", "Shared survivors", "/advocate-cases") : null}
            {item("follow-up", "Follow-up")}
            {item("resources", "Resources")}
            {showOrganization ? item("organization", "Organization", "/org-portal") : null}
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
              <span className="orgx-muted" style={{ fontSize: 12, padding: "6px 14px" }}>
                {accountLabel}
              </span>
            ) : null}
          </div>
        </nav>

        <main className="orgx-main">{children}</main>
      </div>
    </div>
  );
}
