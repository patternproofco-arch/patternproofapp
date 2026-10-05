import { Link, useRouterState } from "@tanstack/react-router";

const LINKS: Array<{ to: string; label: string; exact?: boolean }> = [
  { to: "/prep", label: "Overview", exact: true },
  { to: "/prep/intake", label: "Intake" },
  { to: "/prep/modules", label: "Modules" },
  { to: "/prep/guide", label: "Printable guide" },
];

export function CourtPrepNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav aria-label="Court prep" className="pp-hub-tabs no-print mb-4">
      {LINKS.map((l) => {
        const active = l.exact
          ? pathname === l.to || pathname === `${l.to}/`
          : pathname === l.to || pathname.startsWith(`${l.to}/`);
        return (
          <Link key={l.to} to={l.to} className="pp-hub-tab" data-active={active ? "true" : "false"}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
