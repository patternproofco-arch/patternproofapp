import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { analyzePatterns, getLatestPatternAnalysis, type PatternAnalysisResult } from "@/lib/pattern-analysis.functions";

export const Route = createFileRoute("/_authenticated/patterns")({
  component: PatternsPage,
});

function PatternsPage() {
  const fetchLatest = useServerFn(getLatestPatternAnalysis);
  const runAnalysis = useServerFn(analyzePatterns);
  const [analysis, setAnalysis] = useState<PatternAnalysisResult | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notEnough, setNotEnough] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchLatest();
        if (r.found) {
          setAnalysis(r.analysis);
          setCreatedAt(r.createdAt);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchLatest]);

  const run = async (force: boolean) => {
    setBusy(true);
    setNotEnough(false);
    try {
      const r = await runAnalysis({ data: { force } });
      if (r.ok) {
        setAnalysis(r.analysis);
        setCreatedAt(new Date().toISOString());
        if (!r.cached) toast("New analysis ready.");
      } else if (r.reason === "not-enough-data") {
        setNotEnough(true);
      } else if (r.reason === "rate-limit") {
        toast("We're being rate-limited. Try again in a moment.");
      } else if (r.reason === "credits") {
        toast("AI credits exhausted. Add credits in Settings to continue.");
      } else {
        toast("Couldn't run analysis. Try again in a moment.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="label-eyebrow">Pattern analysis</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">What the record <em>shows.</em></h1>
      <p className="mt-3 max-w-2xl text-[14px]" style={{ color: "var(--muted-foreground)" }}>
        Quiet, calm trends from your own entries. Not a diagnosis. Not a legal conclusion. Just what's there.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button onClick={() => run(true)} disabled={busy} className="btn-primary inline-flex items-center gap-2">
          {busy ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {analysis ? "Refresh analysis" : "Run analysis"}
        </button>
        {createdAt && (
          <span className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            Last updated {new Date(createdAt).toLocaleString()}
          </span>
        )}
      </div>

      {loading && <p className="mt-6 text-[14px]" style={{ color: "var(--muted-foreground)" }}>Loading…</p>}

      {notEnough && (
        <div className="card-pp mt-6" style={{ borderLeft: "3px solid var(--accent)" }}>
          <p className="text-[14px]">Log at least two incidents and try again. Patterns need a little ground to stand on.</p>
          <Link to="/journal" className="btn-primary mt-3 inline-block">Log an incident</Link>
        </div>
      )}

      {!loading && !analysis && !notEnough && (
        <div className="card-pp mt-6">
          <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
            When you're ready, run an analysis. Your entries stay private — only patterns come back.
          </p>
        </div>
      )}

      {analysis && (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="card-pp lg:col-span-2">
            <div className="label-eyebrow">Summary</div>
            <p className="mt-2 font-serif text-[18px] leading-relaxed">{analysis.pattern_summary}</p>
          </div>

          <div className="card-pp" style={{ borderLeft: "3px solid var(--primary)" }}>
            <div className="label-eyebrow">Escalation arc · {analysis.severity_trajectory}</div>
            <p className="mt-2 text-[14px] leading-relaxed">{analysis.escalation_arc}</p>
          </div>

          <div className="card-pp" style={{ borderLeft: "3px solid var(--accent)" }}>
            <div className="label-eyebrow">Frequency over time</div>
            <div className="mt-3 space-y-2">
              {analysis.frequency_trends.map((t, i) => (
                <div key={i} className="flex items-baseline justify-between gap-3">
                  <div>
                    <div className="font-serif text-[15px]">{t.period}</div>
                    {t.note && <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>{t.note}</div>}
                  </div>
                  <div className="font-serif text-[20px]">{t.count}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-pp lg:col-span-2">
            <div className="label-eyebrow">Type breakdown</div>
            <div className="mt-3 space-y-2">
              {analysis.abuse_type_breakdown.map((b) => (
                <div key={b.type}>
                  <div className="mb-1 flex items-baseline justify-between text-[13px]">
                    <span>{b.type}</span>
                    <span style={{ color: "var(--muted-foreground)" }}>{b.count} · {b.percent.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "var(--input)" }}>
                    <div className="h-2 rounded-full" style={{ width: `${Math.min(100, b.percent)}%`, background: "var(--accent)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {analysis.gaps.length > 0 && (
            <div className="card-pp lg:col-span-2" style={{ borderLeft: "3px solid var(--primary)" }}>
              <div className="flex items-center gap-2"><AlertCircle size={16} style={{ color: "var(--primary)" }} /><div className="label-eyebrow">Gaps you might want to fill</div></div>
              <div className="mt-3 space-y-3">
                {analysis.gaps.map((g, i) => (
                  <div key={i}>
                    <div className="font-serif text-[15px]">{g.gap}</div>
                    <div className="mt-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>{g.suggestion}</div>
                  </div>
                ))}
              </div>
              <Link to="/journal" className="btn-primary mt-4 inline-block">Add an entry</Link>
            </div>
          )}

          {analysis.suggested_followups.length > 0 && (
            <div className="card-pp lg:col-span-2">
              <div className="label-eyebrow">Next documentation steps</div>
              <ul className="mt-3 space-y-2 text-[14px]">
                {analysis.suggested_followups.map((s, i) => <li key={i}>· {s}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}