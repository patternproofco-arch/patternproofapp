import { Link } from "@tanstack/react-router";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { PORTAL_THEME, type PortalVariant } from "@/components/shared/portal-theme";

export interface SharedActivityItem {
  id?: string;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** ISO string or already-formatted relative label. */
  timestamp: string;
  href?: string;
}

export interface RecentActivityFeedProps {
  items: SharedActivityItem[] | null;
  viewAllHref?: string;
  heading?: string;
  emptyMessage?: string;
  variant?: PortalVariant;
}

/** "2h ago" / "Today, 9:21 AM" / "Yesterday" — falls back to the raw label. */
export function relativeTime(input: string): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return diffMs < 6 * 3600_000 ? `${Math.round(mins / 60)}h ago` : `Today, ${time}`;
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function RecentActivityFeed({
  items,
  viewAllHref,
  heading = "Recent activity",
  emptyMessage = "Nothing here yet — when you're ready, this is a safe place to start.",
  variant = "survivor",
}: RecentActivityFeedProps) {
  const t = PORTAL_THEME[variant];
  return (
    <section>
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h2 className="min-w-0 truncate text-[15px]" style={{ margin: 0, fontWeight: 600, color: t.ink }}>
          {heading}
        </h2>
        {viewAllHref && (
          <Link
            to={viewAllHref as never}
            className="pp-shared-focus inline-flex shrink-0 items-center gap-1 text-[13px]"
            style={{ color: t.accent, textDecoration: "none", fontWeight: 600 }}
          >
            View all <ArrowRight size={13} />
          </Link>
        )}
      </div>

      {items === null ? (
        <p className="text-[13px]" style={{ color: t.muted }}>Gathering your recent activity…</p>
      ) : items.length === 0 ? (
        <p
          className="text-[13.5px]"
          style={{ color: t.muted, background: t.card, border: `1px solid ${t.line}`, borderRadius: 20, padding: 16 }}
        >
          {emptyMessage}
        </p>
      ) : (
        <ul className="grid gap-2">
          {items.map((it, i) => {
            const Icon = it.icon;
            const row = (
              <span className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center"
                  style={{ background: t.accentSoft, borderRadius: 12, color: t.accent }}
                >
                  <Icon size={16} strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px]" style={{ color: t.ink }}>{it.title}</span>
                  {it.subtitle && (
                    <span className="mt-0.5 block truncate text-[12.5px]" style={{ color: t.muted }}>
                      {it.subtitle}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[12px]" style={{ color: t.muted }}>
                  {relativeTime(it.timestamp)}
                </span>
              </span>
            );
            const style = {
              display: "flex",
              background: t.card,
              border: `1px solid ${t.line}`,
              borderRadius: 18,
              padding: "12px 14px",
              textDecoration: "none",
            } as const;
            return (
              <li key={it.id ?? `${it.title}-${i}`}>
                {it.href ? (
                  <Link to={it.href as never} className="pp-shared-focus" style={style}>{row}</Link>
                ) : (
                  <div style={style}>{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default RecentActivityFeed;
