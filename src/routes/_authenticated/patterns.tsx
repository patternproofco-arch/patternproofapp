import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, RefreshCw, AlertCircle, Printer, Square, ShieldAlert, ArrowRight } from "lucide-react";
import { analyzePatterns, getLatestPatternAnalysis, type PatternAnalysisResult } from "@/lib/pattern-analysis.functions";

function confidenceColor(level?: string) {
  if (level === "Strong") return { bg: "#DCEFD9", fg: "#1F5132", border: "#7FB97A" };
  if (level === "Moderate") return { bg: "#DCE7F2", fg: "#1F3A5C", border: "#7FA3CC" };
  return { bg: "#F5E2BE", fg: "#5C4318", border: "#C99B45" };
}

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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="label-eyebrow">Pattern analysis</div>
          <h1 className="mt-2 font-serif text-[34px] leading-tight">What the record <em>shows.</em></h1>
          <p className="mt-3 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
            Quiet, calm trends from your own entries. Not a diagnosis. Not a legal conclusion. Just what's there.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 md:items-end no-print">
          <span className="text-[12px] font-semibold md:text-right" style={{ color: "var(--muted-foreground)" }}>
            Ready to see what your patterns reveal?
          </span>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              onClick={() => run(true)}
              disabled={busy}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-[14px] font-bold transition-all hover:-translate-y-px disabled:opacity-60"
              style={{ background: "var(--sidebar)", color: "var(--sidebar-active)", letterSpacing: "0.02em", boxShadow: "0 6px 18px rgba(26,20,14,0.22)" }}
            >
              {busy ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {busy ? "Analyzing…" : analysis ? "Refresh Analysis" : "Analyze My Patterns"}
            </button>
            {analysis && (
              <button
                onClick={() => window.print()}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-4 text-[13px] font-semibold"
                style={{ borderColor: "var(--border)", background: "transparent" }}
              >
                <Printer size={15} /> Print / PDF
              </button>
            )}
          </div>
          {createdAt && (
            <span className="text-[11px] md:text-right" style={{ color: "var(--muted-foreground)" }}>
              Last updated {new Date(createdAt).toLocaleString()}
            </span>
          )}
          {!analysis && !createdAt && (
            <span className="text-[11px] md:text-right" style={{ color: "var(--muted-foreground)" }}>
              First time? This analyzes your entries for behavioral patterns.
            </span>
          )}
        </div>
      </div>

      {loading && <p className="mt-6 text-[14px]" style={{ color: "var(--muted-foreground)" }}>Loading…</p>}

      <Link
        to="/escalation-detector"
        className="mt-6 flex items-start gap-4 rounded-xl p-4 transition-all hover:-translate-y-px no-print"
        style={{ background: "var(--input)", border: "1px solid var(--border)" }}
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg" style={{ background: "#B5523A", color: "#FFFFFF" }} aria-hidden>
          <ShieldAlert size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-serif text-[16px] leading-tight" style={{ color: "var(--foreground)" }}>
            Documented Severity Indicators
          </div>
          <p className="mt-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            Specific behaviors your confirmed records document, with source citations.
          </p>
        </div>
        <ArrowRight size={16} className="mt-1 shrink-0" style={{ color: "var(--muted-foreground)" }} />
      </Link>

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
          {/* 1. Report header bar */}
          {(analysis.main_pattern_label || analysis.confidence_level) && (() => {
            const c = confidenceColor(analysis.confidence_level);
            return (
              <div className="card-pp lg:col-span-2 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="label-eyebrow">Primary pattern detected</div>
                  <h2 className="mt-1 font-serif text-[26px] leading-tight">{analysis.main_pattern_label}</h2>
                  {analysis.secondary_patterns && analysis.secondary_patterns.length > 0 && (
                    <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                      Also detected: {analysis.secondary_patterns.join(" · ")}
                    </p>
                  )}
                </div>
                {analysis.confidence_level && (
                  <span className="inline-flex items-center rounded-full px-4 py-2 text-[12px] font-bold uppercase tracking-wide" style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}>
                    {analysis.confidence_level} confidence
                  </span>
                )}
              </div>
            );
          })()}

          <div className="card-pp lg:col-span-2">
            <div className="label-eyebrow">Summary</div>
            <p className="mt-2 font-serif text-[18px] leading-relaxed">{analysis.pattern_summary}</p>
          </div>

          {/* 2. What This Pattern May Be Showing */}
          {analysis.what_pattern_may_show && (
            <div className="card-pp lg:col-span-2">
              <div className="label-eyebrow">What this pattern may be showing</div>
              <p className="mt-2 font-serif text-[17px] leading-relaxed">{analysis.what_pattern_may_show}</p>
            </div>
          )}

          {/* 3. Evidence Supporting This Pattern */}
          {analysis.evidence_list && analysis.evidence_list.length > 0 && (
            <div className="card-pp lg:col-span-2">
              <div className="label-eyebrow">Evidence supporting this pattern</div>
              <ul className="mt-3 space-y-3">
                {analysis.evidence_list.map((e, i) => (
                  <li key={i} className="text-[14px] leading-relaxed">
                    <span className="font-bold">{e.date}</span> — {e.description}{" "}
                    <span className="ml-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide" style={{ background: "var(--input)", color: "var(--muted-foreground)" }}>
                      {e.category}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 4. Pattern Timeline */}
          {analysis.pattern_timeline_text && (
            <div className="card-pp lg:col-span-2">
              <div className="label-eyebrow">Pattern timeline</div>
              <div className="mt-3 flex flex-wrap items-center gap-2 font-serif text-[15px]">
                {analysis.pattern_timeline_text.split(/→|->/).map((seg, i, arr) => (
                  <span key={i} className="flex items-center gap-2">
                    <span className="rounded-md px-3 py-1.5" style={{ background: "var(--input)" }}>{seg.trim()}</span>
                    {i < arr.length - 1 && <span style={{ color: "var(--muted-foreground)" }}>→</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 5. Triggers + Escalation phases */}
          {analysis.common_triggers && analysis.common_triggers.length > 0 && (
            <div className="card-pp" style={{ borderLeft: "3px solid var(--accent)" }}>
              <div className="label-eyebrow">Common triggers</div>
              <ul className="mt-2 space-y-1 text-[14px]">
                {analysis.common_triggers.map((t, i) => <li key={i}>· {t}</li>)}
              </ul>
            </div>
          )}
          {(analysis.escalation_before || analysis.escalation_during || analysis.escalation_after) && (
            <div className="card-pp">
              <div className="label-eyebrow">Escalation cycle</div>
              <div className="mt-2 space-y-2 text-[14px] leading-relaxed">
                {analysis.escalation_before && <p><span className="font-bold">Before: </span>{analysis.escalation_before}</p>}
                {analysis.escalation_during && <p><span className="font-bold">During: </span>{analysis.escalation_during}</p>}
                {analysis.escalation_after && <p><span className="font-bold">After: </span>{analysis.escalation_after}</p>}
              </div>
            </div>
          )}

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

          {/* 9. What to Document Next */}
          {analysis.what_to_document_next && analysis.what_to_document_next.length > 0 && (
            <div className="card-pp lg:col-span-2">
              <div className="label-eyebrow">What to document next</div>
              <ul className="mt-3 space-y-2 text-[14px]">
                {analysis.what_to_document_next.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Square size={16} className="mt-0.5 flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 10. Attorney Summary */}
          {analysis.attorney_summary && (
            <div className="lg:col-span-2 rounded-2xl p-6" style={{ background: "#EEF2F7", border: "1px solid #C8D3E2" }}>
              <div className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: "#3A4A66" }}>For legal review</div>
              <h3 className="mt-1 font-serif text-[20px]" style={{ color: "#1F2A3D" }}>Attorney summary</h3>
              <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "#1F2A3D" }}>{analysis.attorney_summary}</p>
            </div>
          )}

          {/* 11. Safety Note — always */}
          <div className="lg:col-span-2 rounded-xl p-5 text-[12px] leading-relaxed" style={{ background: "var(--input)", color: "var(--muted-foreground)" }}>
            Pattern forecasts are based only on the evidence uploaded into PatternProof. They are not guarantees, legal advice, or safety plans. If you believe you are in immediate danger, contact emergency services, a domestic violence advocate, or your attorney.
          </div>
        </div>
      )}
    </div>
  );
}