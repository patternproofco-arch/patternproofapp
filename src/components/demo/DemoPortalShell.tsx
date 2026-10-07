import type { CSSProperties, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Info } from "lucide-react";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { DemoPortalSwitcher } from "@/components/demo/DemoPortalSwitcher";
import { DEMO_LABEL, type DemoPortalId } from "@/lib/demo/portals";

/**
 * Shared frame for the fictional sub-portals (/demo/attorney, /demo/org, /demo/prep):
 * Quick Exit, portal switcher, and the "DEMO · Fictional · Read-only" banner.
 */
export function DemoPortalShell({
  portal,
  eyebrow,
  title,
  intro,
  persona,
  children,
}: {
  portal: DemoPortalId;
  eyebrow: string;
  title: string;
  intro: string;
  persona?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-persona={persona ?? portal}
      data-demo-portal={portal}
      style={{
        minHeight: "100vh",
        background: "var(--pp-ground)",
        color: "var(--pp-ink)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <PublicQuickExit />
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 20px 8px" }}>
        <Link
          to="/demo"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--pp-accent)",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={14} /> All demo portals
        </Link>
        <div
          style={{
            marginTop: 18,
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--pp-accent)",
            fontWeight: 700,
          }}
        >
          {eyebrow}
        </div>
        <h1
          style={{
            fontSize: "clamp(1.6rem, 3.2vw, 2.2rem)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            margin: "8px 0 0",
          }}
        >
          {title}
        </h1>
        <p style={{ marginTop: 8, fontSize: 14, color: "var(--pp-muted)", maxWidth: 680 }}>
          {intro}
        </p>
      </div>
      <DemoPortalSwitcher current={portal} />
      <DemoReadOnlyBanner />
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 20px 80px" }}>{children}</div>
      <nav
        aria-label="Demo feedback"
        style={{
          maxWidth: 1080,
          margin: "0 auto 40px",
          padding: "0 20px",
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          fontSize: 13,
        }}
      >
        <Link to="/founding-testers" search={{ mode: "feedback" }}>
          Tell us what needs work
        </Link>
        <Link to="/founding-testers">Join the founding test cohort</Link>
      </nav>
    </div>
  );
}

export function DemoReadOnlyBanner() {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        maxWidth: 1080,
        margin: "16px auto 0",
        padding: "0 20px",
        paddingRight: "max(20px, 132px)",
        background: "var(--pp-ground)",
      }}
    >
      <div
        role="status"
        data-testid="demo-readonly-banner"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          background: "var(--pp-ground)",
          boxShadow: "var(--pp-shadow-in-sm)",
          borderRadius: 18,
          padding: "10px 14px",
          fontSize: 13,
          color: "var(--pp-warning)",
        }}
      >
        <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong>{DEMO_LABEL}.</strong> Every person, organization, email, and phone number here is
          invented. Save, export, share, and upload are turned off. Nothing is saved.
        </div>
      </div>
    </div>
  );
}

export function DemoCard({
  children,
  style,
  title,
}: {
  children: ReactNode;
  style?: CSSProperties;
  title?: string;
}) {
  return (
    <section
      style={{
        background: "var(--pp-card)",
        borderRadius: 18,
        padding: 20,
        boxShadow: "var(--pp-shadow-sm)",
        ...style,
      }}
    >
      {title ? (
        <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>{title}</h2>
      ) : null}
      {children}
    </section>
  );
}

export const demoButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  borderRadius: 14,
  border: "none",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  background: "var(--pp-card)",
  boxShadow: "var(--pp-shadow-xs)",
  color: "var(--pp-ink)",
};
