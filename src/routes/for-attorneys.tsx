import { createFileRoute, Link } from "@tanstack/react-router";
import { ThreadGroup } from "@/components/ThreadConnector";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { useEffect, useState } from "react";
import { buildTiers } from "@/lib/pricing-tiers";
import { getCharterAvailability } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

const INK = "var(--pp-ink)";
const NAVY = "var(--pp-accent-attorney)";
const MUTED = "var(--pp-muted)";
const SERIF = "var(--font-serif)";
const SANS = "var(--font-sans)";
const MONO = "var(--font-mono)";

export const Route = createFileRoute("/for-attorneys")({
  head: () => ({
    meta: [
      { title: "Family Law Evidence Intake Software for Attorneys | PatternProof" },
      {
        name: "description",
        content:
          "PatternProof helps family-law and domestic-violence attorneys review client-provided evidence in a dated, source-linked chronology instead of sorting screenshots, messages, and files by hand.",
      },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/for-attorneys" }],
  }),
  component: ForAttorneys,
});

function ForAttorneys() {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    let env: ReturnType<typeof getStripeEnvironment>;
    try {
      env = getStripeEnvironment();
    } catch {
      return;
    }
    getCharterAvailability({ data: { environment: env } })
      .then((r) => setRemaining(r.remaining))
      .catch(() => setRemaining(null));
  }, []);
  const attorneyTiers = buildTiers(remaining).filter((t) => t.key.startsWith("attorney_"));
  const solo = attorneyTiers.find((t) => t.key === "attorney_solo");
  const startsAt = `Plans start at ${solo?.price ?? "$297"} / month for a solo attorney seat`;
  return (
    <div data-persona="attorney" style={{ background: "var(--pp-ground)", color: INK, minHeight: "100vh", fontFamily: SANS }}>
      <PublicQuickExit />
      <TopBar />
      <section style={{ maxWidth: 780, margin: "0 auto", padding: "clamp(56px,9vw,104px) 24px 40px" }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED, marginBottom: 24 }}>For attorneys</div>
        <p style={{ fontSize: 16, lineHeight: 1.5, color: "var(--pp-muted)", maxWidth: 560, marginBottom: 18 }}>
          PatternProof is a documentation platform your clients use to record domestic-violence and coercive-control incidents — you receive a structured, source-linked chronology instead of a folder of screenshots.
        </p>
        <h1 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "clamp(2.2rem,5.2vw,3.8rem)", lineHeight: 1.05, letterSpacing: "-0.02em", margin: 0 }}>
          Review an organized case timeline,<br /><em>without rebuilding it yourself.</em>
        </h1>
        <Link to="/demo" style={{ display: "inline-block", marginTop: 34, background: NAVY, color: "#F4F6FB", padding: "14px 26px", fontFamily: MONO, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", borderRadius: "var(--pp-r-pill)" }}>View the Attorney Demo →</Link>
        <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 11, color: MUTED }}>{startsAt}</div>
      </section>
      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "0 24px 96px" }}>
        <Link to="/lawyer-signup" style={{ display: "inline-block", background: NAVY, color: "#F4F6FB", padding: "14px 26px", fontFamily: MONO, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", borderRadius: "var(--pp-r-pill)" }}>Create an attorney account →</Link>
        <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 11, color: MUTED, maxWidth: 640, lineHeight: 1.6 }}>
          Create an attorney account to review shared cases. A paid seat unlocks notes and caseload — opening one client share does not require a subscription.
        </div>
      </section>
    </div>
  );
}

function TopBar() {
  return (
    <header style={{ boxShadow: "inset 0 -1px 0 var(--pp-shadow-dark)" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "18px 24px", display: "flex", justifyContent: "space-between" }}>
        <Link to="/" style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.14em", color: INK, textDecoration: "none", textTransform: "uppercase" }}>← PatternProof</Link>
        <Link to="/lawyer-signup" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", color: INK, textDecoration: "underline", textTransform: "uppercase" }}>Create account</Link>
      </div>
    </header>
  );
}
