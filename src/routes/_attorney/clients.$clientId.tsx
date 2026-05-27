import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Circle, Clock, FileText, HelpCircle, Sparkles, TrendingUp, X } from "lucide-react";
import { getClientCase, generateDepositionPrep } from "@/lib/attorney-portal.functions";
import { typeLabel } from "@/lib/abuse-types";
import { toast } from "sonner";

export const Route = createFileRoute("/_attorney/clients/$clientId")({
  component: ClientCaseView,
});

type CaseData = Awaited<ReturnType<typeof getClientCase>>;
type DepoResult = Awaited<ReturnType<typeof generateDepositionPrep>>;

const TABS = ["Overview", "Patterns", "Checklist", "Gaps", "Timeline", "Deposition"] as const;
type Tab = (typeof TABS)[number];

const TAB_GUIDE: Record<Tab, { title: string; see: string; do: string; why: string; court: string; flag?: string }> = {
  Overview: {
    title: "Your client's case summary",
    see: "Recent incidents, pattern summary, key metrics.",
    do: "Start here. Skim the summary and recent incidents.",
    why: "5-minute client understanding instead of a 2-hour review.",
    court: "Client summary can become your opening narrative.",
  },
  Patterns: {
    title: "The abuse architecture",
    see: "Categorized pattern types (isolation, financial control, threats) with frequency counts.",
    do: "Identify the dominant pattern for your legal theory.",
    why: "Courts understand coercive control through patterns, not isolated incidents.",
    court: "Argue 'systematic control' vs. 'isolated conflict.'",
    flag: "If patterns are uneven (e.g. 5 isolation, 0 financial), prepare for selection-bias attacks.",
  },
  Checklist: {
    title: "Stark coercive control framework",
    see: "Which control mechanisms are documented and how many incidents per mechanism.",
    do: "Check which boxes are documented vs. missing.",
    why: "Family courts recognize the Stark framework — this proves systematic control.",
    court: "8+ of 11 Stark behaviors documented = textbook coercive control case.",
    flag: "Missing mechanisms? Ask the client to document them before filing.",
  },
  Gaps: {
    title: "What's missing (and why it matters)",
    see: "Evidence gaps, documentation weaknesses, pattern holes.",
    do: "Use this to prep your client before deposition or cross-examination.",
    why: "Opposing counsel will attack these gaps — address them first.",
    court: "Demonstrates thorough case prep to the bench.",
  },
  Timeline: {
    title: "Escalation proof",
    see: "Month-by-month incident frequency and severity trends.",
    do: "Show this to judges and mediators as proof of escalation.",
    why: "Escalation = premeditation = coercive control, not mutual conflict.",
    court: "Visual proof of systematic worsening — powerful for custody and restraining orders.",
    flag: "A flat timeline still indicates maintained control — adjust strategy, don't dismiss.",
  },
  Deposition: {
    title: "Your witness prep",
    see: "Chronology strengths, credibility gaps, likely cross angles, prep questions.",
    do: "Run this 48 hours before deposition or testimony.",
    why: "AI surfaces weak spots in advance and gives you a deflection strategy.",
    court: "Client testimony lands tighter and less emotionally triggered.",
  },
};

const METRIC_HELP: Record<string, string> = {
  Incidents: "Total documented incidents in this case file.",
  Evidence: "Files (photos, audio, documents) the client has uploaded as evidence.",
  "Last 30d": "Incidents documented in the past 30 days — relevant for emergency motions.",
  "Avg severity": "Severity 1 (minor) to 5 (severe). Helps establish pattern intensity for judges evaluating risk.",
  "Active flags": "Escalation moments, threats, or control attempts that happened recently. Relevant for emergency motions and TROs.",
  Risk: "HIGH RISK = escalating patterns, documented threats, or active surveillance. Strengthens protective orders, custody modifications, and emergency relief.",
};

function ClientCaseView() {
  const { clientId } = useParams({ from: "/_attorney/clients/$clientId" });
  const fetcher = useServerFn(getClientCase);
  const depoFn = useServerFn(generateDepositionPrep);
  const [data, setData] = useState<CaseData | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [depo, setDepo] = useState<DepoResult | null>(null);
  const [depoLoading, setDepoLoading] = useState(false);

  useEffect(() => {
    fetcher({ data: { clientId } }).then(setData).catch(() => toast("Couldn't load case."));
  }, [fetcher, clientId]);

  const runDepo = async () => {
    setDepoLoading(true);
    try {
      const r = await depoFn({ data: { clientId } });
      setDepo(r);
      if (!r.ok) toast("Couldn't generate prep: " + r.reason);
    } finally { setDepoLoading(false); }
  };

  if (!data) return <div className="card-pp">Loading case…</div>;

  const riskColor: Record<string, string> = {
    low: "var(--safe)", moderate: "var(--type-coercive)",
    elevated: "var(--type-emotional)", high: "var(--primary)",
  };

  return (
    <div>
      <FirstTimeAttorneyModal />
      <Link to="/clients" className="inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--accent)" }}>
        <ArrowLeft size={13} /> All clients
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="label-eyebrow">Case file</div>
          <h1 className="mt-1 font-serif text-[28px]">Client · {clientId.slice(0, 8)}</h1>
        </div>
        <span title={METRIC_HELP.Risk} className="inline-flex cursor-help items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: riskColor[data.risk_level], color: "var(--sidebar-active)" }}>
          {data.risk_level.toUpperCase()} RISK <HelpCircle size={11} />
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        <Metric label="Incidents" v={data.incidents.length} help={METRIC_HELP.Incidents} />
        <Metric label="Evidence" v={data.evidence.length} help={METRIC_HELP.Evidence} />
        <Metric label="Last 30d" v={data.last_30_days} help={METRIC_HELP["Last 30d"]} />
        <Metric label="Avg severity" v={data.avg_severity.toFixed(1)} help={METRIC_HELP["Avg severity"]} />
        <Metric label="Active flags" v={data.flags.filter((f) => !f.dismissed_at).length} help={METRIC_HELP["Active flags"]} />
      </div>

      <TimeSavedCard />
      <NextStepsCard onJump={(t) => setTab(t)} onGenerate={() => { setTab("Deposition"); runDepo(); }} />

      <div className="mt-6 flex flex-wrap gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 py-2 text-[13px]"
            style={{
              borderBottom: tab === t ? "2px solid var(--primary)" : "2px solid transparent",
              fontWeight: tab === t ? 700 : 500,
              color: tab === t ? "var(--foreground)" : "var(--muted-foreground)",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <TabGuide tab={tab} />

      <div className="mt-5">
        {tab === "Overview" && <Overview data={data} />}
        {tab === "Patterns" && <Patterns data={data} />}
        {tab === "Checklist" && <Checklist data={data} />}
        {tab === "Gaps" && <Gaps data={data} />}
        {tab === "Timeline" && <TimelineTab data={data} />}
        {tab === "Deposition" && <DepoTab depo={depo} loading={depoLoading} onRun={runDepo} />}
      </div>
    </div>
  );
}

function Metric({ label, v, help }: { label: string; v: number | string; help?: string }) {
  return (
    <div className="card-pp" style={{ padding: 12 }} title={help}>
      <div className="label-eyebrow inline-flex items-center gap-1">
        {label}{help && <HelpCircle size={10} style={{ opacity: 0.6 }} />}
      </div>
      <div className="mt-1 font-serif text-[22px]">{v}</div>
    </div>
  );
}

function TimeSavedCard() {
  return (
    <div className="card-pp mt-4" style={{ borderLeft: "3px solid var(--accent)" }}>
      <div className="flex items-center gap-2"><Clock size={16} style={{ color: "var(--accent)" }} /><div className="font-serif text-[18px]">What this saves you per case</div></div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <div className="label-eyebrow">Without Pattern-Proof</div>
          <ul className="mt-2 space-y-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            <li>40h reviewing scattered screenshots & notes</li>
            <li>8h building timelines by hand</li>
            <li>12h interviewing client for exact dates/quotes</li>
            <li>6h organizing evidence for discovery</li>
          </ul>
          <div className="mt-2 text-[13px]"><strong>66h × $300 = $19,800</strong></div>
        </div>
        <div>
          <div className="label-eyebrow">With Pattern-Proof</div>
          <ul className="mt-2 space-y-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            <li>2h reviewing organized incidents</li>
            <li>0h on timeline (auto-generated)</li>
            <li>1h clarifying gaps</li>
            <li>1h preparing court packet</li>
          </ul>
          <div className="mt-2 text-[13px]"><strong>4h × $300 = $1,200</strong></div>
        </div>
      </div>
      <div className="mt-3 rounded-md p-3 text-[13px]" style={{ background: "var(--input)" }}>
        <strong>62 hours saved per case</strong> — a 94% reduction in case prep. More cases, same hours, more revenue.
      </div>
    </div>
  );
}

function NextStepsCard({ onJump, onGenerate }: { onJump: (t: Tab) => void; onGenerate: () => void }) {
  return (
    <div className="card-pp mt-4">
      <div className="font-serif text-[18px]">What to do right now</div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <button onClick={() => onJump("Checklist")} className="rounded-md p-3 text-left text-[13px]" style={{ background: "var(--accent)", color: "var(--sidebar-active)" }}>
          <div className="font-semibold">1. Review checklist</div>
          <div className="mt-1 opacity-90">3 minutes. See how many Stark items are documented.</div>
        </button>
        <button onClick={() => onJump("Gaps")} className="rounded-md p-3 text-left text-[13px]" style={{ background: "#1a2332", color: "#F5F1E6" }}>
          <div className="font-semibold">2. Check gaps</div>
          <div className="mt-1 opacity-90">Know what opposing counsel will attack. Prepare for it.</div>
        </button>
        <button onClick={onGenerate} className="rounded-md p-3 text-left text-[13px]" style={{ background: "var(--sidebar)", color: "var(--sidebar-active)" }}>
          <div className="font-semibold">3. Generate deposition prep</div>
          <div className="mt-1 opacity-90">48h before testimony. Use this to coach your client.</div>
        </button>
      </div>
    </div>
  );
}

function TabGuide({ tab }: { tab: Tab }) {
  const g = TAB_GUIDE[tab];
  const [open, setOpen] = useState(false);
  return (
    <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)} className="mt-4 card-pp">
      <summary className="cursor-pointer text-[13px]"><strong>{g.title}</strong> <span style={{ color: "var(--muted-foreground)" }}>— what this tab does</span></summary>
      <div className="mt-3 space-y-1 text-[13px]">
        <div><span className="label-eyebrow">What you see: </span>{g.see}</div>
        <div><span className="label-eyebrow">What to do: </span>{g.do}</div>
        <div><span className="label-eyebrow">Why it matters: </span>{g.why}</div>
        <div><span className="label-eyebrow">Court value: </span>{g.court}</div>
        {g.flag && <div style={{ color: "var(--primary)" }}><span className="label-eyebrow" style={{ color: "var(--primary)" }}>Red flag: </span>{g.flag}</div>}
      </div>
    </details>
  );
}

function FirstTimeAttorneyModal() {
  const KEY = "pp-attorney-first-case-v1";
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(KEY)) setOpen(true);
  }, []);
  if (!open) return null;
  const close = () => { localStorage.setItem(KEY, "1"); setOpen(false); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }} onClick={close}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl" style={{ background: "var(--card)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5" style={{ background: "linear-gradient(135deg, #1a2332, #243349)", color: "#F5F1E6", borderRadius: "12px 12px 0 0" }}>
          <div>
            <div className="label-eyebrow" style={{ color: "#E8C9BC" }}>Welcome to Pattern-Proof: Counsel</div>
            <h2 className="mt-1 font-serif text-[24px]">You're looking at a forensic pattern analysis</h2>
            <p className="mt-1 text-[13px] opacity-90">This isn't a journal. It's organized evidence architecture.</p>
          </div>
          <button onClick={close} aria-label="Close" className="rounded-full p-1" style={{ background: "rgba(255,255,255,0.1)", color: "#F5F1E6" }}><X size={16} /></button>
        </div>
        <div className="space-y-4 p-5 text-[14px]">
          <p>
            Your client documented their abuse with precision. We analyzed it for patterns, gaps, and credibility.
            Below is everything you need for discovery, deposition prep, and settlement leverage.
          </p>
          <div className="rounded-md p-3" style={{ background: "var(--input)" }}>
            <div className="font-serif text-[16px]">Here's what's here</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px]">
              <li><strong>Patterns</strong> — categorized control mechanisms with frequency counts</li>
              <li><strong>Stark checklist</strong> — coercive control framework documented vs. missing</li>
              <li><strong>Gaps</strong> — what opposing counsel will attack</li>
              <li><strong>Timeline</strong> — month-by-month escalation proof</li>
              <li><strong>Deposition prep</strong> — AI-surfaced weak spots and cross warnings</li>
            </ul>
          </div>
          <div className="rounded-md p-3" style={{ background: "var(--input)" }}>
            <div className="font-serif text-[16px]">Why this is different</div>
            <p className="mt-2 text-[13px]">
              Most DV clients bring shoeboxes of screenshots and a year of fragmented memory. Pattern-Proof clients bring
              a chronologically organized, forensically structured case file — with patterns already identified and
              gaps already flagged. You skip the 60+ hours of reconstruction and go straight to strategy.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={close} className="btn-primary">Open case file</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Overview({ data }: { data: CaseData }) {
  const recent = data.incidents.slice(-8).reverse();
  return (
    <div className="space-y-4">
      {data.case?.pattern_summary && (
        <div className="card-pp">
          <div className="label-eyebrow">Client summary</div>
          <p className="mt-2 whitespace-pre-wrap text-[14px]">{data.case.pattern_summary}</p>
        </div>
      )}
      <div className="card-pp">
        <div className="flex items-center gap-2"><FileText size={16} /><div className="font-serif text-[18px]">Recent incidents</div></div>
        <ul className="mt-3 space-y-2 text-[13px]">
          {recent.length === 0 && <li style={{ color: "var(--muted-foreground)" }}>No incidents documented yet.</li>}
          {recent.map((i) => (
            <li key={i.id} className="border-l-2 pl-3" style={{ borderColor: "var(--accent)" }}>
              <strong>{new Date(i.date).toLocaleDateString()}</strong>
              {i.severity_level ? ` · severity ${i.severity_level}` : ""}
              <div style={{ color: "var(--muted-foreground)" }}>{i.description?.slice(0, 200)}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Patterns({ data }: { data: CaseData }) {
  return (
    <div className="card-pp">
      <div className="flex items-center gap-2"><TrendingUp size={16} /><div className="font-serif text-[18px]">Categorized patterns</div></div>
      {data.categories.length === 0 ? (
        <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>Not enough data to categorize yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {data.categories.sort((a, b) => b.count - a.count).map((c) => {
            const max = Math.max(...data.categories.map((x) => x.count));
            const pct = (c.count / max) * 100;
            return (
              <div key={c.type}>
                <div className="flex justify-between text-[12px]"><span>{c.type}</span><span style={{ color: "var(--muted-foreground)" }}>{c.count}</span></div>
                <div className="mt-1 h-2 rounded-full" style={{ background: "var(--input)" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--primary)" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {data.pattern_analysis?.analysis && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[13px]" style={{ color: "var(--accent)" }}>Raw pattern analysis JSON</summary>
          <pre className="mt-2 max-h-80 overflow-auto rounded-md p-3 text-[11px]" style={{ background: "var(--input)" }}>
{JSON.stringify(data.pattern_analysis.analysis, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

function Checklist({ data }: { data: CaseData }) {
  return (
    <div className="card-pp">
      <div className="font-serif text-[18px]">Coercive control checklist <span className="text-[12px] font-normal" style={{ color: "var(--muted-foreground)" }}>(Stark framework)</span></div>
      <ul className="mt-3 space-y-2">
        {data.checklist.map((row) => (
          <li key={row.item} className="flex items-start gap-2 text-[14px]">
            {row.documented
              ? <CheckCircle2 size={16} style={{ color: "var(--safe)", marginTop: 2 }} />
              : <Circle size={16} style={{ color: "var(--muted-foreground)", marginTop: 2 }} />}
            <div>
              <div>{row.item}</div>
              <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                {row.documented ? `${row.count} incident${row.count === 1 ? "" : "s"} documented` : "No documented incidents"}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Gaps({ data }: { data: CaseData }) {
  return (
    <div className="card-pp">
      <div className="flex items-center gap-2"><AlertTriangle size={16} style={{ color: "var(--primary)" }} /><div className="font-serif text-[18px]">Evidence gaps</div></div>
      {data.gaps.length === 0 ? (
        <p className="mt-2 text-[13px]" style={{ color: "var(--safe)" }}>No critical gaps detected.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-[13px]">
          {data.gaps.map((g, i) => (
            <li key={i} className="border-l-2 pl-3" style={{ borderColor: "var(--primary)" }}>
              <strong>{g.kind}</strong>
              <div style={{ color: "var(--muted-foreground)" }}>{g.detail}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TimelineTab({ data }: { data: CaseData }) {
  return (
    <div className="card-pp">
      <div className="font-serif text-[18px]">Monthly escalation</div>
      <div className="mt-4 space-y-1">
        {data.timeline.length === 0 && <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>No dated incidents yet.</p>}
        {data.timeline.map((m) => {
          const max = Math.max(...data.timeline.map((x) => x.count));
          const pct = (m.count / max) * 100;
          return (
            <div key={m.month} className="flex items-center gap-3 text-[12px]">
              <div className="w-20" style={{ color: "var(--muted-foreground)" }}>{m.month}</div>
              <div className="h-2 flex-1 rounded-full" style={{ background: "var(--input)" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: m.avg_severity >= 3 ? "var(--primary)" : "var(--accent)" }} />
              </div>
              <div className="w-16 text-right">{m.count} · sev {m.avg_severity.toFixed(1)}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-6">
        <div className="label-eyebrow">All incidents</div>
        <ol className="mt-2 space-y-2 text-[13px]">
          {data.incidents.map((i) => (
            <li key={i.id} className="border-l-2 pl-3" style={{ borderColor: "var(--accent)" }}>
              <strong>{new Date(i.date).toLocaleDateString()}</strong>
              {i.severity_level ? ` · sev ${i.severity_level}` : ""}
              {i.abuse_types?.length ? ` · ${i.abuse_types.map(typeLabel).join(", ")}` : ""}
              <div style={{ color: "var(--muted-foreground)" }}>{i.description}</div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function DepoTab({ depo, loading, onRun }: { depo: DepoResult | null; loading: boolean; onRun: () => void }) {
  return (
    <div className="card-pp">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Sparkles size={16} style={{ color: "var(--accent)" }} /><div className="font-serif text-[18px]">AI deposition prep</div></div>
        <button onClick={onRun} disabled={loading} className="btn-primary">
          {loading ? "Analyzing…" : depo ? "Re-run analysis" : "Generate prep"}
        </button>
      </div>
      <p className="mt-2 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
        Surfaces chronology strengths, credibility gaps, and likely cross-examination angles.
      </p>
      {depo && !depo.ok && (
        <p className="mt-4 text-[13px]" style={{ color: "var(--primary)" }}>Couldn't generate: {depo.reason}</p>
      )}
      {depo?.ok && depo.prep && (
        <div className="mt-5 space-y-5 text-[13px]">
          <DepoSection title="Chronology strengths" items={depo.prep.chronology_strengths} />
          <DepoComplex title="Weak spots" items={depo.prep.weak_spots} keys={["issue", "risk", "suggested_fix"]} />
          <DepoComplex title="Credibility gaps" items={depo.prep.credibility_gaps} keys={["gap", "address_before_testimony"]} />
          <DepoSection title="Direct examination questions" items={depo.prep.prep_questions} ordered />
          <DepoSection title="Cross-examination warnings" items={depo.prep.cross_warnings} />
        </div>
      )}
    </div>
  );
}

function DepoSection({ title, items, ordered }: { title: string; items?: string[]; ordered?: boolean }) {
  if (!items?.length) return null;
  const Tag = ordered ? "ol" : "ul";
  return (
    <div>
      <div className="font-serif text-[15px]">{title}</div>
      <Tag className={`mt-1 ${ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5`}>
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </Tag>
    </div>
  );
}

function DepoComplex({ title, items, keys }: { title: string; items?: Array<Record<string, string>>; keys: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="font-serif text-[15px]">{title}</div>
      <ul className="mt-1 space-y-2">
        {items.map((row, i) => (
          <li key={i} className="border-l-2 pl-3" style={{ borderColor: "var(--primary)" }}>
            {keys.map((k) => (
              <div key={k}><span className="label-eyebrow">{k.replace(/_/g, " ")}: </span>{row[k]}</div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}