import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home, PenLine, Paperclip, CalendarClock, Repeat,
  Scale, ShieldCheck, Settings as SettingsIcon,
} from "lucide-react";
import { PpCubeMark } from "@/components/survivor/PpCubeMark";

type Item = { to: string; label: string; Icon: typeof PenLine; match?: string[] };

const DOCUMENT: Item[] = [
  { to: "/dashboard", label: "Home", Icon: Home },
  { to: "/save-now", label: "Save now", Icon: PenLine, match: ["/save-now", "/journal", "/voice-notes", "/message-threads", "/import-messages"] },
  { to: "/evidence", label: "Evidence", Icon: Paperclip, match: ["/evidence", "/evidence-review"] },
  { to: "/timeline", label: "Timeline", Icon: CalendarClock, match: ["/timeline", "/calendar"] },
];

const BUILD: Item[] = [
  { to: "/patterns", label: "Pattern Motion", Icon: Repeat },
  { to: "/case-builder", label: "Case Builder", Icon: Scale, match: ["/case-builder", "/case", "/court-packet", "/court-dates"] },
  { to: "/record-requests", label: "Sharing & requests", Icon: ShieldCheck, match: ["/record-requests", "/share-with-attorney", "/share-with-advocate", "/attorney-portal"] },
];

const SUPPORT: Item[] = [
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

/** Fixed lavender rail — desktop only; mobile uses the bottom tab bar. */
export function SideNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="pp-sidebar no-print" aria-label="Main">
      <div className="pp-sidebar__brand">
        <PpCubeMark size={32} />
        <span>
          <span className="pp-sidebar__wordmark">PatternProof</span>
          <span className="pp-sidebar__portalname">Survivor portal</span>
        </span>
      </div>
      <nav className="pp-sidebar__nav">
        <NavGroup title="Document" items={DOCUMENT} pathname={pathname} />
        <NavGroup title="Make sense of it" items={BUILD} pathname={pathname} />
        <NavGroup title="Support" items={SUPPORT} pathname={pathname} />
      </nav>
      <div className="pp-sidebar__foot">
        <div className="pp-sidebar__safety">
          <ShieldCheck size={15} strokeWidth={2} />
          <span>Private to you. Encrypted in transit and at rest.</span>
        </div>
      </div>
    </aside>
  );
}

export default SideNav;
