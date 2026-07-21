import { useState } from "react";
import { Scale, Gavel, Sparkles, Compass, ChevronDown } from "lucide-react";

export function WhyCourtsStruggleContent() {
  return (
    <div className="space-y-10">
      <header>
        <div className="label-eyebrow">A briefing for the record</div>
        <h1 className="mt-2 font-serif text-[32px] leading-tight md:text-[40px]">
          Why courts struggle with <em>abuse patterns.</em>
        </h1>
        <p className="mt-3 max-w-2xl text-[15px]" style={{ color: "var(--muted-foreground)" }}>
          Not advice. Not reassurance. A plain reading of how the system was built,
          how it fails survivors of coercive control, and what the record can do that
          a five-minute hearing cannot.
        </p>
      </header>

      <Section
        num="01"
        icon={Scale}
        title="The gap between the law and the lived experience"
        accent="var(--primary)"
      >
        <p>
          Courts are built to adjudicate <strong>isolated incidents</strong> — an
          assault on a specific date, a threat sent at a specific time, a single
          breach of a single order. Evidence rules, charging documents, and trial
          formats all assume a discrete event with a discrete proof.
        </p>
        <p>
          Abuse rarely works that way. It is <strong>cumulative and strategic</strong> —
          a pattern of small, deliberate acts that researchers describe as "death by
          a thousand cuts." Each act, viewed alone, can look minor. Together they
          form a system of control.
        </p>
        <p>
          Family courts in particular focus on <strong>"present danger"</strong>{" "}
          rather than historical patterns of control. Criminal courts demand{" "}
          <strong>proof beyond a reasonable doubt</strong> for single events. Neither
          forum is designed to weigh years of coercion compressed into a five-minute
          hearing — so survivors who try are often read as scattered, hostile, or
          "difficult to understand."
        </p>
        <Quote>
          Evan Stark's framework of <em>coercive control</em> (2007) reframes domestic
          abuse as a "liberty crime" — a sustained course of conduct, not a series of
          assaults. Most courts still adjudicate the assaults.
        </Quote>
      </Section>

      <Section
        num="02"
        icon={Gavel}
        title="How narcissistic and controlling abusers present in court"
        accent="var(--accent)"
      >
        <p>The research is consistent. In adversarial proceedings, abusers often:</p>
        <ul className="ml-1 space-y-2">
          <Bullet>
            Appear <strong>calm, organized, and cooperative</strong> — not because
            they are well, but because they are winning. The courtroom is not a
            trigger; it is a stage.
          </Bullet>
          <Bullet>
            Use the legal system itself as <strong>continued abuse</strong> —
            vexatious litigation, repeat filings, and custody manipulation are
            documented post-separation tactics.
          </Bullet>
          <Bullet>
            <strong>Charm professionals</strong> — judges, custody evaluators,
            guardians ad litem, and mediators. Lundy Bancroft's clinical work
            documents how presentation is rehearsed for exactly this audience.
          </Bullet>
          <Bullet>
            <strong>Reframe the survivor's trauma responses</strong> — hypervigilance,
            tearfulness, anger, protective refusal — as "instability,"
            "alienation," or "high conflict."
          </Bullet>
          <Bullet>
            Exploit the fact that most judges receive <strong>little training in
            coercive control</strong>, and routinely mistake composure for credibility.
          </Bullet>
        </ul>
        <Quote>
          Heather Douglas and Evan Stark describe this as <em>institutional betrayal</em>{" "}
          — when the systems a survivor turns to for protection instead become tools
          of the abuse.
        </Quote>
      </Section>

      <Section
        num="03"
        icon={Sparkles}
        title="What PatternProof does differently"
        accent="var(--safe)"
      >
        <ul className="ml-1 space-y-2">
          <Bullet>
            Organizes scattered evidence — texts, screenshots, voice notes, photos —
            into a <strong>recognizable behavioral timeline</strong>.
          </Bullet>
          <Bullet>
            Surfaces <strong>coercive control patterns</strong>: isolation,
            monitoring, financial control, threats, and the escalation that links
            them.
          </Bullet>
          <Bullet>
            Produces <strong>professional-review summaries</strong> that show escalation and
            repetition rather than asking a judge to assemble them in real time.
          </Bullet>
          <Bullet>
            Generates <strong>objective, date-anchored timelines</strong> that reduce
            the burden of emotional testimony on the survivor.
          </Bullet>
          <Bullet>
            Gives attorneys <strong>evidence they can actually use</strong> — labeled,
            dated, cross-referenced — instead of 400 screenshots in a phone gallery.
          </Bullet>
        </ul>
      </Section>

      <Section
        num="04"
        icon={Compass}
        title="What you can do"
        accent="var(--primary)"
      >
        <ul className="ml-1 space-y-2">
          <Bullet>
            <strong>Document consistently.</strong> The "small" incidents are what
            establish a pattern. Compounding is the point.
          </Bullet>
          <Bullet>
            <strong>Focus on patterns, not only physical violence.</strong> Coercive
            control is the throughline most courts miss.
          </Bullet>
          <Bullet>
            <strong>Request judges trained in coercive control</strong> when
            jurisdiction allows it — and ask your attorney whether your court has
            specialty DV dockets.
          </Bullet>
          <Bullet>
            <strong>Work with DV-informed attorneys</strong> who understand
            post-separation abuse, not only divorce mechanics.
          </Bullet>
          <Bullet>
            <strong>Use PatternProof's exported timelines as evidence exhibits</strong>{" "}
            — dated, sourced, and ready to attach.
          </Bullet>
        </ul>
      </Section>

      <footer
        className="rounded-2xl p-5 text-[13px] leading-relaxed"
        style={{ background: "var(--panel)", color: "var(--sidebar-active)" }}
      >
        <div className="label-eyebrow" style={{ color: "var(--sidebar-inactive)" }}>
          Sources
        </div>
        <p className="mt-2">
          Stark, E. (2007). <em>Coercive Control: How Men Entrap Women in Personal Life.</em>{" "}
          Oxford University Press. · Bancroft, L. (2002). <em>Why Does He Do That?
          Inside the Minds of Angry and Controlling Men.</em> · Douglas, H. &amp;
          Stark, E. (2023). Work on coercive control and institutional response in
          family law. · Meier, J. (2020). <em>U.S. Child Custody Outcomes in Cases
          Involving Parental Alienation and Abuse Allegations.</em>
        </p>
      </footer>
    </div>
  );
}

function Section({
  num,
  icon: Icon,
  title,
  accent,
  children,
}: {
  num: string;
  icon: typeof Scale;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="card-pp" style={{ borderLeft: `3px solid ${accent}` }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 text-left"
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full font-display text-[13px] font-bold"
          style={{ background: accent, color: "var(--sidebar)" }}
        >
          {num}
        </div>
        <Icon size={18} style={{ color: accent }} />
        <h2 className="flex-1 font-serif text-[22px] leading-tight">{title}</h2>
        <ChevronDown
          size={20}
          style={{
            transition: "transform 200ms",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            color: "var(--foreground)",
          }}
        />
      </button>
      {open && <div className="mt-4 space-y-3 text-[15px] leading-relaxed">{children}</div>}
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span style={{ color: "var(--muted-foreground)" }}>·</span>
      <span>{children}</span>
    </li>
  );
}

function Quote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote
      className="mt-2 rounded-xl border-l-2 px-4 py-3 text-[14px] italic leading-relaxed"
      style={{
        borderColor: "var(--muted-foreground)",
        background: "rgba(31,26,20,0.03)",
        color: "var(--muted-foreground)",
      }}
    >
      {children}
    </blockquote>
  );
}