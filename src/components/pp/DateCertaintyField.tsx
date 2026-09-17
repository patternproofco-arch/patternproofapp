import type { ChangeEvent } from "react";

/**
 * Shared "when did this happen?" control.
 *
 * Nothing in PatternProof forces a date onto a record. This is the one place
 * that vocabulary lives, so evidence, imports and the journal all offer the
 * same choices and store the same values.
 */
export type DatePrecision =
  "exact" | "approximate_month" | "range" | "before_anchor" | "after_anchor" | "unknown";

export interface DateCertaintyValue {
  date_precision: DatePrecision;
  /** Used when precision is "exact". */
  date: string;
  /** YYYY-MM, used when precision is "approximate_month". */
  approx_month: string;
  date_range_start: string;
  date_range_end: string;
  /** Free text like "around when my daughter started school". */
  anchor_label: string;
}

export const EMPTY_DATE_CERTAINTY: DateCertaintyValue = {
  date_precision: "exact",
  date: "",
  approx_month: "",
  date_range_start: "",
  date_range_end: "",
  anchor_label: "",
};

const OPTIONS: Array<{ value: DatePrecision; label: string }> = [
  { value: "exact", label: "I know the date" },
  { value: "approximate_month", label: "Around a certain month" },
  { value: "range", label: "Somewhere between two dates" },
  { value: "before_anchor", label: "Before something else I remember" },
  { value: "after_anchor", label: "After something else I remember" },
  { value: "unknown", label: "I'm not sure — leave it undated" },
];

/**
 * Best-effort sortable date so undated and approximate records still land
 * somewhere sensible on the timeline. Never shown as a bare date.
 */
export function deriveSortDate(v: DateCertaintyValue): string | null {
  if (v.date_precision === "exact") return v.date || null;
  if (v.date_precision === "approximate_month")
    return v.approx_month ? `${v.approx_month}-15` : null;
  if (v.date_precision === "range") return v.date_range_start || v.date_range_end || null;
  return null;
}

/** Shape ready to spread into an `evidence` insert/update. */
export function toEvidenceDateFields(v: DateCertaintyValue) {
  const anchored = v.date_precision === "before_anchor" || v.date_precision === "after_anchor";
  return {
    date: deriveSortDate(v),
    date_precision: v.date_precision,
    date_range_start: v.date_precision === "range" ? v.date_range_start || null : null,
    date_range_end: v.date_precision === "range" ? v.date_range_end || null : null,
    anchor_label: anchored ? v.anchor_label.trim() || null : null,
  };
}

export function fromEvidenceDateFields(row: {
  date?: string | null;
  date_precision?: string | null;
  date_range_start?: string | null;
  date_range_end?: string | null;
  anchor_label?: string | null;
}): DateCertaintyValue {
  const p = (row.date_precision as DatePrecision | null) ?? "exact";
  return {
    date_precision: p,
    date: p === "exact" ? (row.date ?? "") : "",
    approx_month: p === "approximate_month" && row.date ? row.date.slice(0, 7) : "",
    date_range_start: row.date_range_start ?? "",
    date_range_end: row.date_range_end ?? "",
    anchor_label: row.anchor_label ?? "",
  };
}

interface Props {
  value: DateCertaintyValue;
  onChange: (next: DateCertaintyValue) => void;
  /** Optional label override for the top select. */
  label?: string;
  compact?: boolean;
}

export function DateCertaintyField({
  value,
  onChange,
  label = "When did this happen?",
  compact,
}: Props) {
  const set = (patch: Partial<DateCertaintyValue>) => onChange({ ...value, ...patch });
  const handle =
    (key: keyof DateCertaintyValue) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      set({ [key]: e.target.value } as Partial<DateCertaintyValue>);
  const anchored =
    value.date_precision === "before_anchor" || value.date_precision === "after_anchor";

  return (
    <div className="space-y-2">
      <div>
        <label className="label-eyebrow">{label}</label>
        <select
          value={value.date_precision}
          onChange={handle("date_precision")}
          className="input-pp mt-1"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {!compact && (
          <p className="mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
            Pick whatever you actually remember. It&apos;s fine not to be certain.
          </p>
        )}
      </div>

      {value.date_precision === "exact" && (
        <div>
          <label className="label-eyebrow">Date</label>
          <input
            type="date"
            value={value.date}
            onChange={handle("date")}
            className="input-pp mt-1"
          />
        </div>
      )}

      {value.date_precision === "approximate_month" && (
        <div>
          <label className="label-eyebrow">Month</label>
          <input
            type="month"
            value={value.approx_month}
            onChange={handle("approx_month")}
            className="input-pp mt-1"
          />
        </div>
      )}

      {value.date_precision === "range" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-eyebrow">From</label>
            <input
              type="date"
              value={value.date_range_start}
              onChange={handle("date_range_start")}
              className="input-pp mt-1"
            />
          </div>
          <div>
            <label className="label-eyebrow">To</label>
            <input
              type="date"
              value={value.date_range_end}
              onChange={handle("date_range_end")}
              className="input-pp mt-1"
            />
          </div>
        </div>
      )}

      {anchored && (
        <div>
          <label className="label-eyebrow">
            {value.date_precision === "before_anchor" ? "Before what?" : "After what?"}
          </label>
          <input
            type="text"
            value={value.anchor_label}
            onChange={handle("anchor_label")}
            className="input-pp mt-1"
            placeholder="around when my daughter started school"
          />
        </div>
      )}

      {value.date_precision === "unknown" && (
        <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
          This will be kept with your undated records. You can add a date later if it comes back to
          you.
        </p>
      )}
    </div>
  );
}
