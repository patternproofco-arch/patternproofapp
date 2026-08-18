import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { PORTAL_THEME, type PortalVariant } from "@/components/shared/portal-theme";

export interface PortalTabItem {
  icon: LucideIcon;
  label: string;
  href: string;
  /** Extra path prefixes that should light this tab up. */
  match?: string[];
}

export interface PortalBottomTabBarProps {
  items: PortalTabItem[];
  variant?: PortalVariant;
  accentColor?: string;
}

/** Mobile-only bottom navigation. Desktop navigation is untouched. */
export function PortalBottomTabBar({ items, variant = "survivor", accentColor }: PortalBottomTabBarProps) {
  const t = PORTAL_THEME[variant];
  const accent = accentColor ?? t.accent;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tabs = items.slice(0, 5);

  return (
    <nav
      className="no-print pp-shared-tabbar"
      aria-label="Portal navigation"
      style={{
        position: "fixed",
        insetInline: 0,
        bottom: 0,
        zIndex: 90,
        background: t.card,
        borderTop: `1px solid ${t.line}`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {tabs.map(({ icon: Icon, label, href, match }) => {
        const active = [href, ...(match ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
        return (
          <Link
            key={href}
            to={href as never}
            aria-current={active ? "page" : undefined}
            className="pp-shared-focus flex flex-1 flex-col items-center justify-center gap-1"
            style={{
              padding: "9px 4px 10px",
              textDecoration: "none",
              color: active ? accent : t.muted,
              fontWeight: active ? 600 : 500,
            }}
          >
            <Icon size={20} strokeWidth={active ? 2 : 1.75} />
            <span className="text-[11px]">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default PortalBottomTabBar;
