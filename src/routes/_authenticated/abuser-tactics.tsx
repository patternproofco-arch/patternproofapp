import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, RefreshCw, ShieldAlert } from "lucide-react";
import { analyzePatterns, getLatestPatternAnalysis, type PatternAnalysisResult } from "@/lib/pattern-analysis.functions";

export const Route = createFileRoute("/_authenticated/abuser-tactics")({
  head: () => ({
    meta: [
      { title: "Abuser tactics — PatternProof" },
      { name: "description", content: "Recurring tactics the other party is using, drawn from your own records." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AbuserTacticsPage,
});

function AbuserTacticsPage() {
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
        if (!r.cached) toast("Tactics refreshed.");
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

  const tactics = analysis?.abuser_tactics ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="label-eyebrow">Abuser tactics</div>
          <h1 className="mt-2 font-serif text-[34px] leading-tight">What they're <em>doing.</em></h1>
          <p className="mt-3 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
            Recurring tactics drawn from your own records — DARVO, gaslighting, love-bombing,
            isolation, intimidation, monitoring, and more. Not a diagnosis. Just the patterns
            showing up in what you've already documented.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 md:items-end">
          <button
            onClick={() => run(true)}
            disabled={busy}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-[14px] font-bold transition-all hover:-translate-y-px disabled:opacity-60"
            style={{
              background: "var(--sidebar)",
              color: "var(--sidebar-active)",
              letterSpacing: "0.02em",
              boxShadow: "none",
            }}
          >
            {busy ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {busy ? "Analyzing…" : analysis ? "Refresh tactics" : "Identify tactics"}
          </button>
          {createdAt && (
            <span className="text-[11px] md:text-right" style={{ color: "var(--muted-foreground)" }}>
              Last updated {new Date(createdAt).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {loading && <p className="mt-6 text-[14px]" style={{ color: "var(--muted-foreground)" }}>Loading…</p>}

      {notEnough && (
        <div className="card-pp mt-6" style={{ borderLeft: "3px solid var(--accent)" }}>
          <p className="text-[14px]">Log at least two incidents to surface tactics. Patterns need a little ground to stand on.</p>
          <Link to="/journal" className="btn-primary mt-3 inline-block">Log an incident</Link>
        </div>
      )}

      {!loading && analysis && tactics.length === 0 && (
        <div className="card-pp mt-6">
          <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
            Your last analysis didn't surface specific tactics. Refresh after adding more detail to recent entries
            (what was said, how it was said, what happened right before and after).
          </p>
        </div>
      )}

      {!loading && !analysis && !notEnough && (
        <div className="card-pp mt-6">
          <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
            When you're ready, run an analysis to see which tactics show up most in your records.
          </p>
        </div>
      )}

      {tactics.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {tactics.map((t, i) => (
            <div key={i} className="card-pp" style={{ borderLeft: "3px solid var(--primary)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} style={{ color: "var(--primary)" }} />
                  <div className="font-serif text-[20px] leading-tight">{t.tactic}</div>
                </div>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                  style={{ background: "var(--input)", color: "var(--foreground)" }}
                  title="Approximate incidents where this shows up"
                >
                  {t.examples_count}×
                </span>
              </div>
              <p className="mt-3 text-[14px] leading-relaxed">{t.description}</p>
              <div className="mt-3 rounded-md p-3 text-[13px]" style={{ background: "var(--input)" }}>
                <div className="label-eyebrow">Why it matters</div>
                <p className="mt-1 leading-relaxed">{t.why_it_matters}</p>
              </div>
              {t.example_dates && t.example_dates.length > 0 && (
                <div className="mt-3 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                  Example dates: {t.example_dates.join(" · ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tactics.length > 0 && (
        <div className="card-pp mt-6" style={{ borderLeft: "3px solid var(--accent)" }}>
          <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            This is pattern recognition, not a diagnosis of the other person. PatternProof
            does not label individuals — it surfaces recurring behaviors that show up across
            your own entries.
          </p>
        </div>
      )}
    </div>
  );
}