import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getOrgGrantReport, type GrantReport as Report } from "@/lib/org-grant-report.functions";
import {
  formatDvCategoryValue,
  dvCategoriesToCsvRows,
  type DvFunderCategoryRow,
} from "@/lib/org-grant-report-categories";
import { csvCell } from "@/lib/csv-safe";

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

function showMetric(report: Report, k: keyof Report): string {
  if (k === "dv_categories" || k === "org_name" || k === "from" || k === "to") return "";
  const v = report[k];
  if (v === null || v === undefined) return "Not enough data";
  return String(v);
}

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

  const downloadCsv = () => {
    if (!report) return;
    const lines: string[][] = [
      ["Measure", "Value"],
      ["Period", `${report.from} to ${report.to}`],
      ["Organization", report.org_name ?? "Your organization"],
    ];
    for (const [k, label] of ROWS) lines.push([label, showMetric(report, k)]);
    lines.push([]);
    lines.push(["DV funder categories (VOCA / VAWA / FVPSA / STOP)"]);
    lines.push([
      "Totals only. Mapped from PatternProof activity — not certified program outcomes.",
    ]);
    const cats = report.dv_categories ?? [];
    for (const row of dvCategoriesToCsvRows(cats)) lines.push(row);
    const csv = lines
      .map((r) => r.map((c) => csvCell(c)).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `grant-report-${report.from}-to-${report.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const categories: DvFunderCategoryRow[] = report?.dv_categories ?? [];

  return (
    <section className="card" style={{ padding: 20 }}>
      <div className="label-eyebrow">Grant report</div>
      <h2 className="mt-1 font-serif text-[22px]">Numbers for funding applications</h2>
      <p className="mt-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
        Totals only. No names, no case contents. Any count from 1 to 4 shows as &quot;fewer
        than 5&quot; to protect privacy. DV funder category rows restate these totals under
        VOCA / VAWA / FVPSA / STOP-style labels — they are not certified program outcomes.
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
                <dd className="font-semibold">{showMetric(report, k)}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6">
            <h3 className="font-serif text-[18px]">DV funder categories</h3>
            <p className="mt-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              Pre-labeled rows Harbor Legal Group and peer org admins can paste into VOCA,
              VAWA, FVPSA, and STOP-style funder forms. Same privacy floor as above.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b">
                    <th className="py-1 pr-3 font-semibold">Program</th>
                    <th className="py-1 pr-3 font-semibold">Category</th>
                    <th className="py-1 pr-3 font-semibold">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((row) => (
                    <tr key={row.id} className="border-b align-top">
                      <td className="py-1.5 pr-3 whitespace-nowrap">{row.funder_program}</td>
                      <td className="py-1.5 pr-3">{row.category_label}</td>
                      <td className="py-1.5 pr-3 font-semibold whitespace-nowrap">
                        {formatDvCategoryValue(row.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              Soft claim: mapped from PatternProof activity totals for this period — not a
              certified program outcome or funding decision.
            </p>
          </div>

          <div className="no-print mt-4 flex gap-2">
            <button className="btn-ghost" onClick={() => window.print()}>Print</button>
            <button className="btn-ghost" onClick={downloadCsv}>Download spreadsheet</button>
          </div>
        </>
      )}
    </section>
  );
}
