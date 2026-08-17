import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, NotebookPen, CalendarClock, Paperclip, Mic,
  Scale, FileText, BookOpen, ShieldCheck, Settings as SettingsIcon,
} from "lucide-react";
import { PpCubeMark } from "@/components/survivor/PpCubeMark";

type Item = { to: string; label: string; Icon: typeof NotebookPen; match?: string[] };

const DOCUMENT: Item[] = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/journal", label: "Journal", Icon: NotebookPen, match: ["/journal", "/message-threads", "/import-messages"] },
  { to: "/timeline", label: "Timeline", Icon: CalendarClock, match: ["/timeline", "/calendar"] },
  { to: "/evidence", label: "Evidence", Icon: Paperclip, match: ["/evidence", "/evidence-review"] },
  { to: "/voice-notes", label: "Voice Notes", Icon: Mic, match: ["/voice-notes", "/live-recording"] },
];

const BUILD: Item[] = [
  { to: "/patterns", label: "Patterns", Icon: LayoutDashboard },
  { to: "/case-builder", label: "Case Builder", Icon: Scale, match: ["/case-builder", "/case", "/court-dates"] },
  { to: "/court-packet", label: "Court Packet", Icon: FileText },
  { to: "/share-with-attorney", label: "Sharing", Icon: ShieldCheck, match: ["/share-with-attorney", "/share-with-advocate", "/attorney-portal", "/record-requests"] },
];

const SUPPORT: Item[] = [
  { to: "/resources", label: "Resources", Icon: BookOpen, match: ["/resources", "/court-systems", "/opra-helper", "/why-courts-struggle"] },
  { to: "/settings", label: "Settings & Safety", Icon: SettingsIcon },
];

function NavGroup({ title, items, pathname }: { title: string; items: Item[]; pathname: string }) {
  return (
    <>
      <div className="pp-sidebar__group">{title}</div>
      {items.map(({ to, label, Icon, match }) => {
        const targets = match ?? [to];
        const active = targets.some((m) => pathname === m || pathname.startsWith(m + "/"));
        return (
          <Link key={to} to={to} className="pp-navlink" data-active={active} aria-current={active ? "page" : undefined}>
            <Icon size={17} strokeWidth={1.9} />
            <span>{label}</span>
          </Link>
        );
      })}
    </>
  );
}

/** Fixed forest-green rail — desktop only; mobile uses the bottom tab bar. */
export function SideNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="pp-sidebar no-print" aria-label="Main">
      <div className="pp-sidebar__brand">
        <PpCubeMark size={30} />
        <span className="pp-sidebar__wordmark">PatternProof</span>
      </div>
      <nav className="pp-sidebar__nav">
        <NavGroup title="Document" items={DOCUMENT} pathname={pathname} />
        <NavGroup title="Build your case" items={BUILD} pathname={pathname} />
        <NavGroup title="Support" items={SUPPORT} pathname={pathname} />
      </nav>
      <div className="pp-sidebar__foot">
        <div className="pp-sidebar__safety">
          <ShieldCheck size={15} strokeWidth={2} />
          <span>Private to you. Encrypted in transit.</span>
        </div>
      </div>
    </aside>
  );
}

export default SideNav;
