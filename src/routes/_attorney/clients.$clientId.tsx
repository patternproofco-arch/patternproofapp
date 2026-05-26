import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Circle, FileText, Sparkles, TrendingUp } from "lucide-react";
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
      <Link to="/clients" className="inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--accent)" }}>
        <ArrowLeft size={13} /> All clients
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="label-eyebrow">Case file</div>
          <h1 className="mt-1 font-serif text-[28px]">Client · {clientId.slice(0, 8)}</h1>
        </div>
        <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: riskColor[data.risk_level], color: "var(--sidebar-active)" }}>
          {data.risk_level.toUpperCase()} RISK
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        <Metric label="Incidents" v={data.incidents.length} />
        <Metric label="Evidence" v={data.evidence.length} />
        <Metric label="Last 30d" v={data.last_30_days} />
        <Metric label="Avg severity" v={data.avg_severity.toFixed(1)} />
        <Metric label="Active flags" v={data.flags.filter((f) => !f.dismissed_at).length} />
      </div>

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

function Metric({ label, v }: { label: string; v: number | string }) {
  return (
    <div className="card-pp" style={{ padding: 12 }}>
      <div className="label-eyebrow">{label}</div>
      <div className="mt-1 font-serif text-[22px]">{v}</div>
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