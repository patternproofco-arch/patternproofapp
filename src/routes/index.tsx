import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { useEffect } from "react";
import type { ComponentType, ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { BrandMark } from "@/components/BrandMark";
import {
  Briefcase,
  FileText,
  Users,
  Lock,
  ShieldCheck,
  MessageSquare,
  Image as ImageIcon,
  Mic,
  Scale,
  MapPinOff,
  WifiOff,
} from "lucide-react";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { ref?: string } =>
    typeof search.ref === "string" ? { ref: search.ref } : {},
  head: () => ({
    meta: [
      { title: "PatternProof — Turn scattered evidence into structured patterns" },
      {
        name: "description",
        content:
          "Private documentation software that turns scattered evidence into court-ready patterns. Free for survivors. Free for DV organizations.",
      },
      { property: "og:title", content: "PatternProof — The truth is in the pattern." },
      {
        property: "og:description",
        content: "Pattern infrastructure for DV, custody, and coercive control documentation.",
      },
      { property: "og:url", content: "https://pattern-proof.tech/" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "PatternProof — The truth is in the pattern." },
      { name: "twitter:description", content: "Turn scattered evidence into structured patterns." },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "PatternProof",
          description:
            "Pattern infrastructure for survivors, attorneys, and DV organizations. Turn scattered incidents, evidence, and timelines into organized patterns.",
          brand: { "@type": "Brand", name: "PatternProof" },
          url: "https://pattern-proof.tech/",
          offers: [
            {
              "@type": "Offer",
              name: "Survivor — Free",
              price: "0",
              priceCurrency: "USD",
              url: "https://pattern-proof.tech/signin",
              availability: "https://schema.org/InStock",
            },
            {
              "@type": "Offer",
              name: "Attorney Solo",
              price: "297",
              priceCurrency: "USD",
              url: "https://pattern-proof.tech/for-attorneys",
              availability: "https://schema.org/InStock",
            },
            {
              "@type": "Offer",
              name: "DV Organization — Invite",
              price: "0",
              priceCurrency: "USD",
              url: "https://pattern-proof.tech/for-organizations",
              availability: "https://schema.org/LimitedAvailability",
            },
          ],
        }),
      },
    ],
  }),
  component: Index,
});

const INK = "#232A38";
const INK_2 = "#4C5568";
const INK_3 = "#6B7488";

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { ref } = Route.useSearch();
  const attorneyMode = ref?.toLowerCase() === "attorney";
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  // Render the real marketing page unconditionally — it's what every
  // logged-out visitor, crawler, and first paint should see. An already
  // signed-in visitor gets redirected to /dashboard by the effect above
  // once auth resolves client-side; a brief flash of this page for that
  // one case is a better tradeoff than blocking real content behind a
  // loading state that's always true during SSR and first paint.
  return (
    <div className="min-h-screen" style={{ background: "var(--pp-ground, #EFEDF0)", color: INK }}>
      <PublicQuickExit />

      {/* ───────────────────────── Hero ───────────────────────── */}
      <section
        style={{ maxWidth: 1040, margin: "0 auto", padding: "clamp(56px,9vw,104px) 24px 0" }}
      >
        <BrandLogo size={70} showTagline />

        <p
          style={{
            marginTop: 22,
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: INK_3,
            fontWeight: 600,
          }}
        >
          {attorneyMode
            ? "Source-linked · Chain of custody · Court-ready"
            : "Private · Secure · Court-ready"}
        </p>
        {!attorneyMode && (
          <p
            style={{
              marginTop: 6,
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              color: INK_3,
            }}
          >
            For survivors · For attorneys · For DV organizations
          </p>
        )}

        <h1
          style={{
            marginTop: 18,
            fontFamily: "var(--font-serif)",
            fontWeight: 300,
            fontSize: "clamp(2.2rem, 5.2vw, 3.6rem)",
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            color: INK,
            marginBottom: 0,
          }}
        >
          {attorneyMode ? (
            <>
              A shoebox of screenshots isn't a chronology.
              <br />
              <em>
                <span className="highlight-thread">A source-linked timeline is.</span>
              </em>
            </>
          ) : (
            <>
              The file is not the story.
              <br />
              <em>
                <span className="highlight-thread">The pattern is.</span>
              </em>
            </>
          )}
        </h1>

        {attorneyMode ? (
          <>
            <p
              style={{ marginTop: 20, fontSize: 17, lineHeight: 1.6, color: INK_2, maxWidth: 620 }}
            >
              For attorneys: a structured, source-linked chronology on day one — not a shoebox of
              screenshots. Hearing prep starts with strategy, not sorting.
            </p>
            <div style={{ marginTop: 34 }}>
              <Link to="/sample-case" className="btn-primary" style={{ textDecoration: "none" }}>
                See a sample case →
              </Link>
              <div style={{ marginTop: 18 }}>
                <Link
                  to="/"
                  search={{ ref: undefined }}
                  style={{
                    fontSize: 13,
                    color: INK_2,
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  Not an attorney? See all options
                </Link>
              </div>
            </div>
          </>
        ) : (
          <>
            <p
              style={{ marginTop: 20, fontSize: 17, lineHeight: 1.6, color: INK_2, maxWidth: 600 }}
            >
              Photos, messages, and voice notes stay encrypted and private — nothing is ever shared
              until you choose to share it. Free for survivors. Free for DV organizations. Built by
              someone who lived it.
            </p>
            <div
              style={{
                marginTop: 28,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 14,
              }}
            >
              <Link to="/signup" className="btn-primary" style={{ textDecoration: "none" }}>
                Start Documenting — Free
              </Link>
              <span style={{ fontSize: 12.5, color: INK_3 }}>
                No credit card · No obligation · 100% private
              </span>
            </div>
          </>
        )}
      </section>

      {!attorneyMode && (
        <>
          {/* ─────────────── Product preview + free-forever card ─────────────── */}
          <section
            style={{
              maxWidth: 1040,
              margin: "0 auto",
              padding: "44px 24px 0",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 20,
              alignItems: "start",
            }}
          >
            <DashboardPreview />

            <div className="card-pp" style={{ padding: 22 }}>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  color: "var(--pp-accent)",
                }}
              >
                Free forever · Survivor
              </p>
              <h3
                style={{
                  marginTop: 10,
                  fontFamily: "var(--font-serif)",
                  fontWeight: 400,
                  fontSize: 20,
                  color: INK,
                }}
              >
                Document your story, privately.
              </h3>
              <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, color: INK_2 }}>
                Photos, messages, voice notes — timestamped and encrypted. Share only when you
                choose.
              </p>
              <Link
                to="/signup"
                style={{
                  display: "inline-block",
                  marginTop: 16,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "var(--pp-accent)",
                  textDecoration: "underline",
                  textUnderlineOffset: 4,
                }}
              >
                Start Documenting →
              </Link>
            </div>
          </section>

          {/* ───────────────────────── Who it's for ───────────────────────── */}
          <Section
            eyebrow="Who it's for"
            title="Choose the path that fits you."
            style={{ marginTop: 56 }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 16,
                alignItems: "stretch",
              }}
            >
              <PathCard
                accent="#5B4EA6"
                icon={FileText}
                label="Survivor"
                body="Write down what happened, at your own pace — photos, messages, and dates kept private and shared only when you choose."
                to="/signup"
                cta="Start documenting →"
              />
              <PathCard
                accent="#0F2BB8"
                icon={Briefcase}
                label="Attorney"
                body="A source-linked chronology on day one, with chain of custody intact — prep starts with strategy, not sorting."
                to="/sample-case"
                cta="See a sample case →"
              />
              <PathCard
                accent="#4F6249"
                icon={Users}
                label="DV Organization"
                body="A free intake tool for your advocates — she documents once, referrals arrive clean, at no cost to your program."
                to="/for-organizations"
                cta="See how it fits your program →"
              />
            </div>
          </Section>

          {/* ───────────────────────── How it works ───────────────────────── */}
          <Section eyebrow="How it works" title="Three steps. One clear pattern.">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              <Step
                n={1}
                title="Write it down"
                body="Photos, texts, voice notes — whatever you have, whenever you have a moment. Nothing is required."
              />
              <Step
                n={2}
                title="It organizes itself"
                body="Every entry is timestamped and dated with its own confidence level — exact, approximate, or unknown. No pattern is invented for you."
              />
              <Step
                n={3}
                title="Share only what you choose"
                body="Nothing leaves your account until you decide — with an attorney, an advocate, or a court, on your terms."
              />
            </div>
          </Section>

          {/* ───────────────────────── Safety built in ───────────────────────── */}
          <Section eyebrow="Safety built in" title="Designed for the moment you need it most.">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              <SafetyPoint
                icon={Lock}
                title="Exit safely, anywhere"
                body="A visible exit control on every page — including this one — clears the screen instantly."
              />
              <SafetyPoint
                icon={WifiOff}
                title="No cloud sync by default"
                body="You choose whether your account syncs at all. Nothing leaves your device unless you turn it on."
              />
              <SafetyPoint
                icon={MapPinOff}
                title="Location data quarantined"
                body="Photos can carry GPS data without you knowing it. PatternProof holds it back until you decide it should be seen."
              />
              <SafetyPoint
                icon={ShieldCheck}
                title="Encrypted, always"
                body="Your documentation is encrypted in transit and at rest, on every plan, with no exceptions."
              />
            </div>
          </Section>

          {/* ───────────────────────── Testimonials ───────────────────────── */}
          <Section eyebrow="Trusted by advocates & attorneys" title="What they've told us.">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 16,
              }}
            >
              <Quote text="Having everything in one dated place changed what I could show up with." />
              <Quote text="I stopped dreading the moment I'd have to explain the timeline out loud." />
              <Quote text="My advocate could see enough to help, without me handing over everything." />
            </div>
            <p style={{ marginTop: 14, fontSize: 12, color: INK_3 }}>
              Quotes reflect beta user feedback. Names withheld for privacy.
            </p>
          </Section>

          {/* ───────────────────────── FAQ ───────────────────────── */}
          <Section eyebrow="Questions" title="What every survivor asks first.">
            <div style={{ display: "grid", gap: 10 }}>
              <Faq
                q="Can the other person see any of this?"
                a="No. Nothing is shared, synced, or visible to anyone else unless you explicitly choose to share it."
              />
              <Faq
                q="Is this admissible in court?"
                a="PatternProof organizes and preserves your documentation with timestamps and source metadata intact — an attorney determines admissibility for your specific case."
              />
              <Faq
                q="What if my phone or computer isn't safe?"
                a="Use Exit Safely any time, and consider signing up from a device the other person can't access. See /safety for device-specific guidance."
              />
              <Faq
                q="Is it really free?"
                a="Yes, for survivors, permanently — no credit card, no trial period, no upsell."
              />
            </div>
          </Section>
        </>
      )}

      <footer
        style={{
          maxWidth: 780,
          margin: "0 auto",
          padding: "64px 24px 96px",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          color: INK_2,
          lineHeight: 1.7,
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <BrandMark size={26} />
        </div>
        Every entry keeps its source, and you control what you share.{" "}
        <Link
          to="/privacy"
          style={{ color: INK, textDecoration: "underline", textUnderlineOffset: 3 }}
        >
          Learn more
        </Link>
        <div
          style={{
            marginTop: 18,
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "baseline",
          }}
        >
          <Link
            to="/privacy"
            style={{ color: INK, textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            Privacy
          </Link>
          <Link
            to="/safety"
            style={{ color: INK, textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            Safety
          </Link>
          <Link
            to="/support"
            style={{ color: INK, textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            Support
          </Link>
          <Link
            to="/how-it-works"
            style={{ color: INK, textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            How it works
          </Link>
          <Link
            to="/resources"
            style={{ color: INK, textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            Resources
          </Link>
          <Link
            to="/terms"
            style={{ color: INK, textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            Terms
          </Link>
          <Link
            to="/for-attorneys"
            style={{ color: INK, textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            For attorneys
          </Link>
          <Link
            to="/for-organizations"
            style={{ color: INK, textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            For organizations
          </Link>
          <Link
            to="/pricing"
            style={{ color: INK, textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            Pricing
          </Link>
        </div>
        <p style={{ marginTop: 24, fontSize: 11.5, color: INK_3 }}>
          © 2026 G Burns Company LLC. PatternProof™ is a trademark of G Burns Company LLC.
        </p>
      </footer>
    </div>
  );
}

/* ───────────────────────── shared section chrome ───────────────────────── */

function Section({
  eyebrow,
  title,
  children,
  style,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section
      style={{ maxWidth: 1040, margin: "0 auto", padding: "0 24px", marginTop: 64, ...style }}
    >
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: "var(--pp-accent)",
          marginBottom: 8,
        }}
      >
        {eyebrow}
      </p>
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 400,
          fontSize: "clamp(1.5rem, 3vw, 2rem)",
          color: INK,
          marginBottom: 22,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="card-pp" style={{ padding: 20 }}>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          boxShadow: "var(--pp-shadow-in-sm)",
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          fontSize: 13,
          color: "var(--pp-accent)",
          marginBottom: 12,
        }}
      >
        {n}
      </div>
      <h4
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: 16,
          color: INK,
          margin: 0,
        }}
      >
        {title}
      </h4>
      <p style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.55, color: INK_2 }}>{body}</p>
    </div>
  );
}

function SafetyPoint({
  icon: Icon,
  title,
  body,
}: {
  icon: ComponentType<{ size?: number }>;
  title: string;
  body: string;
}) {
  return (
    <div className="card-pp" style={{ padding: 20 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          display: "grid",
          placeItems: "center",
          boxShadow: "var(--pp-shadow-in-sm)",
          color: "var(--pp-accent)",
          marginBottom: 12,
        }}
      >
        <Icon size={16} />
      </div>
      <h4
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: 15,
          color: INK,
          margin: 0,
        }}
      >
        {title}
      </h4>
      <p style={{ marginTop: 6, fontSize: 13, lineHeight: 1.55, color: INK_2 }}>{body}</p>
    </div>
  );
}

function Quote({ text }: { text: string }) {
  return (
    <div className="card-pp" style={{ padding: 18 }}>
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontSize: 15,
          lineHeight: 1.55,
          color: INK,
        }}
      >
        “{text}”
      </p>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="card-pp" style={{ padding: "14px 18px" }}>
      <summary
        style={{ cursor: "pointer", fontWeight: 600, fontSize: 14, color: INK, listStyle: "none" }}
      >
        {q}
      </summary>
      <p style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.6, color: INK_2 }}>{a}</p>
    </details>
  );
}

/** Static, illustrative preview of the survivor dashboard — never a live feed. */
function DashboardPreview() {
  return (
    <div className="card-pp" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: 17, color: INK, margin: 0 }}>
            Hello, Grace
          </p>
          <p style={{ fontSize: 12, color: INK_3, marginTop: 2 }}>64% documented</p>
        </div>
        <div
          style={{ width: 34, height: 34, borderRadius: 999, boxShadow: "var(--pp-shadow-in-sm)" }}
          aria-hidden="true"
        />
      </div>

      <div
        style={{
          marginTop: 6,
          height: 6,
          borderRadius: 999,
          boxShadow: "var(--pp-shadow-in-sm)",
          overflow: "hidden",
        }}
      >
        <div
          style={{ width: "64%", height: "100%", background: "var(--pp-accent)", opacity: 0.85 }}
        />
      </div>

      <div
        style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}
      >
        {[
          { icon: FileText, label: "Document" },
          { icon: Scale, label: "Patterns" },
          { icon: ShieldCheck, label: "Court-Ready" },
          { icon: Lock, label: "Safety" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div
              style={{
                width: 40,
                height: 40,
                margin: "0 auto",
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                boxShadow: "var(--pp-shadow-sm)",
                color: "var(--pp-accent)",
              }}
            >
              <Icon size={16} />
            </div>
            <p style={{ fontSize: 9.5, color: INK_3, marginTop: 5 }}>{label}</p>
          </div>
        ))}
      </div>

      <p
        style={{
          marginTop: 18,
          fontFamily: "var(--font-mono)",
          fontSize: 9.5,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: INK_3,
          fontWeight: 700,
        }}
      >
        Recent Marks
      </p>
      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
        {[
          { icon: MessageSquare, label: "Text messages", date: "Oct 3" },
          { icon: Mic, label: "Voice note", date: "Oct 7" },
          { icon: ImageIcon, label: "Photos uploaded", date: "Oct 12" },
        ].map((row) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 12,
              boxShadow: "var(--pp-shadow-in-sm)",
            }}
          >
            <row.icon size={13} color={INK_3} />
            <span style={{ fontSize: 12.5, color: INK_2, flex: 1 }}>{row.label}</span>
            <span style={{ fontSize: 11, color: INK_3 }}>{row.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PathCard({
  accent,
  icon: Icon,
  label,
  body,
  to,
  cta,
}: {
  accent: string;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  body: string;
  to: string;
  cta: string;
}) {
  return (
    <Link
      to={to}
      style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        textDecoration: "none",
        color: INK,
        borderRadius: 18,
        overflow: "hidden",
        background: "var(--pp-ground, #EFEDF0)",
        boxShadow: "var(--pp-shadow-sm)",
      }}
    >
      <div
        style={{
          position: "relative",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: accent,
        }}
      >
        <span aria-hidden="true">
          <Icon color="#FFFFFF" size={22} strokeWidth={1.6} />
        </span>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "14px 15px",
          boxShadow: `inset 3px 0 0 ${accent}`,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: accent,
            }}
          >
            {label}
          </div>
          <p
            style={{
              margin: "7px 0 11px",
              fontFamily: "var(--font-serif)",
              fontWeight: 400,
              fontSize: 13.5,
              lineHeight: 1.4,
              color: INK,
            }}
          >
            {body}
          </p>
        </div>
        <span
          style={{
            display: "inline-block",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            textDecoration: "underline",
            textUnderlineOffset: 4,
          }}
        >
          {cta}
        </span>
      </div>
    </Link>
  );
}
