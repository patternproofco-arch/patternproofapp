import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getOrgGrantReport, type GrantReport as Report } from "@/lib/org-grant-report.functions";

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

const ROWS: Array<[keyof Report, string]> = [
  ["people_served", "People served"],
  ["cases_opened", "Cases opened"],
  ["cases_closed", "Cases closed"],
  ["cases_active_end", "Cases active at end of period"],
  ["follow_ups_created", "Follow-ups made"],
  ["follow_ups_completed", "Follow-ups completed"],
  ["referrals", "Referrals recorded"],
  ["avg_days_to_first_follow_up", "Average days to first follow-up"],
  ["advocates", "Team members"],
];

export function GrantReport() {
  const run = useServerFn(getOrgGrantReport);
  const now = new Date();
  const [from, setFrom] = useState(isoDay(new Date(now.getFullYear(), 0, 1)));
  const [to, setTo] = useState(isoDay(now));
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      setReport(await run({ data: { from, to } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't build the report. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const show = (v: unknown) => (v === null || v === undefined ? "Not enough data" : String(v));

  const downloadCsv = () => {
    if (!report) return;
    const lines = [["Measure", "Value"], ["Period", `${report.from} to ${report.to}`]];
    for (const [k, label] of ROWS) lines.push([label, show(report[k])]);
    const csv = lines.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `grant-report-${report.from}-to-${report.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card" style={{ padding: 20 }}>
      <div className="label-eyebrow">Grant report</div>
      <h2 className="mt-1 font-serif text-[22px]">Numbers for funding applications</h2>
      <p className="mt-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
        Totals only. No names, no case contents. Any count from 1 to 4 shows as &quot;fewer
        than 5&quot; to protect privacy.
      </p>
      <div className="no-print mt-3 flex flex-wrap items-end gap-3">
        <label className="text-[13px]">
          From
          <input type="date" className="input ml-2" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-[13px]">
          To
          <input type="date" className="input ml-2" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button className="btn-primary" onClick={go} disabled={busy}>
          {busy ? "Building…" : "Build report"}
        </button>
      </div>
      {error && <p className="mt-3 text-[14px]">{error}</p>}
      {report && (
        <>
          <p className="mt-4 text-[13px]">
            {report.org_name ?? "Your organization"} · {report.from} to {report.to}
          </p>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            {ROWS.map(([k, label]) => (
              <div key={k} className="flex justify-between gap-3 border-b py-1 text-[14px]">
                <dt>{label}</dt>
                <dd className="font-semibold">{show(report[k])}</dd>
              </div>
            ))}
          </dl>
          <div className="no-print mt-4 flex gap-2">
            <button className="btn-ghost" onClick={() => window.print()}>Print</button>
            <button className="btn-ghost" onClick={downloadCsv}>Download spreadsheet</button>
          </div>
        </>
      )}
    </section>
  );
}
