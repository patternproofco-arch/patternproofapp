import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, RefreshCw, ShieldAlert } from "lucide-react";
import { analyzePatterns, getLatestPatternAnalysis, type PatternAnalysisResult } from "@/lib/pattern-analysis.functions";

export const Route = createFileRoute("/_authenticated/abuser-tactics")({
  head: () => ({
    meta: [
      { title: "Behaviors you've documented — PatternProof" },
      { name: "description", content: "Recurring behaviors you have reported, counted from your own records. Not a finding about anyone." },
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
        if (!r.cached) toast("Refreshed from your records.");
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
          <div className="label-eyebrow">Behaviors you've documented</div>
          <h1 className="mt-2 font-serif text-[34px] leading-tight">What you've <em>reported.</em></h1>
          <p className="mt-3 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
            Behaviors that come up more than once across the entries you've written, grouped and
            counted. These are your own reports read back to you — not a finding, a diagnosis,
            or a conclusion about anyone.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 md:items-end">
          <button
            onClick={() => run(true)}
            disabled={busy}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[2px] px-5 text-[14px] font-bold transition-all hover:-translate-y-px disabled:opacity-60"
            style={{
              background: "var(--sidebar)",
              color: "var(--sidebar-active)",
              letterSpacing: "0.02em",
              boxShadow: "none",
            }}
          >
            {busy ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {busy ? "Reading your records…" : analysis ? "Refresh" : "Group my entries"}
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
          <p className="text-[14px]">Add at least two entries first. Repetition needs a little ground to stand on.</p>
          <Link to="/journal" className="btn-primary mt-3 inline-block">Log an incident</Link>
        </div>
      )}

      {!loading && analysis && tactics.length === 0 && (
        <div className="card-pp mt-6">
          <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
            Nothing repeated clearly enough to group last time. Try again after adding more detail to recent
            entries — what was said, how it was said, what happened right before and after.
          </p>
        </div>
      )}

      {!loading && !analysis && !notEnough && (
        <div className="card-pp mt-6">
          <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
            When you're ready, we'll group what you've written and show you what comes up most often.
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
                  className="rounded-[2px] px-2.5 py-0.5 text-[11px] font-bold"
                  style={{ background: "var(--input)", color: "var(--foreground)" }}
                  title="Number of your entries that describe this"
                >
                  {t.examples_count} {t.examples_count === 1 ? "entry" : "entries"}
                </span>
              </div>
              <p className="mt-3 text-[14px] leading-relaxed">
                You've reported this on {t.examples_count} {t.examples_count === 1 ? "occasion" : "occasions"}. {t.description}
              </p>
              <div className="mt-3 rounded-[2px] p-3 text-[13px]" style={{ background: "var(--input)" }}>
                <div className="label-eyebrow">Why it may be worth tracking</div>
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
            Everything on this page comes from entries you wrote yourself. PatternProof does not
            investigate, verify, diagnose, or label anyone, and nothing here is a finding that any
            behavior occurred or that it amounts to abuse under any legal or clinical standard.
            Those determinations belong to a court or a licensed professional reviewing your records.
          </p>
        </div>
      )}
    </div>
  );
}