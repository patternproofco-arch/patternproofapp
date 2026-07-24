import { createFileRoute, Link } from "@tanstack/react-router";

/**
 * DV organization landing — redaction/exhibit vernacular, sage accent only.
 * Framed as a referral partnership, not a paid product. Before/after
 * shows what advocate intake looks like without and with PatternProof.
 */

const INK = "#14131F";
const PAPER = "#F7F5F0";
const SAGE = "#2E4A38";
const MUTED = "#6B6A78";
const RULE = "rgba(20,19,31,0.14)";

const SERIF = "'Newsreader', Georgia, serif";
const SANS = "'IBM Plex Sans', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

export const Route = createFileRoute("/for-organizations")({
  head: () => ({
    meta: [
      { title: "For DV organizations — PatternProof" },
      { name: "description", content: "A free, private documentation tool you can hand every survivor at intake. No cost to your org, no data-sharing with PatternProof — just a cleaner referral to counsel." },
      { property: "og:title", content: "PatternProof — Partner referrals for DV organizations" },
      { property: "og:description", content: "Free survivor tool your advocates can hand out at intake. Cleaner referrals, no cost, no data-sharing." },
      { property: "og:url", content: "https://pattern-proof.tech/for-organizations" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "PatternProof for DV organizations" },
      { name: "twitter:description", content: "Free survivor tool your advocates can hand out at intake." },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/for-organizations" }],
  }),
  component: ForOrganizations,
});

function ForOrganizations() {
  return (
    <div style={{ background: PAPER, color: INK, minHeight: "100vh", fontFamily: SANS }}>
      <TopBar />

      <section style={{ maxWidth: 780, margin: "0 auto", padding: "clamp(56px,9vw,104px) 24px 40px" }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED, marginBottom: 24 }}>
          Referral partners · DV organizations
        </div>
        <h1 style={{ fontFamily: SERIF, fontWeight: 300, fontSize: "clamp(2.2rem,5.2vw,3.8rem)", lineHeight: 1.05, letterSpacing: "-0.02em", margin: 0 }}>
          Hand every survivor a place
          <br />
          <em>to write it down.</em>
        </h1>
        <p style={{ marginTop: 24, fontSize: 18, lineHeight: 1.6, color: "#3A3849", maxWidth: 640 }}>
          PatternProof is free for survivors. You can hand it out at intake, at
          a safety-plan appointment, or at a courtroom accompaniment — no cost
          to your org, no data flowing back to us, no license to manage.
        </p>
        <Link
          to="/request-org-access"
          style={{
            display: "inline-block", marginTop: 34, background: SAGE, color: "#F1F6F2",
            padding: "14px 26px", fontFamily: MONO, fontSize: 13, letterSpacing: "0.1em",
            textTransform: "uppercase", textDecoration: "none", borderRadius: 0,
          }}
        >
          Partner with us →
        </Link>
        <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: "0.06em" }}>
          No contract. No cost. Referral link for attribution only.
        </div>
      </section>

      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 24px 80px" }}>
        <SectionRule label="What intake feels like" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
          <ExhibitCard
            tag="BEFORE · WITHOUT A TOOL TO HAND OUT"
            tagTone="muted"
            body={
              <div style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.6, color: MUTED }}>
                Advocate takes hand-written notes on legal pads. Survivor tries to
                remember dates on the spot. Follow-up is a scan of the notes,
                emailed if she has a safe address. By the time a referral to
                counsel happens, most of the specifics are already gone.
              </div>
            }
          />
          <ExhibitCard
            tag="AFTER · WITH PATTERNPROOF ON HER PHONE"
            tagTone="accent"
            accent={SAGE}
            body={
              <div>
                <div style={{ display: "grid", gap: 10 }}>
                  <PartnerRow n="01" label="At intake" body="Advocate walks her through the first 3 entries in her own account. Nothing shared. Nothing stored on org systems." />
                  <PartnerRow n="02" label="Between visits" body="She adds entries at her own pace. Approximate dates and unknown dates are first-class — she doesn't have to remember exactly." />
                  <PartnerRow n="03" label="At referral" body="When she's ready to talk to counsel, she shares her structured chronology. The attorney starts on strategy, not sorting screenshots." />
                </div>
                <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Your org never touches her records. She controls every share.
                </div>
              </div>
            }
          />
        </div>
      </section>

      <section style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px 80px" }}>
        <SectionRule label="How the partnership works" />
        <Relief n="01" title="Free forever for survivors." body="No trial, no upsell, no card. Survivor accounts stay free — that's the whole point." />
        <Relief n="02" title="No data-sharing with your org." body="Advocates can't see her records. PatternProof can't see them either. She holds the key to every share." />
        <Relief n="03" title="A referral code, if you want attribution." body="Optional short code (e.g. ?ref=YOURORG). We use it only so we can tell you how many survivors your team routed our way. Nothing personal." />
        <Relief n="04" title="Aligned with funder priorities." body="Supports OVC/DOJ-funded outcomes: better documentation, cleaner referrals to legal aid, less re-traumatization at intake." />
      </section>

      <section style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px 96px" }}>
        <SectionRule label="Talk to us" />
        <p style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 22, lineHeight: 1.5, color: INK, margin: 0 }}>
          If your organization refers survivors to family-law counsel — or
          wishes it could get them to counsel with more of the story intact —
          we'd like to hear from you. Setup is a short conversation and a
          referral link.
        </p>
        <div style={{ marginTop: 24 }}>
          <Link
            to="/request-org-access"
            style={{
              display: "inline-block", background: SAGE, color: "#F1F6F2",
              padding: "14px 26px", fontFamily: MONO, fontSize: 13, letterSpacing: "0.1em",
              textTransform: "uppercase", textDecoration: "none", borderRadius: 0,
            }}
          >
            Partner with us →
          </Link>
        </div>
      </section>

      <Foot />
    </div>
  );
}

function TopBar() {
  return (
    <header style={{ borderBottom: `1px solid ${RULE}` }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link to="/" style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.14em", color: INK, textDecoration: "none", textTransform: "uppercase" }}>
          ← PatternProof
        </Link>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", color: MUTED, textTransform: "uppercase" }}>DV organizations</div>
      </div>
    </header>
  );
}

function Foot() {
  return (
    <footer style={{ borderTop: `1px solid ${RULE}`, padding: "24px", fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: "0.06em", textAlign: "center" }}>
      PATTERNPROOF · <Link to="/privacy" style={{ color: INK }}>PRIVACY</Link> · <Link to="/safety" style={{ color: INK }}>SAFETY</Link> · <Link to="/terms" style={{ color: INK }}>TERMS</Link>
    </footer>
  );
}

function SectionRule({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "32px 0 24px" }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", color: MUTED, textTransform: "uppercase" }}>{label}</div>
      <div style={{ flex: 1, height: 1, background: RULE }} />
    </div>
  );
}

function ExhibitCard({
  tag, tagTone, accent, body,
}: { tag: string; tagTone: "muted" | "accent"; accent?: string; body: React.ReactNode }) {
  const border = tagTone === "accent" && accent ? accent : "rgba(20,19,31,0.20)";
  return (
    <div
      style={{
        position: "relative",
        background: PAPER,
        border: `1px solid ${border}`,
        borderLeft: `3px solid ${tagTone === "accent" && accent ? accent : "rgba(20,19,31,0.35)"}`,
        padding: "22px 24px",
        clipPath: "polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 0 100%)",
      }}
    >
      <div
        style={{
          display: "inline-block",
          fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase",
          color: tagTone === "accent" && accent ? accent : MUTED,
          border: `1px solid ${tagTone === "accent" && accent ? accent : "rgba(20,19,31,0.25)"}`,
          padding: "3px 8px", marginBottom: 14,
        }}
      >
        {tag}
      </div>
      {body}
    </div>
  );
}

function PartnerRow({ n, label, body }: { n: string; label: string; body: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 14, padding: "10px 0", borderBottom: `1px dashed ${RULE}` }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.14em", color: MUTED }}>
        STEP<br /><span style={{ color: INK, fontSize: 12 }}>{n}</span>
      </div>
      <div>
        <div style={{ fontFamily: MONO, fontSize: 12, color: INK, letterSpacing: "0.03em" }}>{label}</div>
        <div style={{ marginTop: 4, fontFamily: SERIF, fontSize: 15, lineHeight: 1.5, color: INK }}>{body}</div>
      </div>
    </div>
  );
}

function Relief({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 20, padding: "20px 0", borderBottom: `1px solid ${RULE}` }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", color: MUTED }}>{n}</div>
      <div>
        <div style={{ fontFamily: SERIF, fontSize: 22, lineHeight: 1.25, color: INK }}>{title}</div>
        <p style={{ marginTop: 6, fontSize: 15, lineHeight: 1.6, color: "#3A3849" }}>{body}</p>
      </div>
    </div>
  );
}
