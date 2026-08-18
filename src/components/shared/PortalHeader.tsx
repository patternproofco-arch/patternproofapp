import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PORTAL_THEME, type PortalVariant } from "@/components/shared/portal-theme";

export interface PortalHeaderProps {
  variant?: PortalVariant;
  /** Defaults to the portal's own name, e.g. "SURVIVOR PORTAL". */
  subtitle?: string;
  greeting?: string;
  subline?: string;
  notificationsHref?: string;
  notificationCount?: number;
}

/** Shared wordmark + portal badge + greeting used by all three portals. */
export function PortalHeader({
  variant = "survivor",
  subtitle,
  greeting = "Welcome back,",
  subline,
  notificationsHref,
  notificationCount,
}: PortalHeaderProps) {
  const t = PORTAL_THEME[variant];
  const Mark = t.mark;
  const bell = (
    <span
      className="relative grid h-10 w-10 shrink-0 place-items-center"
      style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 14, color: t.accent }}
    >
      <Bell size={17} strokeWidth={1.8} />
      {!!notificationCount && (
        <span
          className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px]"
          style={{ background: t.accent, color: "#fff", fontWeight: 700 }}
        >
          {notificationCount}
        </span>
      )}
    </span>
  );

  return (
    <header>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {Mark && <Mark size={32} />}
          <span className="min-w-0">
            <span
              className="block truncate"
              style={{
                fontFamily: "'Fraunces', Georgia, serif",
                fontSize: 17,
                fontWeight: 600,
                letterSpacing: "0.04em",
                color: t.ink,
              }}
            >
              PATTERN·PROOF
            </span>
            <span
              className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10.5px]"
              style={{
                background: t.accentSoft,
                color: t.accent,
                letterSpacing: "0.12em",
                fontWeight: 700,
              }}
            >
              {subtitle ?? t.label}
            </span>
          </span>
        </div>
        {notificationsHref ? (
          <Link to={notificationsHref as never} aria-label="Notifications" className="pp-shared-focus">
            {bell}
          </Link>
        ) : (
          <span aria-hidden="true">{bell}</span>
        )}
      </div>

      <div className="mt-5">
        <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.15, color: t.ink }}>{greeting}</h1>
        {subline && (
          <p className="mt-2 max-w-xl text-[14px]" style={{ color: t.muted }}>
            {subline}
          </p>
        )}
      </div>
    </header>
  );
}

export default PortalHeader;
