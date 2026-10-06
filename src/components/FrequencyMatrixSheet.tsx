import { useMemo, useState, type ReactNode } from "react";
import { Copy, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  MATRIX_EMPTY,
  MATRIX_NOTES,
  MATRIX_SUBTITLE,
  MATRIX_TITLE,
  TIME_BLOCKS,
  buildFrequencyMatrix,
  formatDay,
  frequencyMatrixToText,
  periodTableHeader,
  rangeLine,
  summaryLine,
  type MatrixInputMessage,
} from "@/lib/frequency-matrix";

export interface FrequencyMatrixSheetProps {
  messages: MatrixInputMessage[];
  conversation: string;
  source?: string | null;
  importedAt?: string | null;
  truncated?: boolean;
  /** Approved exhibit package version when the attorney has fixed numbers. */
  packageVersion?: number | null;
  packageBlockedReason?: string | null;
  /** Back link or other controls shown above the sheet on screen only. */
  toolbarStart?: ReactNode;
}

const cell = "border border-black/20 px-1.5 py-0.5 text-right tabular-nums";
const headCell = "border border-black/20 px-1.5 py-0.5 text-right font-semibold align-bottom";
const firstCell = "border border-black/20 px-1.5 py-0.5 text-left whitespace-nowrap";

/**
 * One printed page: period-by-sender counts, a day-of-week by time-of-day
 * grid, and plain notes. Every number comes from buildFrequencyMatrix.
 */
export function FrequencyMatrixSheet({
  messages,
  conversation,
  source,
  importedAt,
  truncated,
  packageVersion,
  packageBlockedReason,
  toolbarStart,
}: FrequencyMatrixSheetProps) {
  const matrix = useMemo(() => buildFrequencyMatrix(messages), [messages]);
  const [exhibitLabel, setExhibitLabel] = useState("");
  const generatedOn = useMemo(() => formatDay(new Date().toISOString().slice(0, 10)), []);
  const importedOn = importedAt ? formatDay(importedAt.slice(0, 10)) : null;
  const range = rangeLine(matrix);

  const copy = async () => {
    if (packageBlockedReason) {
      toast(packageBlockedReason);
      return;
    }
    const text = frequencyMatrixToText(matrix, {
      conversation,
      source,
      importedOn,
      exhibitLabel,
      generatedOn,
      packageVersion: packageVersion ?? null,
    });
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied as plain text.");
    } catch {
      toast("Couldn't copy here. Try Print instead.");
    }
  };

  return (
    <div className="fm-root mx-auto max-w-4xl p-6 print:max-w-none print:p-0">
      <style>{PRINT_CSS}</style>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>{toolbarStart}</div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted-foreground">
            <span className="mb-1 block">Exhibit label (optional)</span>
            <input
              value={exhibitLabel}
              onChange={(e) => setExhibitLabel(e.target.value.slice(0, 40))}
              placeholder="Exhibit __"
              className="w-36 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={copy}
            disabled={!!packageBlockedReason}
            title={packageBlockedReason ?? undefined}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
          >
            <Copy size={14} /> Copy as text
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!!packageBlockedReason}
            title={packageBlockedReason ?? undefined}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            <Printer size={14} /> Print or save as PDF
          </button>
        </div>
      </div>

      <article className="fm-sheet bg-white text-[11px] leading-snug text-black">
        <header className="mb-3 flex items-start justify-between gap-4 border-b border-black/30 pb-2">
          <div className="min-w-0">
            <h1 className="font-display text-xl leading-tight">{MATRIX_TITLE}</h1>
            <p className="text-[11px] text-black/70">{MATRIX_SUBTITLE}</p>
            <p className="mt-1 text-[11px]">
              <span className="font-semibold">Conversation:</span> {conversation}
              {source ? <span className="text-black/70"> · Source file: {source}</span> : null}
            </p>
            <p className="text-[11px] text-black/70">
              {importedOn ? `Imported ${importedOn} · ` : ""}Prepared {generatedOn}
              {packageVersion != null
                ? ` · Exhibit package v${packageVersion}`
                : " · Exhibit package: none (provisional)"}
            </p>
            {packageBlockedReason ? (
              <p className="mt-1 text-[11px] font-semibold">{packageBlockedReason}</p>
            ) : null}
          </div>
          {exhibitLabel.trim() ? (
            <div className="shrink-0 border border-black px-3 py-1 text-sm font-semibold">
              {exhibitLabel.trim()}
            </div>
          ) : null}
        </header>

        <p className="mb-1">{summaryLine(matrix)}</p>
        {range ? <p className="mb-2 text-black/70">Range: {range}</p> : null}
        {truncated ? (
          <p className="mb-2 font-semibold">
            This conversation is larger than one sheet can read. Counts cover the first{" "}
            {matrix.totals.imported.toLocaleString()} imported messages only.
          </p>
        ) : null}

        {matrix.rows.length === 0 ? (
          <p className="my-6 text-black/70">{MATRIX_EMPTY}</p>
        ) : (
          <>
            <table className="mb-2 w-full border-collapse">
              <thead>
                <tr>
                  {periodTableHeader(matrix).map((h, i) => (
                    <th
                      key={`${i}-${h}`}
                      className={i === 0 ? `${firstCell} font-semibold` : headCell}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((r) => (
                  <tr key={r.key}>
                    <td className={firstCell}>{r.label}</td>
                    {r.counts.map((n, i) => (
                      <td key={i} className={cell}>
                        {n}
                      </td>
                    ))}
                    <td className={`${cell} font-semibold`}>{r.total}</td>
                    <td className={cell}>{r.earlyHours}</td>
                    <td className={cell}>{r.daysWithMessages}</td>
                  </tr>
                ))}
                <tr className="bg-black/5 font-semibold">
                  <td className={firstCell}>All periods</td>
                  {matrix.columns.map((c) => (
                    <td key={c.key} className={cell}>
                      {c.total}
                    </td>
                  ))}
                  <td className={cell}>{matrix.totals.dated}</td>
                  <td className={cell}>{matrix.totals.earlyHours}</td>
                  <td className={cell}>
                    {matrix.rows.reduce((n, r) => n + r.daysWithMessages, 0)}
                  </td>
                </tr>
              </tbody>
            </table>
            {matrix.busiestDay ? (
              <p className="mb-3">
                Highest single-day count: {matrix.busiestDay.count} on{" "}
                {formatDay(matrix.busiestDay.date)}
              </p>
            ) : null}

            <h2 className="mb-1 text-[12px] font-semibold">
              Day of week by time of day (messages with a date)
            </h2>
            <table className="mb-3 border-collapse">
              <thead>
                <tr>
                  <th className={`${firstCell} font-semibold`}>Day</th>
                  {TIME_BLOCKS.map((b) => (
                    <th key={b} className={headCell}>
                      {b}
                    </th>
                  ))}
                  <th className={headCell}>Time not shown</th>
                  <th className={headCell}>Total</th>
                </tr>
              </thead>
              <tbody>
                {matrix.weekGrid.map((w) => (
                  <tr key={w.day}>
                    <td className={firstCell}>{w.day}</td>
                    {w.counts.map((n, i) => (
                      <td key={i} className={cell}>
                        {n}
                      </td>
                    ))}
                    <td className={cell}>{w.noTime}</td>
                    <td className={`${cell} font-semibold`}>{w.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <footer className="border-t border-black/30 pt-2 text-[10px] text-black/75">
          <p className="mb-0.5 font-semibold">Notes</p>
          <ul className="list-disc pl-4">
            {MATRIX_NOTES.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </footer>
      </article>
    </div>
  );
}

// Letter page, half-inch margins. Survivor and attorney shells both narrow
// their main column on screen; on paper the sheet uses the full width.
const PRINT_CSS = `
.fm-sheet p, .fm-sheet li, .fm-sheet td, .fm-sheet th { font-size: inherit; line-height: 1.35; }
.fm-sheet h2 { font-family: inherit; }
@media print {
  @page { size: letter; margin: 0.5in; }
  html, body, .fm-root { background: #fff !important; }
  .pp-app-shell { background: #fff !important; }
  .pp-app-shell > div[aria-hidden][style*="fixed"] { display: none !important; }
  .pp-app-main, .att-content, .att-main { max-width: none !important; padding: 0 !important; }
  .fm-root { padding: 0 !important; }
  .fm-sheet { font-size: 9.5px !important; }
  .fm-sheet p, .fm-sheet li, .fm-sheet td, .fm-sheet th { font-size: 9.5px !important; line-height: 1.25 !important; }
  .fm-sheet h1 { font-size: 16px !important; }
  .fm-sheet h2 { font-size: 10.5px !important; }
  .fm-sheet table { page-break-inside: avoid; }
}
`;
