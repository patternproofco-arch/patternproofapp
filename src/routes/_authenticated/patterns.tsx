import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, RefreshCw, AlertCircle, Printer, Square } from "lucide-react";
import {
  analyzePatterns,
  getLatestPatternAnalysis,
  setPatternClaimStatus,
  type PatternAnalysisResult,
  type ClaimReviewState,
} from "@/lib/pattern-analysis.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MarkDensityBar } from "@/components/MarkDensityBar";
import { SafetyResourcesLink } from "@/components/SafetyResourcesLink";
import { FrequencyObservations } from "@/components/FrequencyObservations";
import { HubTabs, RECURLINE_TABS } from "@/components/HubTabs";

export const Route = createFileRoute("/_authenticated/patterns")({
  component: PatternsPage,
});

function PatternsPage() {
  const { user } = useAuth();
  const fetchLatest = useServerFn(getLatestPatternAnalysis);
  const runAnalysis = useServerFn(analyzePatterns);
  const setClaimStatus = useServerFn(setPatternClaimStatus);
  const [analysis, setAnalysis] = useState<PatternAnalysisResult | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState<Record<string, ClaimReviewState>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notEnough, setNotEnough] = useState(false);
  const [marks, setMarks] = useState<Array<{ date: string | null }>>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("incidents")
        .select("date")
        .eq("user_id", user.id)
        .is("deleted_at", null);
      setMarks(data ?? []);
    })();
  }, [user]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchLatest();
        if (r.found) {
          setAnalysis(r.analysis);
          setCreatedAt(r.createdAt);
          setAnalysisId(r.id);
          setReviewed(r.reviewed_status ?? {});
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
        setAnalysisId(r.id);
        setReviewed(r.reviewed_status ?? {});
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

  const updateClaim = async (
    key: string,
    status: ClaimReviewState["status"],
    edited_note?: string,
  ) => {
    if (!analysisId) return;
    const prev = reviewed;
    setReviewed({ ...prev, [key]: { status, edited_note: edited_note ?? prev[key]?.edited_note } });
    try {
      const r = await setClaimStatus({
        data: { analysis_id: analysisId, claim_key: key, status, edited_note },
      });
      if (r.ok) setReviewed(r.reviewed_status);
    } catch {
      setReviewed(prev);
      toast("Couldn't save your review. Try again.");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <HubTabs tabs={RECURLINE_TABS} />
          <div className="label-eyebrow">Recurline</div>
          <h1 className="mt-2 font-serif text-[34px] leading-tight">
            What the record <em>shows.</em>
          </h1>
          <p className="mt-3 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
            Quiet, calm trends from your own Marks. Not a diagnosis. Not a legal conclusion. Just
            what's there.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 md:items-end no-print">
          <span
            className="text-[12px] font-semibold md:text-right"
            style={{ color: "var(--muted-foreground)" }}
          >
            Ready to see what your patterns reveal?
          </span>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              onClick={() => run(true)}
              disabled={busy}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[14px] font-bold transition-all hover:-translate-y-px disabled:opacity-60"
              style={{
                background: "var(--sidebar)",
                color: "var(--sidebar-active)",
                letterSpacing: "0.02em",
                boxShadow: "var(--pp-shadow-sm)",
              }}
            >
              {busy ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {busy ? "Analyzing…" : analysis ? "Refresh Recurline" : "Build My Recurline"}
            </button>
            {analysis && (
              <button
                onClick={() => window.print()}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-[13px] font-semibold"
                style={{ borderColor: "var(--border)", background: "transparent" }}
              >
                <Printer size={15} /> Print / PDF
              </button>
            )}
          </div>
          {createdAt && (
            <span
              className="text-[11px] md:text-right"
              style={{ color: "var(--muted-foreground)" }}
            >
              Last updated {new Date(createdAt).toLocaleString()}
            </span>
          )}
          {!analysis && !createdAt && (
            <span
              className="text-[11px] md:text-right"
              style={{ color: "var(--muted-foreground)" }}
            >
              First time? This groups your Marks by what keeps recurring.
            </span>
          )}
        </div>
      </div>

      {loading && (
        <p className="mt-6 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
          Loading…
        </p>
      )}

      {notEnough && (
        <div className="card-pp mt-6" style={{ borderLeft: "3px solid var(--accent)" }}>
          <p className="text-[14px]">
            Add at least two Marks and try again. Patterns need a little ground to stand on.
          </p>
          <Link to="/journal" className="btn-primary mt-3 inline-block">
            Add a Mark
          </Link>
        </div>
      )}

      {!loading && !analysis && !notEnough && (
        <div className="card-pp mt-6">
          <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
            When you're ready, build your Recurline. Your Marks stay private — only patterns come
            back.
          </p>
        </div>
      )}

      {analysis && (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {/* 1. Count header — a count of your own entries, nothing more. */}
          {typeof analysis.corroborating_incident_count === "number" && (
            <div className="card-pp lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="label-eyebrow">Entries counted in this record</div>
                <span
                  className="inline-flex items-center rounded-2xl px-4 py-2 text-[12px] font-bold"
                  style={{
                    background: "var(--input)",
                    color: "var(--foreground)",
                    boxShadow: "var(--pp-shadow-sm)",
                  }}
                  title="A count of your entries — not a rating or a conclusion"
                >
                  Corroborating incidents: {analysis.corroborating_incident_count}
                </span>
              </div>
            </div>
          )}

          <div className="card-pp lg:col-span-2">
            <div className="label-eyebrow">Summary</div>
            <p className="mt-2 font-serif text-[18px] leading-relaxed">
              {analysis.pattern_summary}
            </p>
          </div>

          {/* 3. Evidence Supporting This Pattern */}
          {analysis.evidence_list && analysis.evidence_list.length > 0 && (
            <div className="card-pp lg:col-span-2">
              <div className="label-eyebrow">Evidence supporting this pattern</div>
              <ul className="mt-3 space-y-3">
                {analysis.evidence_list.map((e, i) => (
                  <li key={i} className="text-[14px] leading-relaxed">
                    <span className="font-bold">{e.date}</span> — {e.description}{" "}
                    <span
                      className="ml-1 inline-block rounded-2xl px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                      style={{ background: "var(--input)", color: "var(--muted-foreground)" }}
                    >
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
                    <span
                      className="rounded-2xl px-3 py-1.5"
                      style={{ background: "var(--input)" }}
                    >
                      {seg.trim()}
                    </span>
                    {i < arr.length - 1 && (
                      <span style={{ color: "var(--muted-foreground)" }}>→</span>
                    )}
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
                {analysis.common_triggers.map((t, i) => (
                  <li key={i}>· {t}</li>
                ))}
              </ul>
            </div>
          )}
          {(analysis.escalation_before ||
            analysis.escalation_during ||
            analysis.escalation_after) && (
            <div className="card-pp">
              <div className="label-eyebrow">Before, during, after</div>
              <div className="mt-2 space-y-2 text-[14px] leading-relaxed">
                {analysis.escalation_before && (
                  <p>
                    <span className="font-bold">Before: </span>
                    {analysis.escalation_before}
                  </p>
                )}
                {analysis.escalation_during && (
                  <p>
                    <span className="font-bold">During: </span>
                    {analysis.escalation_during}
                  </p>
                )}
                {analysis.escalation_after && (
                  <p>
                    <span className="font-bold">After: </span>
                    {analysis.escalation_after}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="card-pp" style={{ borderLeft: "3px solid var(--primary)" }}>
            <div className="label-eyebrow">Change over time · {analysis.severity_trajectory}</div>
            <p className="mt-2 text-[14px] leading-relaxed">{analysis.escalation_arc}</p>
          </div>

          <div className="card-pp" style={{ borderLeft: "3px solid var(--accent)" }}>
            <div className="label-eyebrow">Frequency over time</div>
            <div className="mt-3 space-y-2">
              {analysis.frequency_trends.map((t, i) => (
                <div key={i} className="flex items-baseline justify-between gap-3">
                  <div>
                    <div className="font-serif text-[15px]">{t.period}</div>
                    {t.note && (
                      <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                        {t.note}
                      </div>
                    )}
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
                    <span style={{ color: "var(--muted-foreground)" }}>
                      {b.count} · {b.percent.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "var(--input)" }}>
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${Math.min(100, b.percent)}%`, background: "var(--accent)" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {analysis.gaps.length > 0 && (
            <div
              className="card-pp lg:col-span-2"
              style={{ borderLeft: "3px solid var(--primary)" }}
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={16} style={{ color: "var(--primary)" }} />
                <div className="label-eyebrow">Gaps you might want to fill</div>
              </div>
              <div className="mt-3 space-y-3">
                {analysis.gaps.map((g, i) => (
                  <div key={i}>
                    <div className="font-serif text-[15px]">{g.gap}</div>
                    <div className="mt-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                      {g.suggestion}
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/journal" className="btn-primary mt-4 inline-block">
                Add a Mark
              </Link>
            </div>
          )}

          {analysis.suggested_followups.length > 0 && (
            <div className="card-pp lg:col-span-2">
              <div className="label-eyebrow">Next documentation steps</div>
              <ul className="mt-3 space-y-2 text-[14px]">
                {analysis.suggested_followups.map((s, i) => (
                  <li key={i}>· {s}</li>
                ))}
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
                    <Square
                      size={16}
                      className="mt-0.5 flex-shrink-0"
                      style={{ color: "var(--muted-foreground)" }}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 10. Attorney Summary */}
          {analysis.attorney_summary && (
            <div
              className="lg:col-span-2 rounded-2xl p-6"
              style={{
                background: "var(--pp-ground)",
                boxShadow: "var(--pp-shadow-sm)",
                opacity: reviewed["attorney_summary"]?.status === "rejected" ? 0.5 : 1,
              }}
            >
              <div
                className="text-[11px] font-bold uppercase tracking-[0.15em]"
                style={{ color: "var(--pp-muted)" }}
              >
                For legal review
              </div>
              <h3 className="mt-1 font-serif text-[20px]" style={{ color: "var(--pp-ink)" }}>
                Attorney summary
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "var(--pp-ink)" }}>
                {analysis.attorney_summary}
              </p>
              <ClaimReview
                claimKey="attorney_summary"
                state={reviewed["attorney_summary"]}
                onUpdate={updateClaim}
                tone="dark"
              />
            </div>
          )}

          {/* 11. Safety Note — always */}
          <div
            className="lg:col-span-2 rounded-2xl p-5 text-[12px] leading-relaxed"
            style={{ background: "var(--input)", color: "var(--muted-foreground)" }}
          >
            Recurline is based only on the Marks and evidence you've added to PatternProof. It is
            not a guarantee, legal advice, or a safety plan. If you believe you are in immediate
            danger, contact emergency services, a domestic violence advocate, or your attorney.
          </div>
        </div>
      )}

      <div className="card-pp mt-8">
        <div className="label-eyebrow">Mark density</div>
        <p className="mt-1 mb-3 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          A visual view of how often Marks appear over time, and how recent they are. Shading only —
          no score, no assessment.
        </p>
        <MarkDensityBar marks={marks} />
        <SafetyResourcesLink />
      </div>

      <FrequencyObservations />
    </div>
  );
}

/* ---------- Claim review control (Confirm / Edit / Reject / Unsure) ---------- */

const STATUS_LABEL: Record<ClaimReviewState["status"], string> = {
  unsure: "Unsure",
  confirmed: "Confirmed",
  rejected: "Rejected",
  edited: "Edited",
};

function ClaimReview({
  claimKey,
  state,
  onUpdate,
  tone = "light",
}: {
  claimKey: string;
  state: ClaimReviewState | undefined;
  onUpdate: (
    key: string,
    status: ClaimReviewState["status"],
    edited_note?: string,
  ) => Promise<void>;
  tone?: "light" | "dark";
}) {
  const status = state?.status ?? "unsure";
  const editedNote = state?.edited_note;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(editedNote ?? "");
  const [busy, setBusy] = useState(false);

  const call = async (s: ClaimReviewState["status"], note?: string) => {
    setBusy(true);
    try {
      await onUpdate(claimKey, s, note);
    } finally {
      setBusy(false);
      setEditing(false);
    }
  };

  const mutedColor = tone === "dark" ? "var(--pp-muted)" : "var(--muted-foreground)";

  return (
    <div className="mt-4 no-print">
      {status === "rejected" && (
        <div className="mb-2 text-[12px] italic" style={{ color: mutedColor }}>
          You marked this as not accurate.
        </div>
      )}
      {editedNote && !editing && (
        <div
          className="mb-2 rounded-2xl px-3 py-2 text-[12px]"
          style={{ background: tone === "dark" ? "var(--pp-ground-lo, var(--pp-ground))" : "var(--input)" }}
        >
          <span className="label-eyebrow" style={{ display: "block", marginBottom: 4 }}>
            Your note
          </span>
          {editedNote}
        </div>
      )}
      {editing ? (
        <div className="space-y-2">
          <textarea
            className="input-pp"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Rewrite this in your own words. Your note is stored alongside the original."
          />
          <div className="flex gap-2">
            <button
              className="btn-primary"
              disabled={busy || !text.trim()}
              onClick={() => call("edited", text.trim())}
            >
              Save note
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                setEditing(false);
                setText(editedNote ?? "");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-[11px] uppercase tracking-wide"
            style={{ color: mutedColor, fontWeight: 600 }}
          >
            {STATUS_LABEL[status]}
          </span>
          <button
            className="btn-ghost text-[12px]"
            disabled={busy}
            onClick={() => call("confirmed")}
          >
            Confirm
          </button>
          <button
            className="btn-ghost text-[12px]"
            disabled={busy}
            onClick={() => {
              setEditing(true);
              setText(editedNote ?? "");
            }}
          >
            Edit
          </button>
          <button
            className="btn-ghost text-[12px]"
            disabled={busy}
            onClick={() => call("rejected")}
            style={{ color: "var(--primary)" }}
          >
            {status === "rejected" ? "Un-reject" : "Reject"}
          </button>
          <button className="btn-ghost text-[12px]" disabled={busy} onClick={() => call("unsure")}>
            Unsure
          </button>
        </div>
      )}
    </div>
  );
}
