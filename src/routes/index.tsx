import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { useEffect } from "react";
import type { ComponentType } from "react";
import { useAuth } from "@/lib/auth-context";
import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { BrandMark } from "@/components/BrandMark";
import { Briefcase, FileText, Users, ShieldCheck, Eye, Lock, Download, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { ref?: string } =>
    typeof search.ref === "string" ? { ref: search } : {},
  head: () => ({
    meta: [
      { title: "PatternProof — Turn scattered evidence into structured patterns" },
      {
        name: "description",
        content:
          "Private documentation software that turns scattered evidence into court-ready patterns. Free for survivors and DV organizations. Built by a survivor.",
      },
      { property: "og:title", content: "PatternProof — The truth is in the pattern." },
      {
        property: "og:description",
        content: "Turn scattered incidents, evidence, and timelines into organized patterns survivors can document, attorneys can review, and advocates understand faster.",
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
          description: "Private documentation software that turns scattered evidence into court-ready patterns. Free for survivors and DV organizations.",
          brand: { "@type": "Brand", name: "PatternProof" },
          url: "https://pattern-proof.tech/",
          offers: [
            { "@type": "Offer", name: "Survivor — Free", price: "0", priceCurrency: "USD", url: "https://pattern-proof.tech/signin" },
            { "@type": "Offer", name: "Attorney Solo", price: "297", priceCurrency: "USD", url: "https://pattern-proof.tech/for-attorneys" },
            { "@type": "Offer", name: "DV Organization — Free", price: "0", priceCurrency: "USD", url: "https://pattern-proof.tech/for-organizations" },
          ],
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { ref } = Route.useSearch();
  const attorneyMode = ref?.toLowerCase() === "attorney";
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  if (loading || user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <BrandMark size={34} />
        <div className="label-eyebrow">Preparing your space…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--pp-paper)", color: "var(--pp-ink)" }}>
      <PublicQuickExit />

      {/* ── Hero ── */}
      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "clamp(48px,8vw,88px) 24px 32px" }}>
        <BrandLogo size={70} showTagline />

        <h1 style={{
          marginTop: 34,
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "clamp(2.2rem, 5.2vw, 3.6rem)",
          lineHeight: 1.08,
          letterSpacing: "-0.02em",
          color: "var(--pp-ink)",
          marginBottom: 0,
        }}>
          {attorneyMode ? (
            <>
              A shoebox of screenshots isn't a chronology.
              <br />
              <span className="highlight-thread">A source-linked timeline is.</span>
            </>
          ) : (
            <>
              The file is not the story.
              <br />
              <span className="highlight-thread">The pattern is.</span>
            </>
          )}
        </h1>

        <p style={{
          marginTop: 20,
          fontSize: 17,
          lineHeight: 1.6,
          color: "var(--pp-muted)",
          fontFamily: "var(--font-sans)",
          maxWidth: 620,
        }}>
          {attorneyMode
            ? "For attorneys: a structured, source-linked chronology on day one — not a shoebox of screenshots. Hearing prep starts with strategy, not sorting."
            : "Private documentation software that turns scattered evidence into court-ready patterns. Free for survivors. Free for DV organizations. Built by someone who lived it."}
        </p>

        {/* ── Three Path Cards ── */}
        {attorneyMode ? (
          <div style={{ marginTop: 34 }}>
            <Link to="/sample-case" className="pp-btn pp-btn-primary" style={{ fontSize: 14, padding: "14px 28px" }}>
              See a sample case <ArrowRight size={16} />
            </Link>
            <div style={{ marginTop: 18 }}>
              <Link to="/" search={{ ref: undefined }} style={{
                fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--pp-muted)",
                textDecoration: "underline", textUnderlineOffset: 3,
              }}>
                Not an attorney? See all options
              </Link>
            </div>
          </div>
        ) : (
          <div style={{
            position: "relative",
            marginTop: 40,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
            alignItems: "stretch",
          }}>
            <PathCard
              accent="var(--pp-accent-survivor)"
              gradient="linear-gradient(135deg,#A78BFA,#8B5CF6)"
              icon={FileText}
              label="Survivor"
              badge="Free forever"
              body="Document what happened, at your own pace. Photos, messages, voice notes, and dates — kept private and encrypted. Share only when you choose."
              to="/signin"
              cta="Start documenting"
            />
            <PathCard
              accent="var(--pp-accent-attorney)"
              gradient="linear-gradient(135deg,#5B8FCC,#3B6FBA)"
              icon={Briefcase}
              label="Attorney"
              badge="$297/mo"
              body="A source-linked chronology on day one. Your client documents their experience; you get an organized, court-ready case file — not a shoebox of screenshots."
              to="/sample-case"
              cta="See a sample case"
            />
            <PathCard
              accent="var(--pp-accent-org)"
              gradient="linear-gradient(135deg,#8BB890,#5D8A52)"
              icon={Users}
              label="DV Organization"
              badge="Free for orgs"
              body="A free tool your advocates can hand every survivor at intake. She documents once; you get a clean, organized referral to counsel — no paperwork mountain."
              to="/for-organizations"
              cta="See how it fits"
            />
          </div>
        )}
      </section>

      {/* ── Workflow Visualization ── */}
      <section style={{
        maxWidth: 1040, margin: "0 auto", padding: "48px 24px 32px",
      }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p className="label-eyebrow" style={{ marginBottom: 12 }}>How it works</p>
          <h2 style={{
            fontFamily: "var(--font-display)", fontWeight: 700,
            fontSize: "clamp(1.6rem, 3vw, 2.2rem)", color: "var(--pp-ink)",
            margin: 0,
          }}>
            Three steps. One clear pattern.
          </h2>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 24,
          alignItems: "start",
        }}>
          <WorkflowStep
            number="01"
            title="Document"
            accent="var(--pp-accent-survivor)"
            description="Log incidents, upload evidence, record voice notes. Everything is timestamped, source-linked, and encrypted. No legal jargon — just your story, in your words."
            icon={FileText}
          />
          <WorkflowStep
            number="02"
            title="Patterns surface"
            accent="var(--pp-approximate)"
            description="Recurline shows frequency and timing — neutral, visual, no labels. The pattern emerges from what you documented. You draw the conclusion; we connect the dots."
            icon={Eye}
          />
          <WorkflowStep
            number="03"
            title="Court-ready"
            accent="var(--pp-accent-attorney)"
            description="Generate a formatted court packet with timeline, evidence index, and case summary. Share securely with your attorney. Export as PDF — ready to file."
            icon={Download}
          />
        </div>

        {/* Connecting thread line */}
        <div style={{
          marginTop: 24, display: "flex", justifyContent: "center",
        }}>
          <Link to="/how-it-works" style={{
            fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
            color: "var(--pp-accent-survivor)", textDecoration: "underline",
            textUnderlineOffset: 4,
          }}>
            See the full walkthrough for each audience
          </Link>
        </div>
      </section>

      {/* ── Safety Section ── */}
      <section style={{
        maxWidth: 1040, margin: "0 auto", padding: "48px 24px 32px",
      }}>
        <div className="pp-card" style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 20,
          padding: 32,
        }}>
          <div style={{ gridColumn: "1 / -1", marginBottom: 8 }}>
            <p className="label-eyebrow" style={{ marginBottom: 8 }}>Safety built in</p>
            <h3 style={{
              fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: "clamp(1.3rem, 2vw, 1.6rem)", color: "var(--pp-ink)",
              margin: 0,
            }}>
              Designed for the moment you need it most.
            </h3>
          </div>
          <SafetyFeature icon={Eye} title="Exit Safely" description="One tap redirects to a neutral site. No trace in your browser history." />
          <SafetyFeature icon={Lock} title="App Disguise" description="Disguises as 'Daily Planner' on your home screen. No one knows it's there." />
          <SafetyFeature icon={ShieldCheck} title="PIN & Biometric" description="Optional screen lock. Your documentation stays locked even if someone has your phone." />
          <SafetyFeature icon={Download} title="Export & Delete" description="Export everything anytime. Delete everything with one tap. Your data, your control." />
        </div>
      </section>

      {/* ── Founder Section ── */}
      <section style={{
        maxWidth: 1040, margin: "0 auto", padding: "48px 24px 32px",
      }}>
        <div className="pp-card" style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          padding: 40,
          textAlign: "center",
        }}>
          <div style={{
            width: 96, height: 96, borderRadius: "50%",
            overflow: "hidden",
            boxShadow: "var(--pp-shadow-up)",
            flexShrink: 0,
          }}>
            <img
              src="https://base44.app/api/apps/6a68efa1a0b3e45f0fef34a5/files/mp/public/6a68efa1a0b3e45f0fef34a5/ff56e7ce3_headshot_good.png"
              alt="Grace Burns, Founder of PatternProof"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div>
            <p className="label-eyebrow" style={{ marginBottom: 12 }}>Built by a survivor</p>
            <h3 style={{
              fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: "clamp(1.4rem, 2.5vw, 1.8rem)", color: "var(--pp-ink)",
              margin: "0 0 16px",
            }}>
              "I sat in court with a box of screenshots and a story that didn't make sense."
            </h3>
            <p style={{
              fontSize: 16, lineHeight: 1.7, color: "var(--pp-muted)",
              maxWidth: 620, margin: "0 auto",
            }}>
              PatternProof exists because I lived it. I had the evidence — texts, photos, dates —
              but I couldn't show the pattern. The judge saw scattered incidents. I saw a pattern
              I couldn't articulate. PatternProof fixes that. It turns the chaos into something
              a judge can follow, an attorney can use, and a survivor can stand behind.
            </p>
            <p style={{
              marginTop: 16, fontFamily: "var(--font-sans)", fontWeight: 700,
              fontSize: 15, color: "var(--pp-ink)",
            }}>
              Grace Burns, Founder
            </p>
            <p style={{
              fontSize: 13, color: "var(--pp-muted)",
            }}>
              G Burns Company LLC · Burlington County, New Jersey
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ maxWidth: 780, margin: "0 auto", padding: "48px 24px 32px" }}>
        <p className="label-eyebrow" style={{ marginBottom: 12, textAlign: "center" }}>Questions</p>
        <h3 style={{
          fontFamily: "var(--font-display)", fontWeight: 700,
          fontSize: "clamp(1.4rem, 2.5vw, 1.8rem)", color: "var(--pp-ink)",
          margin: "0 0 28px", textAlign: "center",
        }}>
          What every survivor asks first.
        </h3>
        <FAQItem
          question="Will my abuser know I'm using PatternProof?"
          answer="No. The app can disguise itself as a 'Daily Planner' on your home screen. There's no notification, no icon, and no trace. The Exit Safely button instantly redirects to a neutral website if someone walks in."
        />
        <FAQItem
          question="Is it really free?"
          answer="Yes. Every survivor-critical feature — documentation, evidence upload, Recurline pattern visualization, Case Builder, court packet generation — is free, permanently. The attorney portal ($297/mo) is a separate product for legal professionals, not survivors."
        />
        <FAQItem
          question="Can I export everything if I want to leave?"
          answer="Yes. Export your entire case file as a PDF or ZIP at any time. You can also delete everything permanently with one tap. Your data belongs to you — not us."
        />
        <FAQItem
          question="Is this legal advice?"
          answer="No. PatternProof is a documentation tool, not a law firm. It doesn't give legal advice or create an attorney-client relationship. It helps you organize what happened so your attorney can use it effectively."
        />
      </section>

      {/* ── Footer ── */}
      <footer style={{
        maxWidth: 780, margin: "0 auto", padding: "44px 24px 96px",
        fontFamily: "var(--font-sans)", fontSize: 13,
        color: "var(--pp-muted)", lineHeight: 1.7,
      }}>
        <div style={{ marginBottom: 20 }}>
          <BrandMark size={26} />
        </div>
        Every entry keeps its source, and you control what you share.{" "}
        <Link to="/privacy" style={{ color: "var(--pp-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>
          Learn more
        </Link>
        <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 16 }}>
          <Link to="/privacy" style={{ color: "var(--pp-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>Privacy</Link>
          <Link to="/safety" style={{ color: "var(--pp-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>Safety</Link>
          <Link to="/support" style={{ color: "var(--pp-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>Support</Link>
          <Link to="/how-it-works" style={{ color: "var(--pp-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>How it works</Link>
          <Link to="/resources" style={{ color: "var(--pp-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>Resources</Link>
          <Link to="/terms" style={{ color: "var(--pp-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>Terms</Link>
          <Link to="/for-attorneys" style={{ color: "var(--pp-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>For attorneys</Link>
          <Link to="/for-organizations" style={{ color: "var(--pp-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>For organizations</Link>
          <Link to="/pricing" style={{ color: "var(--pp-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>Pricing</Link>
        </div>
        <div style={{ marginTop: 16, fontSize: 12, color: "var(--pp-muted)" }}>
          © 2026 G Burns Company LLC. PatternProof™ is a trademark of G Burns Company LLC.
        </div>
      </footer>
    </div>
  );
}

function PathCard({
  accent, gradient, icon: Icon, label, badge, body, to, cta,
}: {
  accent: string;
  gradient: string;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  badge: string;
  body: string;
  to: string;
  cta: string;
}) {
  return (
    <Link to={to} style={{
      position: "relative", zIndex: 1,
      display: "flex", flexDirection: "column",
      textDecoration: "none", color: "var(--pp-ink)",
      borderRadius: 20, overflow: "hidden",
      background: "var(--pp-ground)",
      boxShadow: "var(--pp-shadow-sm)",
      transition: "box-shadow 0.17s ease",
    }}>
      <div style={{
        position: "relative", height: 66,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: gradient,
      }}>
        <span aria-hidden="true">
          <Icon color="#FFFFFF" size={24} strokeWidth={1.6} />
        </span>
        <span style={{
          position: "absolute", top: 8, right: 10,
          fontFamily: "var(--font-mono)", fontSize: 9.5,
          fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase",
          background: "rgba(255,255,255,0.2)",
          color: "#FFFFFF", padding: "3px 8px",
          borderRadius: 999,
        }}>
          {badge}
        </span>
      </div>
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "space-between",
        padding: "16px 17px",
        boxShadow: `inset 4px 0 0 ${accent}`,
      }}>
        <div>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 9.5,
            letterSpacing: "0.14em", textTransform: "uppercase",
            fontWeight: 700, color: accent,
          }}>
            {label}
          </div>
          <p style={{
            margin: "8px 0 12px",
            fontFamily: "var(--font-sans)", fontWeight: 400,
            fontSize: 13.5, lineHeight: 1.45,
            color: "var(--pp-muted)",
          }}>
            {body}
          </p>
        </div>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: "var(--font-sans)", fontSize: 11,
          fontWeight: 700, letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: accent,
        }}>
          {cta} <ArrowRight size={14} />
        </span>
      </div>
    </Link>
  );
}

function WorkflowStep({
  number, title, accent, description, icon: Icon,
}: {
  number: string;
  title: string;
  accent: string;
  description: string;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}) {
  return (
    <div className="pp-card" style={{ padding: 24, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--pp-ground)", boxShadow: "var(--pp-shadow-in-sm)",
        }}>
          <Icon size={20} color={accent} strokeWidth={1.75} />
        </div>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 11,
          fontWeight: 600, color: "var(--pp-muted)",
          letterSpacing: "0.15em",
        }}>
          {number}
        </span>
      </div>
      <h4 style={{
        fontFamily: "var(--font-display)", fontWeight: 700,
        fontSize: 18, color: "var(--pp-ink)", margin: "0 0 8px",
      }}>
        {title}
      </h4>
      <p style={{
        fontSize: 14, lineHeight: 1.6, color: "var(--pp-muted)", margin: 0,
      }}>
        {description}
      </p>
    </div>
  );
}

function SafetyFeature({
  icon: Icon, title, description,
}: {
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  title: string;
  description: string;
}) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--pp-ground)", boxShadow: "var(--pp-shadow-in-sm)",
      }}>
        <Icon size={18} color="var(--pp-accent-survivor)" strokeWidth={1.75} />
      </div>
      <div>
        <div style={{
          fontSize: 13, fontWeight: 700, color: "var(--pp-ink)", marginBottom: 4,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 12.5, lineHeight: 1.5, color: "var(--pp-muted)",
        }}>
          {description}
        </div>
      </div>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details style={{
      marginBottom: 12, borderRadius: 20,
      background: "var(--pp-card)", boxShadow: "var(--pp-shadow-xs)",
      overflow: "hidden",
    }}>
      <summary style={{
        cursor: "pointer", padding: "16px 20px",
        fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 700,
        color: "var(--pp-ink)", listStyle: "none",
      }}>
        {question}
      </summary>
      <div style={{
        padding: "0 20px 16px",
        fontSize: 14, lineHeight: 1.65, color: "var(--pp-muted)",
      }}>
        {answer}
      </div>
    </details>
  );
}
