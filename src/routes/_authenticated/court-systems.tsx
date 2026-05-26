import { createFileRoute, Link } from "@tanstack/react-router";
import { Scale, Gavel, Shield, FileText, Users, AlertTriangle, BookOpen, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/court-systems")({
  head: () => ({
    meta: [
      { title: "Understanding Court Systems — Pattern-Proof" },
      { name: "description", content: "How family, criminal, and civil courts treat coercive control evidence — and how to prepare." },
    ],
  }),
  component: CourtSystemsPage,
});

const NAVY = "#1a2332";
const NAVY_SOFT = "#243349";
const CREAM = "#F5F1E6";

function CourtSystemsPage() {
  return (
    <div className="space-y-10">
      {/* Header — navy accent band */}
      <header
        className="rounded-2xl px-7 py-8 md:px-10 md:py-10"
        style={{
          background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_SOFT} 100%)`,
          color: CREAM,
          boxShadow: "0 20px 40px -20px rgba(26,35,50,0.45)",
        }}
      >
        <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[3px]" style={{ opacity: 0.7 }}>
          <Scale size={13} /> Court systems guide
        </div>
        <h1 className="text-3xl font-semibold md:text-4xl" style={{ letterSpacing: "-0.01em" }}>
          How courts actually evaluate your evidence
        </h1>
        <p className="mt-3 max-w-2xl text-[15px]" style={{ opacity: 0.85 }}>
          Three different courts. Three different burdens of proof. Three different ways your documentation will be received. Know what you're walking into.
        </p>
      </header>

      {/* Three courts */}
      <section className="grid gap-5 md:grid-cols-3">
        <CourtCard
          icon={Users}
          title="Family Court"
          burden="Preponderance of evidence"
          purpose="Custody, divorce, protective orders, parenting time."
          whatMatters="Patterns of behavior over time. Judges weigh credibility heavily. Coercive control is increasingly recognized but inconsistently applied."
          yourEdge="Chronological timelines, escalation patterns, and corroborated incidents move the needle here."
        />
        <CourtCard
          icon={Gavel}
          title="Criminal Court"
          burden="Beyond a reasonable doubt"
          purpose="Charges filed by the state. Assault, stalking, violation of protective orders."
          whatMatters="Discrete incidents with physical evidence, police reports, witnesses, medical records. Patterns alone rarely suffice."
          yourEdge="Linked evidence (photo + medical + 911 log + journal entry) for each charged incident."
        />
        <CourtCard
          icon={Shield}
          title="Civil / Protective Order"
          burden="Preponderance + immediacy"
          purpose="TROs, FROs, restraining orders, harassment injunctions."
          whatMatters="Recent incidents demonstrating fear of imminent harm. Recency and specificity outweigh volume."
          yourEdge="Date-stamped communications, recent incident logs, and witness contact info ready to file."
        />
      </section>

      {/* Why patterns help */}
      <section
        className="rounded-2xl border p-7 md:p-9"
        style={{ background: "var(--background)", borderColor: "rgba(31,26,20,0.08)" }}
      >
        <div className="mb-4 flex items-center gap-2">
          <BookOpen size={18} style={{ color: NAVY }} />
          <h2 className="text-xl font-semibold" style={{ color: NAVY }}>
            Why pattern evidence wins where single incidents lose
          </h2>
        </div>
        <p className="text-[15px] leading-relaxed" style={{ color: "var(--foreground)" }}>
          A single argument looks like "a bad day." Forty-seven documented incidents over eighteen months — escalating in frequency, with consistent control tactics — looks like a campaign. Courts are trained to weigh patterns. Your job is to make the pattern undeniable, chronological, and cross-referenced.
        </p>
        <ul className="mt-5 space-y-3 text-[14px]" style={{ color: "var(--foreground)" }}>
          {[
            ["Chronology", "Dates and times anchor every incident. Gaps become suspicious; clusters become evidence of escalation."],
            ["Consistency", "The same tactics — financial control, isolation, monitoring — appearing across months proves intent, not coincidence."],
            ["Corroboration", "Each incident linked to a screenshot, photo, voice memo, or witness becomes harder to dismiss as 'he said, she said.'"],
            ["Severity arc", "Escalation flags graphed over time tell a judge what the next six months will look like if nothing changes."],
          ].map(([k, v]) => (
            <li key={k} className="flex gap-3">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: NAVY }} />
              <span>
                <strong style={{ color: NAVY }}>{k}.</strong> {v}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* What to expect */}
      <section className="grid gap-5 md:grid-cols-2">
        <InfoCard
          icon={FileText}
          title="What judges actually read"
          body="Most judges have minutes — not hours — per case. They scan summaries, headlines, and exhibits. A 200-page journal dump gets skimmed. A 12-page court packet with a timeline, pattern summary, and indexed exhibits gets read."
        />
        <InfoCard
          icon={AlertTriangle}
          title="What weakens a strong case"
          body="Inconsistent dates. Emotional language without facts. Missing context for screenshots. Vague allegations without specific incidents. Gaps in documentation that look like the abuse stopped (it usually didn't)."
        />
      </section>

      {/* CTAs */}
      <section
        className="rounded-2xl px-7 py-7 md:px-9"
        style={{ background: CREAM, border: `1px solid ${NAVY}20` }}
      >
        <h2 className="text-lg font-semibold" style={{ color: NAVY }}>Ready to put this into practice?</h2>
        <p className="mt-1 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
          Pattern-Proof builds court-ready documentation from your daily entries. Start with one of these:
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/patterns" className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold transition-transform hover:-translate-y-px" style={{ background: NAVY, color: CREAM }}>
            Run pattern analysis <ArrowRight size={14} />
          </Link>
          <Link to="/court-packet" className="btn-ghost">Build court packet</Link>
          <Link to="/share-with-attorney" className="btn-ghost">Share with attorney</Link>
        </div>
      </section>
    </div>
  );
}

function CourtCard({ icon: Icon, title, burden, purpose, whatMatters, yourEdge }: {
  icon: typeof Scale; title: string; burden: string; purpose: string; whatMatters: string; yourEdge: string;
}) {
  return (
    <div
      className="flex flex-col rounded-2xl border p-6"
      style={{ background: "var(--background)", borderColor: "rgba(26,35,50,0.12)", boxShadow: "0 6px 18px -12px rgba(26,35,50,0.25)" }}
    >
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${NAVY}10`, color: NAVY }}>
        <Icon size={18} />
      </div>
      <h3 className="text-[17px] font-semibold" style={{ color: NAVY }}>{title}</h3>
      <div className="mt-1 text-[11px] uppercase tracking-[2px]" style={{ color: "var(--muted-foreground)" }}>{burden}</div>
      <p className="mt-3 text-[13px]" style={{ color: "var(--muted-foreground)" }}>{purpose}</p>
      <div className="mt-4 space-y-2 text-[13px]">
        <p><strong style={{ color: NAVY }}>What matters: </strong>{whatMatters}</p>
        <p><strong style={{ color: NAVY }}>Your edge: </strong>{yourEdge}</p>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, body }: { icon: typeof FileText; title: string; body: string }) {
  return (
    <div className="rounded-2xl border p-6" style={{ background: "var(--background)", borderColor: "rgba(31,26,20,0.08)" }}>
      <div className="mb-3 flex items-center gap-2">
        <Icon size={16} style={{ color: NAVY }} />
        <h3 className="text-[15px] font-semibold" style={{ color: NAVY }}>{title}</h3>
      </div>
      <p className="text-[14px] leading-relaxed" style={{ color: "var(--foreground)" }}>{body}</p>
    </div>
  );
}