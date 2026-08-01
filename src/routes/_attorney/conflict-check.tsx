import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { checkConflict } from "@/lib/conflict-check.functions";

export const Route = createFileRoute("/_attorney/conflict-check")({
  component: ConflictCheckPage,
});

type Result = Awaited<ReturnType<typeof checkConflict>>;

function ConflictCheckPage() {
  const run = useServerFn(checkConflict);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = name.trim();
    if (q.length < 2 || busy) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await run({ data: { opposingPartyName: q } }));
    } catch {
      setResult(null);
      setError("We couldn't run that check. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 880, margin: "0 auto" }}>
      <div>
        <div className="att-eyebrow">Practice · Screening</div>
        <h1 className="att-page-title">Conflict check</h1>
        <p style={{ fontSize: 13, color: "var(--att-text-2)", marginTop: 6, lineHeight: 1.6 }}>
          Compare a proposed opposing party against the opposing parties recorded in your own current caseload.
        </p>
      </div>

      <form onSubmit={onSubmit} className="att-card" style={{ display: "grid", gap: 10 }}>
        <label className="att-eyebrow" htmlFor="opposing-party">Proposed opposing party name</label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            id="opposing-party"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jordan A. Whitfield"
            className="att-input"
            style={{ flex: "1 1 320px", minWidth: 220 }}
          />
          <button type="submit" className="att-btn-primary" disabled={busy || name.trim().length < 2}>
            <Search size={13} style={{ marginRight: 6 }} />
            {busy ? "Checking…" : "Check my caseload"}
          </button>
        </div>
      </form>

      <div
        className="att-card"
        style={{
          background: "var(--att-surface-2)",
          borderColor: "var(--att-border-strong)",
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <AlertTriangle size={18} style={{ color: "var(--att-navy)", marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontSize: 13, color: "var(--att-text-2)", lineHeight: 1.6, margin: 0 }}>
          This is a screening aid based on name similarity across your own current clients. It is not a legal
          conflicts-of-interest determination — confirm independently before proceeding.
        </p>
      </div>

      {error && (
        <div className="att-card" style={{ fontSize: 13, color: "var(--att-text-2)" }}>{error}</div>
      )}

      {result && (
        <div className="att-card">
          <div className="att-eyebrow" style={{ marginBottom: 10 }}>
            Results for “{result.query}” · scope: your caseload
          </div>
          {result.matches.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--att-text-2)", margin: 0 }}>
              No matches found in your current caseload.
            </p>
          ) : (
            <table className="att-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Case</th>
                  <th style={{ textAlign: "left" }}>Opposing party</th>
                  <th style={{ textAlign: "left" }}>Matched on</th>
                  <th style={{ textAlign: "left" }}>Match</th>
                </tr>
              </thead>
              <tbody>
                {result.matches.map((m, i) => (
                  <tr key={`${m.case_ref}-${i}`}>
                    <td className="att-mono">{m.case_ref}</td>
                    <td>{m.other_party ?? "—"}</td>
                    <td style={{ color: "var(--att-text-2)", fontSize: 12 }}>
                      {m.matched_on === "other_party" ? "Opposing party" : `Case name${m.case_name ? ` · ${m.case_name}` : ""}`}
                    </td>
                    <td>
                      <span
                        className="att-mono"
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          border: "1px solid var(--att-border-strong)",
                          color: "var(--att-navy)",
                        }}
                      >
                        {m.match_type === "exact" ? "EXACT" : "FUZZY"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
