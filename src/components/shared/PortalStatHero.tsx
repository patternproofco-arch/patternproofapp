import type { ReactNode } from "react";
import { portalTheme, type PortalVariant } from "./portal-theme";

interface Props {
  variant: PortalVariant;
  /** Small uppercase line above the heading. */
  eyebrow?: string;
  /** Serif heading — the greeting. */
  heading: ReactNode;
  /** The one big number. */
  value: number | string;
  /** Short label under the number. No trends, no deltas. */
  label: string;
  /** Optional warm one-liner beside the number. */
  message?: ReactNode;
  /** Optional inline actions rendered under the message. */
  children?: ReactNode;
}

/** Gradient stat card shared by all three portal dashboards. */
export function PortalStatHero({ variant, eyebrow, heading, value, label, message, children }: Props) {
  const t = portalTheme(variant);
  return (
    <section
      style={{
        borderRadius: 18,
        padding: "clamp(20px,3vw,30px)",
        color: "#FFFFFF",
        background: `linear-gradient(135deg, ${t.gradientFrom} 0%, ${t.gradientTo} 100%)`,
        display: "grid",
        gap: 18,
      }}
    >
      <div>
        {eyebrow ? (
          <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.75 }}>
            {eyebrow}
          </div>
        ) : null}
        <h1
          style={{
            fontFamily: t.displayFont,
            fontSize: "clamp(24px,3.2vw,34px)",
            lineHeight: 1.15,
            margin: "8px 0 0",
            fontWeight: 500,
          }}
        >
          {heading}
        </h1>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 20 }}>
        <div
          style={{
            borderRadius: 14,
            padding: "14px 20px",
            background: "rgba(255,255,255,0.14)",
            minWidth: 132,
          }}
        >
          <div style={{ fontFamily: t.displayFont, fontSize: 40, lineHeight: 1, fontWeight: 500 }}>{value}</div>
          <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 8, opacity: 0.85 }}>
            {label}
          </div>
        </div>
        {message ? (
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, maxWidth: 420, opacity: 0.92 }}>{message}</p>
        ) : null}
      </div>

      {children ? <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>{children}</div> : null}
    </section>
  );
}
