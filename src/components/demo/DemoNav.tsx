import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, NotebookPen, CalendarClock, Paperclip, Mic,
  BarChart3, Scale, FileText, ShieldCheck,
} from "lucide-react";
import { PpCubeMark } from "@/components/survivor/PpCubeMark";

export const DEMO_NAV = [
  { to: "/demo", label: "Dashboard", Icon: LayoutDashboard, group: "Document" },
  { to: "/demo/journal", label: "Journal", Icon: NotebookPen, group: "Document" },
  { to: "/demo/timeline", label: "Timeline", Icon: CalendarClock, group: "Document" },
  { to: "/demo/evidence", label: "Evidence", Icon: Paperclip, group: "Document" },
  { to: "/demo/voice-notes", label: "Voice Notes", Icon: Mic, group: "Document" },
  { to: "/demo/patterns", label: "Recurrence", Icon: BarChart3, group: "Build your case" },
  { to: "/demo/case-builder", label: "Case Builder", Icon: Scale, group: "Build your case" },
  { to: "/demo/court-packet", label: "Court Packet", Icon: FileText, group: "Build your case" },
] as const;

function useActive() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (to: string) => (to === "/demo" ? pathname === "/demo" || pathname === "/demo/" : pathname.startsWith(to));
}

/** Fixed forest-green rail for the demo, mirroring the survivor portal. */
export function DemoSideNav() {
  const isActive = useActive();
  const groups = ["Document", "Build your case"] as const;
  return (
    <aside className="pp-sidebar no-print" aria-label="Demo navigation">
      <div className="pp-sidebar__brand">
        <PpCubeMark size={30} />
        <span className="pp-sidebar__wordmark">PatternProof</span>
      </div>
      <nav className="pp-sidebar__nav">
        {groups.map((group) => (
          <div key={group}>
            <div className="pp-sidebar__group">{group}</div>
            {DEMO_NAV.filter((i) => i.group === group).map(({ to, label, Icon }) => (
              <Link key={to} to={to} className="pp-navlink" data-active={isActive(to)}>
                <Icon size={17} strokeWidth={1.9} />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="pp-sidebar__foot">
        <div className="pp-sidebar__safety">
          <ShieldCheck size={15} strokeWidth={2} />
          <span>Demo environment — fictional data only.</span>
        </div>
      </div>
    </aside>
  );
}

/** Horizontal nav for laptops in narrow windows and phones. */
export function DemoMobileNav() {
  const isActive = useActive();
  return (
    <div className="demo-mobilenav no-print lg:hidden" role="navigation" aria-label="Demo sections">
      {DEMO_NAV.map(({ to, label, Icon }) => (
        <Link key={to} to={to} className="demo-mobilenav__item" data-active={isActive(to)}>
          <Icon size={15} strokeWidth={1.9} />
          <span>{label}</span>
        </Link>
      ))}
    </div>
  );
}
