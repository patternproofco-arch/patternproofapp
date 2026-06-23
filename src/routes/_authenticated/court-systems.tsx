import { createFileRoute, Link } from "@tanstack/react-router";
import { Scale, Gavel, Shield, FileText, Users, AlertTriangle, BookOpen, ArrowRight } from "lucide-react";
import { CollapsibleCard } from "@/components/CollapsibleCard";

export const Route = createFileRoute("/_authenticated/court-systems")({
  head: () => ({
    meta: [
      { title: "Understanding Court Systems — P4TTERN PR00F" },
      { name: "description", content: "How family, criminal, and civil courts treat coercive control evidence — and how to prepare." },
    ],
  }),
  component: CourtSystemsPage,
});

// Brand tokens — match the rest of the app
const BROWN = "#1A140E";        // var(--sidebar) / deep brown
const BROWN_SOFT = "#2B2017";   // var(--panel)
const CREAM = "#F5EAD0";        // var(--background)
const ROSE = "#E59AAB";         // var(--primary)

function CourtSystemsPage() {
  return (
    <div className="space-y-10">
      {/* Header */}
      <header>
        <div className="label-eyebrow inline-flex items-center gap-2">
          <Scale size={12} /> Court systems guide
        </div>
        <h1 className="mt-2 font-serif text-[34px] leading-tight">
          How courts actually <em>evaluate</em> your evidence
        </h1>
      </header>

      <CollapsibleCard
        eyebrow="The three courts"
        title="Which court will hear your case"
        icon={<Scale size={20} style={{ color: BROWN }} />}
        accent={ROSE}
      >
        <div className="grid gap-5 md:grid-cols-3">
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
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        eyebrow="Patterns vs. incidents"
        title="Why pattern evidence wins where single incidents lose"
        icon={<BookOpen size={20} style={{ color: BROWN }} />}
        accent={ROSE}
      >
        <p className="text-[17px] font-medium leading-relaxed" style={{ color: "var(--foreground)" }}>
          A single argument looks like "a bad day." Forty-seven documented incidents over eighteen months — escalating in frequency, with consistent control tactics — looks like a campaign. Courts are trained to weigh patterns. Your job is to make the pattern undeniable, chronological, and cross-referenced.
        </p>
        <ul className="mt-5 space-y-3 text-[16px] font-medium" style={{ color: "var(--foreground)" }}>
          {[
            ["Chronology", "Dates and times anchor every incident. Gaps become suspicious; clusters become evidence of escalation."],
            ["Consistency", "The same tactics — financial control, isolation, monitoring — appearing across months proves intent, not coincidence."],
            ["Corroboration", "Each incident linked to a screenshot, photo, voice memo, or witness becomes harder to dismiss as 'he said, she said.'"],
            ["Severity arc", "Escalation flags graphed over time tell a judge what the next six months will look like if nothing changes."],
          ].map(([k, v]) => (
            <li key={k} className="flex gap-3">
              <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: ROSE }} />
              <span>
                <strong style={{ color: BROWN }}>{k}.</strong> {v}
              </span>
            </li>
          ))}
        </ul>
      </CollapsibleCard>

      <CollapsibleCard
        eyebrow="In the courtroom"
        title="What judges actually read — and what weakens a strong case"
        icon={<FileText size={20} style={{ color: BROWN }} />}
        accent={ROSE}
      >
        <div className="grid gap-5 md:grid-cols-2">
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
        </div>
      </CollapsibleCard>

      {/* CTAs */}
      <section
        className="rounded-2xl px-7 py-7 md:px-9"
        style={{ background: "var(--card)", border: `1px solid var(--border)` }}
      >
        <h2 className="text-xl font-extrabold" style={{ color: BROWN }}>Ready to put this into practice?</h2>
        <p className="mt-2 text-[16px] font-medium" style={{ color: "var(--foreground)" }}>
          P4TTERN PR00F builds court-ready documentation from your daily entries. Start with one of these:
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/patterns" className="btn-primary inline-flex items-center gap-2">
            Run pattern analysis <ArrowRight size={16} />
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
      style={{ background: "var(--card)", borderColor: "var(--border)", boxShadow: "0 6px 18px -12px rgba(26,20,14,0.25)", borderLeft: `3px solid ${ROSE}` }}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: `${BROWN}12`, color: BROWN }}>
        <Icon size={20} />
      </div>
      <h3 className="text-[19px] font-extrabold" style={{ color: BROWN }}>{title}</h3>
      <div
        className="mt-1 inline-block rounded-md px-2.5 py-1 text-[12px] font-extrabold uppercase tracking-[2px]"
        style={{ background: ROSE, color: BROWN }}
      >
        {burden}
      </div>
      <p className="mt-3 text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>{purpose}</p>
      <div className="mt-4 space-y-2 text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
        <p><strong style={{ color: BROWN }}>What matters: </strong>{whatMatters}</p>
        <p><strong style={{ color: BROWN }}>Your edge: </strong>{yourEdge}</p>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, body }: { icon: typeof FileText; title: string; body: string }) {
  return (
    <div className="rounded-2xl border p-6" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <div className="mb-3 flex items-center gap-2">
        <Icon size={18} style={{ color: BROWN }} />
        <h3 className="text-[17px] font-extrabold" style={{ color: BROWN }}>{title}</h3>
      </div>
      <p className="text-[16px] font-medium leading-relaxed" style={{ color: "var(--foreground)" }}>{body}</p>
    </div>
  );
}