import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  analyzePatterns,
  getLatestPatternAnalysis,
  setPatternClaimStatus,
  type ClaimReviewState,
  type PatternAnalysisResult,
} from "@/lib/pattern-analysis.functions";
import { CognitiveClose } from "@/components/CognitiveClose";

export const Route = createFileRoute("/_authenticated/escalation-detector")({
  component: SeverityIndicatorsPage,
});

type IncMap = Record<string, { date: string | null; description: string }>;
type Status = ClaimReviewState["status"];

function SeverityIndicatorsPage() {
  const { user } = useAuth();
  const getLatest = useServerFn(getLatestPatternAnalysis);
  const runAnalyze = useServerFn(analyzePatterns);
  const setStatus = useServerFn(setPatternClaimStatus);

  const [loading, setLoading] = useState(true);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<PatternAnalysisResult | null>(null);
  const [reviewed, setReviewed] = useState<Record<string, ClaimReviewState>>({});
  const [incidents, setIncidents] = useState<IncMap>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [res, incRes] = await Promise.all([
      getLatest(),
      supabase.from("incidents").select("id,date,description").eq("user_id", user.id).is("deleted_at", null),
    ]);
    const map: IncMap = {};
    (incRes.data ?? []).forEach((i) => { map[i.id] = { date: i.date, description: i.description ?? "" }; });
    setIncidents(map);
    if (res.found) {
      setAnalysisId(res.id);
      setAnalysis(res.analysis);
      setReviewed(res.reviewed_status ?? {});
    } else {
      setAnalysisId(null); setAnalysis(null); setReviewed({});
    }
    setLoading(false);
  }, [user, getLatest]);

  useEffect(() => { load(); }, [load]);

  const regenerate = async () => {
    setGenerating(true);
    try {
      const r = await runAnalyze({ data: { force: true } });
      if (!r.ok) {
        toast(r.reason === "not-enough-data" ? "Add at least two confirmed incidents first." : "We couldn't refresh the analysis just now.");
      } else {
        toast("Analysis refreshed.");
        await load();
      }
    } finally { setGenerating(false); }
  };

  const updateStatus = async (key: string, status: Status, edited_note?: string) => {
    if (!analysisId) return;
    setBusy(key);
    try {
      const r = await setStatus({ data: { analysis_id: analysisId, claim_key: key, status, edited_note } });
      if (r.ok) setReviewed(r.reviewed_status);
    } finally { setBusy(null); setEditing(null); setEditText(""); }
  };

  const indicators = analysis?.severity_indicators ?? [];

  return (
    <div>
      <div className="label-eyebrow">Documented Severity Indicators</div>
      <h1 className="mt-2 font-serif text-[30px]">What your <em>own records</em> already document.</h1>
      <p className="mt-3 max-w-2xl text-[14px]" style={{ color: "var(--muted-foreground)" }}>
        These items come from your confirmed incidents. Each one is drawn from a specific record you wrote — it is documented in your records, not a prediction or clinical assessment. Confirm, edit, reject, or mark each item as unsure so your case reflects your judgment.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <button className="btn-ghost" onClick={regenerate} disabled={generating}>
          {generating ? "Refreshing…" : "Refresh analysis"}
        </button>
        <Link to="/patterns" className="btn-ghost">Back to pattern analysis</Link>
      </div>

      {loading ? (
        <div className="card-pp mt-6">Loading your records…</div>
      ) : !analysis ? (
        <div className="card-pp mt-6">
          <p style={{ color: "var(--muted-foreground)" }}>
            No pattern analysis yet. Once you have at least two confirmed incidents, run the analysis on the pattern page and this view will populate.
          </p>
          <div className="mt-3"><Link to="/patterns" className="btn-primary">Open pattern analysis</Link></div>
        </div>
      ) : indicators.length === 0 ? (
        <div className="card-pp mt-6">
          <p style={{ color: "var(--muted-foreground)" }}>
            Your confirmed incidents don't currently document the specific behaviors this view surfaces (for example descriptions of strangulation, weapons, or threats to kill). If any incident actually contains one of these and it isn't showing here, edit the incident to include the specifics and refresh the analysis.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {indicators.map((s, i) => {
            const key = `sev:${i}`;
            const state = reviewed[key]?.status ?? "unsure";
            const isEditing = editing === key;
            const editedNote = reviewed[key]?.edited_note;
            return (
              <div key={key} className="card-pp" style={{ borderLeft: `3px solid ${STATUS_COLOR[state]}` }}>
                <div className="flex items-start justify-between gap-3">
                  <div style={{ flex: 1 }}>
                    <div className="font-serif text-[17px]">{s.label}</div>
                    <p className="mt-1 text-[13px] leading-relaxed">{s.note}</p>
                    {editedNote && (
                      <div className="mt-2 rounded-md px-3 py-2 text-[12px]" style={{ background: "var(--input)" }}>
                        <span className="label-eyebrow" style={{ display: "block", marginBottom: 4 }}>Your note</span>
                        {editedNote}
                      </div>
                    )}
                    <div className="mt-2 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                      Drawn from{" "}
                      {s.source_incident_ids.map((id, idx) => {
                        const inc = incidents[id];
                        return (
                          <span key={id}>
                            {idx > 0 && ", "}
                            {inc && inc.date ? (
                              <Link
                                to="/journal"
                                search={{ focus: id }}
                                style={{ color: "var(--foreground)", textDecoration: "underline" }}
                              >
                                {new Date(inc.date).toLocaleDateString()}
                              </Link>
                            ) : (
                              <span>this incident</span>
                            )}
                          </span>
                        );
                      })}
                      .
                    </div>
                  </div>
                  <div className="text-[11px] uppercase tracking-wide" style={{ color: STATUS_COLOR[state], fontWeight: 600 }}>
                    {STATUS_LABEL[state]}
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      className="input-pp"
                      rows={3}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      placeholder="Rewrite this in your own words. Your note is stored alongside the original."
                    />
                    <div className="flex gap-2">
                      <button className="btn-primary" disabled={busy === key || !editText.trim()} onClick={() => updateStatus(key, "edited", editText.trim())}>
                        Save note
                      </button>
                      <button className="btn-ghost" onClick={() => { setEditing(null); setEditText(""); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-ghost text-[12px]" disabled={busy === key} onClick={() => updateStatus(key, "confirmed")}>Confirm</button>
                    <button className="btn-ghost text-[12px]" disabled={busy === key} onClick={() => { setEditing(key); setEditText(editedNote ?? ""); }}>Edit</button>
                    <button className="btn-ghost text-[12px]" disabled={busy === key} onClick={() => updateStatus(key, "rejected")} style={{ color: "var(--primary)" }}>Reject</button>
                    <button className="btn-ghost text-[12px]" disabled={busy === key} onClick={() => updateStatus(key, "unsure")}>Unsure</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="card-pp mt-8" style={{ background: "var(--sidebar)" }}>
        <div className="font-serif text-[18px]" style={{ color: "#FAF7F2" }}>If you need help now</div>
        <p className="mt-2 text-[14px]" style={{ color: "#FAF7F2" }}>
          National DV Hotline: <strong style={{ color: "#FFFFFF" }}>1-800-799-7233</strong>
        </p>
        <p className="text-[14px]" style={{ color: "#FAF7F2" }}>
          Crisis Text Line: text <strong style={{ color: "#FFFFFF" }}>START</strong> to 678-678
        </p>
      </div>
      <CognitiveClose
        title="Bring this into your case file"
        body="The case builder pulls confirmed incidents into a packet your attorney can read in minutes."
        cta="Open case builder"
        to="/case-builder"
      />
    </div>
  );
}

const STATUS_COLOR: Record<Status, string> = {
  unsure: "#B6A38A",
  confirmed: "#A8D8B9",
  rejected: "#8A5A2E",
  edited: "#5B4CD6",
};
const STATUS_LABEL: Record<Status, string> = {
  unsure: "Unsure",
  confirmed: "Confirmed",
  rejected: "Rejected",
  edited: "Edited",
};