import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Scale,
  Gavel,
  Shield,
  FileText,
  Users,
  AlertTriangle,
  BookOpen,
  ArrowRight,
  Sparkles,
  Compass,
} from "lucide-react";
import { CollapsibleCard } from "@/components/CollapsibleCard";
import { HubTabs, RESOURCE_TABS } from "@/components/HubTabs";

export const Route = createFileRoute("/_authenticated/court-systems")({
  head: () => ({
    meta: [
      { title: "Understanding Court Systems — PatternProof" },
      {
        name: "description",
        content:
          "How family, criminal, and civil courts treat coercive control evidence — and how to prepare.",
      },
    ],
  }),
  component: CourtSystemsPage,
});

// Brand tokens — match the rest of the app
const BROWN = "var(--pp-ink)";
const BROWN_SOFT = "var(--pp-muted)";
const CREAM = "var(--background)";
const ROSE = "var(--pp-accent)";

function CourtSystemsPage() {
  return (
    <div className="space-y-10">
      {/* Header */}
      <HubTabs tabs={RESOURCE_TABS} />
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
        title="Why documented patterns are harder to dismiss than single incidents"
        icon={<BookOpen size={20} style={{ color: BROWN }} />}
        accent={ROSE}
      >
        <p
          className="text-[17px] font-medium leading-relaxed"
          style={{ color: "var(--foreground)" }}
        >
          A single argument can look like "a bad day." Forty-seven documented incidents over
          eighteen months — escalating in frequency, with consistent control tactics — can look very
          different. Courts vary in how they weigh documented patterns, but a chronological,
          cross-referenced record gives your attorney more to work with than an isolated incident
          does.
        </p>
        <ul
          className="mt-5 space-y-3 text-[16px] font-medium"
          style={{ color: "var(--foreground)" }}
        >
          {[
            [
              "Chronology",
              "Dates and times anchor every incident. Gaps become suspicious; clusters become evidence of escalation.",
            ],
            [
              "Consistency",
              "The same tactics — financial control, isolation, monitoring — appearing across months is harder to dismiss as coincidence than a single incident.",
            ],
            [
              "Corroboration",
              "Each incident linked to a screenshot, photo, voice memo, or witness becomes harder to dismiss as 'he said, she said.'",
            ],
            [
              "Severity arc",
              "Escalation flags graphed over time give your attorney a clear picture of the trend so far — not a prediction of what happens next.",
            ],
          ].map(([k, v]) => (
            <li key={k} className="flex gap-3">
              <span
                className="mt-2 h-2 w-2 flex-shrink-0 rounded-full"
                style={{ background: ROSE }}
              />
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
            body="A concise, indexed packet can make records easier for your attorney or advocate to review. Ask a qualified local professional what format and material are appropriate for your court and case."
          />
          <InfoCard
            icon={AlertTriangle}
            title="What weakens a strong case"
            body="Inconsistent dates. Emotional language without facts. Missing context for screenshots. Vague allegations without specific incidents. Gaps in documentation that look like the abuse stopped (it usually didn't)."
          />
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        eyebrow="A briefing for the record"
        title="Why courts struggle with abuse patterns"
        icon={<Sparkles size={20} style={{ color: BROWN }} />}
        accent={ROSE}
      >
        <p className="text-[15px] leading-relaxed" style={{ color: BROWN_SOFT }}>
          Not advice. Not reassurance. A plain reading of how the system was built, how it fails
          survivors of coercive control, and what the record can do that a five-minute hearing
          cannot.
        </p>

        <div className="mt-6 space-y-3">
          <h3 className="flex items-center gap-2 font-serif text-[19px]" style={{ color: BROWN }}>
            <Scale size={16} style={{ color: ROSE }} /> The gap between the law and the lived
            experience
          </h3>
          <p className="text-[15px] leading-relaxed" style={{ color: "var(--foreground)" }}>
            Courts are built to adjudicate <strong>isolated incidents</strong> — an assault on a
            specific date, a threat sent at a specific time, a single breach of a single order.
            Evidence rules, charging documents, and trial formats all assume a discrete event with
            discrete proof.
          </p>
          <p className="text-[15px] leading-relaxed" style={{ color: "var(--foreground)" }}>
            Abuse rarely works that way. It is <strong>cumulative and strategic</strong> — a pattern
            of small, deliberate acts that researchers describe as "death by a thousand cuts." Each
            act, viewed alone, can look minor. Together they form a system of control.
          </p>
          <p className="text-[15px] leading-relaxed" style={{ color: "var(--foreground)" }}>
            Family courts in particular focus on <strong>"present danger"</strong> rather than
            historical patterns of control. Criminal courts demand{" "}
            <strong>proof beyond a reasonable doubt</strong> for single events. Neither forum is
            designed to weigh years of coercion compressed into a five-minute hearing — so survivors
            who try are often read as scattered, hostile, or "difficult to understand."
          </p>
          <ResourceQuote>
            Evan Stark's framework of <em>coercive control</em> (2007) reframes domestic abuse as a
            "liberty crime" — a sustained course of conduct, not a series of assaults. Most courts
            still adjudicate the assaults.
          </ResourceQuote>
        </div>

        <div className="mt-6 space-y-3">
          <h3 className="flex items-center gap-2 font-serif text-[19px]" style={{ color: BROWN }}>
            <Gavel size={16} style={{ color: ROSE }} /> How narcissistic and controlling abusers
            present in court
          </h3>
          <p className="text-[15px] leading-relaxed" style={{ color: "var(--foreground)" }}>
            The research is consistent. In adversarial proceedings, abusers often:
          </p>
          <ul
            className="ml-1 space-y-2 text-[15px] leading-relaxed"
            style={{ color: "var(--foreground)" }}
          >
            <ResourceBullet>
              Appear <strong>calm, organized, and cooperative</strong> — not because they are well,
              but because they are winning. The courtroom is not a trigger; it is a stage.
            </ResourceBullet>
            <ResourceBullet>
              Use the legal system itself as <strong>continued abuse</strong> — vexatious
              litigation, repeat filings, and custody manipulation are documented post-separation
              tactics.
            </ResourceBullet>
            <ResourceBullet>
              <strong>Charm professionals</strong> — judges, custody evaluators, guardians ad litem,
              and mediators. Lundy Bancroft's clinical work documents how presentation is rehearsed
              for exactly this audience.
            </ResourceBullet>
            <ResourceBullet>
              <strong>Reframe the survivor's trauma responses</strong> — hypervigilance,
              tearfulness, anger, protective refusal — as "instability," "alienation," or "high
              conflict."
            </ResourceBullet>
            <ResourceBullet>
              Exploit the fact that most judges receive{" "}
              <strong>little training in coercive control</strong>, and routinely mistake composure
              for credibility.
            </ResourceBullet>
          </ul>
          <ResourceQuote>
            Heather Douglas and Evan Stark describe this as <em>institutional betrayal</em> — when
            the systems a survivor turns to for protection instead become tools of the abuse.
          </ResourceQuote>
        </div>

        <div className="mt-6 space-y-3">
          <h3 className="flex items-center gap-2 font-serif text-[19px]" style={{ color: BROWN }}>
            <Sparkles size={16} style={{ color: ROSE }} /> What PatternProof does differently
          </h3>
          <ul
            className="ml-1 space-y-2 text-[15px] leading-relaxed"
            style={{ color: "var(--foreground)" }}
          >
            <ResourceBullet>
              Organizes scattered evidence — texts, screenshots, voice notes, photos — into a{" "}
              <strong>recognizable behavioral timeline</strong>.
            </ResourceBullet>
            <ResourceBullet>
              Surfaces <strong>coercive control patterns</strong>: isolation, monitoring, financial
              control, threats, and the escalation that links them.
            </ResourceBullet>
            <ResourceBullet>
              Produces <strong>professional-review summaries</strong> that show escalation and
              repetition rather than asking a judge to assemble them in real time.
            </ResourceBullet>
            <ResourceBullet>
              Generates <strong>objective, date-anchored timelines</strong> that reduce the burden
              of emotional testimony on the survivor.
            </ResourceBullet>
            <ResourceBullet>
              Gives attorneys <strong>evidence they can actually use</strong> — labeled, dated,
              cross-referenced — instead of 400 screenshots in a phone gallery.
            </ResourceBullet>
          </ul>
        </div>

        <div className="mt-6 space-y-3">
          <h3 className="flex items-center gap-2 font-serif text-[19px]" style={{ color: BROWN }}>
            <Compass size={16} style={{ color: ROSE }} /> What you can do
          </h3>
          <ul
            className="ml-1 space-y-2 text-[15px] leading-relaxed"
            style={{ color: "var(--foreground)" }}
          >
            <ResourceBullet>
              <strong>Document consistently.</strong> The "small" incidents are what establish a
              pattern. Compounding is the point.
            </ResourceBullet>
            <ResourceBullet>
              <strong>Focus on patterns, not only physical violence.</strong> Coercive control is
              the throughline most courts miss.
            </ResourceBullet>
            <ResourceBullet>
              <strong>Request judges trained in coercive control</strong> when jurisdiction allows
              it — and ask your attorney whether your court has specialty DV dockets.
            </ResourceBullet>
            <ResourceBullet>
              <strong>Work with DV-informed attorneys</strong> who understand post-separation abuse,
              not only divorce mechanics.
            </ResourceBullet>
            <ResourceBullet>
              <strong>Use PatternProof's exported timelines as evidence exhibits</strong> — dated,
              sourced, and ready to attach.
            </ResourceBullet>
          </ul>
        </div>

        <div
          className="mt-6 rounded-2xl p-5 text-[13px] leading-relaxed"
          style={{ background: "var(--pp-ground)", color: BROWN_SOFT }}
        >
          <div className="label-eyebrow">Sources</div>
          <p className="mt-2">
            Stark, E. (2007). <em>Coercive Control: How Men Entrap Women in Personal Life.</em>{" "}
            Oxford University Press. · Bancroft, L. (2002).{" "}
            <em>Why Does He Do That? Inside the Minds of Angry and Controlling Men.</em> · Douglas,
            H. &amp; Stark, E. (2023). Work on coercive control and institutional response in family
            law. · Meier, J. (2020).{" "}
            <em>
              U.S. Child Custody Outcomes in Cases Involving Parental Alienation and Abuse
              Allegations.
            </em>
          </p>
        </div>
      </CollapsibleCard>

      {/* CTAs */}
      <section
        className="rounded-2xl px-7 py-7 md:px-9"
        style={{ background: "var(--card)", border: `1px solid var(--border)` }}
      >
        <h2 className="text-xl font-extrabold" style={{ color: BROWN }}>
          Ready to put this into practice?
        </h2>
        <p className="mt-2 text-[16px] font-medium" style={{ color: "var(--foreground)" }}>
          PatternProof builds professional-review documentation from your daily entries. Start with
          one of these:
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/patterns" className="btn-primary inline-flex items-center gap-2">
            Open Recurline <ArrowRight size={16} />
          </Link>
          <Link to="/court-packet" className="btn-ghost">
            Build professional-review packet
          </Link>
          <Link to="/share-with-attorney" className="btn-ghost">
            Share with attorney
          </Link>
        </div>
      </section>
    </div>
  );
}

function CourtCard({
  icon: Icon,
  title,
  burden,
  purpose,
  whatMatters,
  yourEdge,
}: {
  icon: typeof Scale;
  title: string;
  burden: string;
  purpose: string;
  whatMatters: string;
  yourEdge: string;
}) {
  return (
    <div
      className="flex flex-col rounded-2xl border p-6"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
        boxShadow: "var(--pp-shadow-sm)",
        borderLeft: `3px solid ${ROSE}`,
      }}
    >
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl"
        style={{
          background: "var(--pp-ground)",
          boxShadow: "var(--pp-shadow-in-sm)",
          color: BROWN,
        }}
      >
        <Icon size={20} />
      </div>
      <h3 className="text-[19px] font-extrabold" style={{ color: BROWN }}>
        {title}
      </h3>
      <div
        className="mt-1 inline-block rounded-2xl px-2.5 py-1 text-[12px] font-extrabold uppercase tracking-[2px]"
        style={{ background: ROSE, color: "var(--pp-accent-fg, #fff)" }}
      >
        {burden}
      </div>
      <p className="mt-3 text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
        {purpose}
      </p>
      <div
        className="mt-4 space-y-2 text-[15px] font-semibold"
        style={{ color: "var(--foreground)" }}
      >
        <p>
          <strong style={{ color: BROWN }}>What matters: </strong>
          {whatMatters}
        </p>
        <p>
          <strong style={{ color: BROWN }}>Your edge: </strong>
          {yourEdge}
        </p>
      </div>
    </div>
  );
}

function ResourceBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span style={{ color: BROWN_SOFT }}>·</span>
      <span>{children}</span>
    </li>
  );
}

function ResourceQuote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote
      className="mt-2 rounded-xl border-l-2 px-4 py-3 text-[14px] italic leading-relaxed"
      style={{ borderColor: BROWN_SOFT, background: "var(--pp-ground)", color: BROWN_SOFT }}
    >
      {children}
    </blockquote>
  );
}

function InfoCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof FileText;
  title: string;
  body: string;
}) {
  return (
    <div
      className="rounded-2xl border p-6"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon size={18} style={{ color: BROWN }} />
        <h3 className="text-[17px] font-extrabold" style={{ color: BROWN }}>
          {title}
        </h3>
      </div>
      <p className="text-[16px] font-medium leading-relaxed" style={{ color: "var(--foreground)" }}>
        {body}
      </p>
    </div>
  );
}
