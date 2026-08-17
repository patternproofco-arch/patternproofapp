import { Link, useRouterState } from "@tanstack/react-router";
import { Home, PenLine, Scale, Paperclip } from "lucide-react";
import { DotCirclePatternIcon } from "@/components/icons/PpIcons";

type Tab = {
  to: string;
  label: string;
  match: string[];
  render: (color: string) => React.ReactNode;
};

const TABS: Tab[] = [
  {
    to: "/dashboard",
    label: "Home",
    match: ["/dashboard"],
    render: (c) => <Home size={20} strokeWidth={1.75} color={c} />,
  },
  {
    to: "/save-now",
    label: "Save now",
    match: ["/save-now", "/journal", "/voice-notes", "/message-threads", "/import-messages", "/live-recording"],
    render: (c) => <PenLine size={20} strokeWidth={1.75} color={c} />,
  },
  {
    to: "/evidence",
    label: "Evidence",
    match: ["/evidence", "/evidence-review", "/timeline", "/calendar"],
    render: (c) => <Paperclip size={20} strokeWidth={1.75} color={c} />,
  },
  {
    to: "/patterns",
    label: "Patterns",
    match: ["/patterns"],
    render: (c) => <DotCirclePatternIcon size={20} strokeWidth={1.75} color={c} />,
  },
  {
    to: "/case",
    label: "Case",
    match: ["/case", "/case-builder", "/court-packet", "/communications", "/court-dates", "/share-with-attorney", "/attorney-portal", "/legal-documents", "/record-requests"],
    render: (c) => <Scale size={20} strokeWidth={1.75} color={c} />,
  },
];

/**
 * Flat bottom tab bar — five destinations, cream surface, no elevation.
 * Deliberately quiet: it should recede, not compete with the page.
 */
export function BottomTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="no-print pp-tabbar"
      aria-label="Main"
      style={{
        position: "fixed",
        insetInline: 0,
        bottom: 0,
        zIndex: 90,
        boxShadow: "none",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="mx-auto flex w-full max-w-2xl items-stretch">
        {TABS.map((t) => {
          const active = t.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
          const color = active ? "var(--sv-green-700, #17553A)" : "var(--muted-foreground)";
          return (
            <Link
              key={t.to}
              to={t.to}
              aria-label={t.label}
              aria-current={active ? "page" : undefined}
              className="flex flex-1 flex-col items-center justify-center gap-1"
              style={{ padding: "10px 4px 12px", color, textDecoration: "none" }}
            >
              {t.render(color)}
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, letterSpacing: "0.01em" }}>
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
