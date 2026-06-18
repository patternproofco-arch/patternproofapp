import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { Logo } from "@/components/Logo";
import { OrgCapacityCalculator } from "./OrgCapacityCalculator";

const PAINS = [
  "Faster intake — documentation arrives organized.",
  "Advocates see what's escalating, not just what happened.",
  "Cleaner referrals to legal aid and attorneys.",
];

export function OrgSection() {
  return (
    <section
      id="organizations"
      style={{
        padding: "96px 24px",
        background: "linear-gradient(180deg, #F2F4F8 0%, #E8EEF5 100%)",
      }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Logo variant="org" size={36} />
          <span style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted-foreground)", fontWeight: 700 }}>
            For DV organizations
          </span>
        </div>
        <h2 style={{ fontSize: "clamp(2rem, 4.2vw, 3rem)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 20, lineHeight: 1.1 }}>
          Advocates shouldn't rebuild every story.
        </h2>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: "var(--muted-foreground)", maxWidth: 560, marginBottom: 32 }}>
          Survivors document before intake. Advocates see the pattern faster.
        </p>

        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12, marginBottom: 36, maxWidth: 760 }}>
          {PAINS.map((p) => (
            <li key={p} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 16, color: "#14171F" }}>
              <Check size={18} style={{ color: "#3D72B8", marginTop: 3, flexShrink: 0 }} />
              <span>{p}</span>
            </li>
          ))}
        </ul>

        <Link
          to="/request-org-access"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 24px",
            borderRadius: 999,
            background: "#3D72B8",
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: 15,
            textDecoration: "none",
            marginBottom: 48,
          }}
        >
          Build advocate-ready intake <ArrowRight size={16} />
        </Link>

        <blockquote
          style={{
            borderLeft: "3px solid #3D72B8",
            paddingLeft: 20,
            margin: "0 0 48px",
            fontSize: 18,
            lineHeight: 1.6,
            color: "#14171F",
            fontStyle: "italic",
            maxWidth: 600,
          }}
        >
          Capacity is care.
        </blockquote>

        <OrgCapacityCalculator />

        <div
          style={{
            marginTop: 40,
            padding: 28,
            background: "#FFFFFF",
            borderRadius: 20,
            border: "1px solid var(--border)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted-foreground)", fontWeight: 700, marginBottom: 10 }}>
            Invite-only
          </div>
          <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>
            Org access is invite-only.
          </h3>
          <Link
            to="/request-org-access"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 22px",
              borderRadius: 999,
              background: "#14171F",
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Request org access <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}