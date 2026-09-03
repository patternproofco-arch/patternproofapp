import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { useEffect } from "react";
import type { ComponentType, ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { ThreadConnector, ThreadGroup } from "@/components/ThreadConnector";
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
      { title: "PatternProof — Organize evidence into one clear timeline" },
      {
        name: "description",
        content:
          "Organize photos, messages, voice notes, and written entries into one private, source-linked timeline you control.",
      },
      { property: "og:title", content: "PatternProof — The truth is in the pattern." },
      {
        property: "og:description",
        content: "Pattern infrastructure for DV, custody, and coercive control documentation.",
      },
      { property: "og:url", content: "https://pattern-proof.tech/" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://pattern-proof.tech/og-home.png" },
      { name: "twitter:title", content: "PatternProof — The truth is in the pattern." },
      { name: "twitter:description", content: "Turn scattered evidence into structured patterns." },
      { name: "twitter:image", content: "https://pattern-proof.tech/og-home.png" },
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
              name: "DV Organization — Partner",
              price: "0",
              priceCurrency: "USD",
              url: "https://pattern-proof.tech/for-organizations",
              availability: "https://schema.org/InStock",
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
        className="landing-hero"
        style={{
          maxWidth: 920,
          margin: "0 auto",
          padding: "clamp(48px,8vw,88px) 24px 0",
          textAlign: "center",
        }}
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
            ? "Source-linked · Chain of custody · Export-ready"
            : "Private · Secure · Export-ready"}
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
            fontSize: attorneyMode ? "clamp(2.2rem, 5.2vw, 3.6rem)" : "clamp(1.9rem, 4.3vw, 3rem)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: INK,
            marginBottom: 0,
            maxWidth: 900,
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
              One private timeline.
              <br />
              <em>
                <span className="highlight-thread">Everything in the right order.</span>
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
              <Link to="/demo" className="btn-primary" style={{ textDecoration: "none" }}>
                Try the demo →
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
              style={{
                marginTop: 16,
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                fontSize: "clamp(1.05rem, 2.1vw, 1.35rem)",
                lineHeight: 1.35,
                color: INK_2,
                maxWidth: 620,
              }}
            >
              Document what happened. See the full pattern.
            </p>
            <p
              style={{
                marginTop: 14,
                fontFamily: "var(--font-sans)",
                fontSize: 17,
                fontWeight: 500,
                lineHeight: 1.5,
                color: INK,
                maxWidth: 650,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              PatternProof organizes your photos, messages, voice notes, and written entries into
              one clear, source-linked timeline.
            </p>

            <p
              style={{
                margin: "14px auto 0",
                fontSize: 17,
                lineHeight: 1.6,
                color: INK_2,
                maxWidth: 620,
              }}
            >
              You decide what to add, what to share, and who can see it. Survivor accounts are free,
              with no trial or credit card.
            </p>
            <div
              style={{
                marginTop: 28,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
              }}
            >
              <Link to="/signup" className="btn-primary" style={{ textDecoration: "none" }}>
                Create My Free Account
              </Link>
              <Link to="/demo" className="btn-ghost" style={{ textDecoration: "none" }}>
                Try the demo →
              </Link>
            </div>
            <p style={{ marginTop: 12, fontSize: 12.5, color: INK_3 }}>
              Free for survivors · Private by default · You control sharing
            </p>
          </>
        )}
      </section>

      {!attorneyMode && (
        <>
          <section
            style={{
              maxWidth: 1040,
              margin: "0 auto",
              padding: "44px 24px 0",
            }}
          >
            <DashboardPreview />
          </section>

          {/* ───────────────────────── Who it's for ───────────────────────── */}
          <Section
            eyebrow="Choose your portal"
            title="PatternProof meets you where you are."
            style={{ marginTop: 48, textAlign: "center" }}
          >
            <ThreadGroup
              persona="shared"
              className="portal-path-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 22,
                alignItems: "stretch",
              }}
            >
              <PathCard
                accent="var(--pp-accent-survivor)"
                accentBg="var(--pp-accent-survivor-gradient)"
                tint="rgba(201, 183, 239, 0.16)"
                iconColor={INK}
                icon={FileText}
                label="Survivor"
                body="Create a private, organized timeline from photos, messages, voice notes, and written entries."
                to="/signup"
                cta="Start documenting →"
              />
              <PathCard
                accent="var(--pp-accent-attorney)"
                tint="rgba(22, 35, 92, 0.07)"
                icon={Briefcase}
                label="Attorney"
                body="Review a dated, source-linked chronology instead of sorting screenshots and files by hand."
                to="/for-attorneys"
                cta="Learn more →"
              />
              <PathCard
                accent="var(--pp-accent-org)"
                tint="rgba(188, 214, 190, 0.22)"
                icon={Users}
                iconColor={INK}
                label="DV Organization"
                body="Let survivors document once and share an organized record with approved staff when they choose."
                to="/for-organizations"
                cta="See how it fits your program →"
              />
            </ThreadGroup>
          </Section>

          {/* ───────────────────────── How it works ───────────────────────── */}
          <HowItWorks />

          {/* ───────────────────────── Safety built in ───────────────────────── */}
          <Section eyebrow="Safety built in" title="Designed for the moment you need it most.">
            <ThreadGroup
              persona="shared"
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
                title="Works through a dropped connection"
                body="If you lose signal mid-upload, files wait safely on your device and finish the moment you're back online — nothing is lost."
              />
              <SafetyPoint
                icon={MapPinOff}
                title="Location data quarantined"
                body="Photos can carry GPS data without you knowing it. PatternProof holds it back until you decide it should be seen."
              />
              <SafetyPoint
                icon={ShieldCheck}
                title="Protected, in transit"
                body="Your documentation is encrypted in transit and protected by per-user access controls, on every plan. At-rest encryption is a property of our infrastructure host that we have not independently audited."
              />
            </ThreadGroup>
          </Section>

          <section className="landing-close card-pp">
            <BrandMark size={42} />
            <div>
              <h2>The file is not the story. The pattern is.</h2>
              <p>Keep the original; add the context; let the pattern emerge.</p>
            </div>
            <Link to="/signup" className="btn-primary" style={{ textDecoration: "none" }}>
              Create My Free Account
            </Link>
          </section>
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

function HowItWorks() {
  const steps = [
    {
      n: 1,
      title: "Write it down",
      body: "Photos, texts, voice notes — whatever you have, whenever you have a moment. Nothing is required.",
    },
    {
      n: 2,
      title: "It organizes itself",
      body: "Every entry is timestamped and dated with its own confidence level — exact, approximate, or unknown. No pattern is invented for you.",
    },
    {
      n: 3,
      title: "Share only what you choose",
      body: "Nothing leaves your account until you decide — with an attorney, an advocate, or a court, on your terms.",
    },
  ];

  return (
    <section style={{ maxWidth: 1040, margin: "0 auto", padding: "0 24px", marginTop: 64 }}>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: "var(--pp-accent-shared)",
          marginBottom: 8,
        }}
      >
        How it works
      </p>
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 400,
          fontSize: "clamp(1.5rem, 3vw, 2rem)",
          color: INK,
          marginBottom: 28,
        }}
      >
        Three steps. One clear pattern.
      </h2>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          return (
            <div
              key={s.n}
              style={{
                display: "grid",
                gridTemplateColumns: "56px 1fr",
                columnGap: 20,
                alignItems: "stretch",
                paddingBottom: last ? 0 : 14,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    flexShrink: 0,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    background: "var(--pp-ground)",
                    boxShadow: "var(--pp-shadow-up)",
                    fontFamily: "var(--font-serif)",
                    fontWeight: 500,
                    fontSize: 20,
                    color: "var(--pp-accent-shared)",
                  }}
                >
                  {s.n}
                </div>
                {!last && <ThreadConnector persona="shared" />}
              </div>

              <div className="card-pp" style={{ padding: "18px 24px", alignSelf: "start" }}>
                <h3
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontWeight: 500,
                    fontSize: 18,
                    color: INK,
                    margin: 0,
                  }}
                >
                  {s.title}
                </h3>
                <p style={{ marginTop: 8, fontSize: 15, lineHeight: 1.6, color: INK_2 }}>
                  {s.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
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
          { icon: ShieldCheck, label: "Review" },
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
  accentBg,
  tint,
  iconColor = "#FFFFFF",
  icon: Icon,
  label,
  body,
  to,
  cta,
}: {
  accent: string;
  /** Background for the icon strip only — defaults to `accent`. Lets the
   * survivor card carry its real logo gradient as a surface fill while
   * `accent` stays a solid, legible color for text and the inset border. */
  accentBg?: string;
  tint: string;
  /** Icon color against accentBg — defaults to white. The survivor
   * gradient is light pastel at both ends, so white would be illegible. */
  iconColor?: string;
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
        background: `linear-gradient(${tint}, ${tint}), var(--pp-ground, #EFEDF0)`,
        boxShadow: "var(--pp-shadow-sm)",
      }}
    >
      <div
        style={{
          position: "relative",
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: accentBg ?? accent,
        }}
      >
        <span aria-hidden="true">
          <Icon color={iconColor} size={19} strokeWidth={1.6} />
        </span>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "20px 18px 18px",
          boxShadow: `inset 3px 0 0 ${accent}`,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: accent,
            }}
          >
            {label}
          </div>
          <p
            style={{
              margin: "6px 0 9px",
              fontFamily: "var(--font-serif)",
              fontWeight: 400,
              fontSize: 15,
              lineHeight: 1.38,
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
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          {cta}
        </span>
      </div>
    </Link>
  );
}
