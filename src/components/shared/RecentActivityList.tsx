import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { portalTheme, type PortalVariant } from "./portal-theme";

export interface ActivityRow {
  id: string;
  icon: LucideIcon;
  title: string;
  /** Already-formatted timestamp or relative time. */
  timestamp: string;
  to?: string;
  params?: Record<string, string>;
  /** Optional emphasis (e.g. needs attention). */
  highlight?: boolean;
}

interface Props {
  variant: PortalVariant;
  title: string;
  rows: ActivityRow[] | null;
  viewAll?: { to: string; label: string };
  emptyMessage?: string;
  loadingMessage?: string;
}

/** Icon + title + timestamp rows with a "View all" link. */
export function RecentActivityList({
  variant,
  title,
  rows,
  viewAll,
  emptyMessage = "Nothing here yet — when you're ready, this is a safe place to start.",
  loadingMessage = "Loading…",
}: Props) {
  const t = portalTheme(variant);
  return (
    <section style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: t.muted }}>
          {title}
        </h2>
        {viewAll ? (
          <Link
            to={viewAll.to}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: t.accent, textDecoration: "none" }}
          >
            {viewAll.label} <ArrowRight size={13} />
          </Link>
        ) : null}
      </div>

      <div style={{ border: `1px solid ${t.line}`, borderRadius: 14, background: t.card, overflow: "hidden" }}>
        {rows === null ? (
          <div style={{ padding: 18, fontSize: 13, color: t.muted }}>{loadingMessage}</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 18, fontSize: 13.5, color: t.muted }}>{emptyMessage}</div>
        ) : (
          rows.map((r, i) => {
            const Icon = r.icon;
            const inner = (
              <>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    background: t.mark,
                    color: t.accent,
                    flex: "0 0 auto",
                  }}
                >
                  <Icon size={15} strokeWidth={1.8} />
                </span>
                <span style={{ fontSize: 13.5, lineHeight: 1.45, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.title}
                </span>
                <span style={{ fontSize: 12, color: t.muted, whiteSpace: "nowrap" }}>{r.timestamp}</span>
              </>
            );
            const style: React.CSSProperties = {
              display: "grid",
              gridTemplateColumns: "auto minmax(0,1fr) auto",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderTop: i === 0 ? "none" : `1px solid ${t.line}`,
              color: t.ink,
              textDecoration: "none",
              borderLeft: r.highlight ? `3px solid ${t.accent}` : "3px solid transparent",
            };
            return r.to ? (
              <Link key={r.id} to={r.to} params={r.params as never} style={style}>
                {inner}
              </Link>
            ) : (
              <div key={r.id} style={style}>
                {inner}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
