import { Link, useRouterState } from "@tanstack/react-router";
import { NAV_TABS } from "@/lib/nav-tabs";
import { CalendarDays, House, NotebookPen, Users } from "lucide-react";
import { navTabFor } from "@/lib/nav-tabs";

const ICONS = {
  home: House,
  notes: NotebookPen,
  timeline: CalendarDays,
  sharing: Users,
} as const;

/**
 * Flat bottom tab bar — four destinations, fixed to the bottom, cream surface.
 * Deliberately quiet: it should recede, not compete with the page.
 */
export function BottomTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="pp-bottom-tab-bar no-print" aria-label="Main">
      <div className="pp-bottom-tab-inner mx-auto flex w-full max-w-2xl items-stretch">
        {NAV_TABS.map((t) => {
          const active = navTabFor(pathname) === t.id;
          const Icon = ICONS[t.id];
          const color = active ? "var(--foreground)" : "var(--muted-foreground)";
          return (
            <Link
              key={t.id}
              to={t.to}
              aria-label={t.label}
              aria-current={active ? "page" : undefined}
              className="pp-bottom-tab flex flex-1 flex-col items-center justify-center gap-1"
              data-active={active ? "true" : "false"}
              data-tab={t.id}
              style={{ color }}
            >
              <Icon size={22} strokeWidth={1.5} color={color} aria-hidden />
              <span
                style={{ fontSize: 11, fontWeight: active ? 700 : 500, letterSpacing: "0.01em" }}
              >
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomTabBar;
