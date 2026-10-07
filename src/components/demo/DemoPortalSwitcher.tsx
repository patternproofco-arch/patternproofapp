import { Link } from "@tanstack/react-router";
import { DEMO_PORTALS, type DemoPortalId } from "@/lib/demo/portals";

/** Switch between the fictional demo portals. Every link stays under /demo/*. */
export function DemoPortalSwitcher({ current }: { current: DemoPortalId }) {
  return (
    <nav
      aria-label="Demo portals"
      data-testid="demo-portal-switcher"
      style={{ maxWidth: 1080, margin: "16px auto 0", padding: "0 20px" }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          background: "var(--pp-card)",
          padding: 6,
          borderRadius: 18,
          boxShadow: "var(--pp-shadow-sm)",
        }}
      >
        {DEMO_PORTALS.map((p) => {
          const active = p.id === current;
          return (
            <Link
              key={p.id}
              to={p.to}
              aria-current={active ? "page" : undefined}
              data-portal={p.id}
              style={{
                display: "inline-flex",
                flexDirection: "column",
                padding: "8px 14px",
                borderRadius: 14,
                textDecoration: "none",
                background: active ? "var(--pp-accent)" : "transparent",
                color: active ? "var(--pp-accent-fg)" : "var(--pp-ink)",
                minWidth: 120,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700 }}>{p.label}</span>
              <span style={{ fontSize: 11, opacity: 0.8 }}>{p.blurb}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
