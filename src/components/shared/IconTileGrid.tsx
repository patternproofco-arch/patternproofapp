import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { PORTAL_THEME, type PortalVariant } from "@/components/shared/portal-theme";

export interface IconTileItem {
  icon: LucideIcon;
  label: string;
  count?: number | string | null;
  href: string;
  /** Optional router search params, e.g. opening a form. */
  search?: Record<string, unknown>;
}

export interface IconTileGridProps {
  items: IconTileItem[];
  variant?: PortalVariant;
  ariaLabel?: string;
}

/** Responsive 2 x 3 grid of tappable destinations. */
export function IconTileGrid({ items, variant = "survivor", ariaLabel = "Quick actions" }: IconTileGridProps) {
  const t = PORTAL_THEME[variant];
  return (
    <nav aria-label={ariaLabel} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map(({ icon: Icon, label, count, href, search }) => (
        <Link
          key={label}
          to={href}
          search={search as never}
          className="pp-tile group flex flex-col gap-3 focus-visible:outline-none"
          style={{
            background: t.card,
            border: `1px solid ${t.line}`,
            borderRadius: 20,
            padding: 16,
            textDecoration: "none",
            color: t.ink,
            transition: "transform 120ms ease, box-shadow 120ms ease, background 120ms ease",
          }}
        >
          <span className="flex items-center justify-between gap-2">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center"
              style={{ background: t.accentSoft, borderRadius: 14, color: t.accent }}
            >
              <Icon size={19} strokeWidth={1.8} />
            </span>
            {count !== null && count !== undefined && count !== "" && (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[12px]"
                style={{ background: t.accentSoft, color: t.accent, fontWeight: 600 }}
              >
                {count}
              </span>
            )}
          </span>
          <span className="min-w-0 text-[14px]" style={{ fontWeight: 600 }}>
            {label}
          </span>
        </Link>
      ))}
    </nav>
  );
}

export default IconTileGrid;
