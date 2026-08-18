import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { portalTheme, type PortalVariant } from "./portal-theme";

export interface QuickAction {
  label: string;
  icon: LucideIcon;
  to: string;
  params?: Record<string, string>;
}

/** Icon tiles laid out in a 2-row grid, themed per portal. */
export function QuickActionGrid({ variant, actions }: { variant: PortalVariant; actions: QuickAction[] }) {
  const t = portalTheme(variant);
  const cols = Math.max(2, Math.ceil(actions.length / 2));
  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        gridTemplateColumns: `repeat(${Math.min(cols, 3)}, minmax(0,1fr))`,
      }}
      className="portal-quick-grid"
    >
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={a.label}
            to={a.to}
            params={a.params as never}
            style={{
              display: "grid",
              gap: 10,
              padding: "16px 14px",
              borderRadius: 14,
              border: `1px solid ${t.line}`,
              background: t.card,
              color: t.ink,
              textDecoration: "none",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                borderRadius: 10,
                background: t.mark,
                color: t.accent,
              }}
            >
              <Icon size={17} strokeWidth={1.8} />
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{a.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
