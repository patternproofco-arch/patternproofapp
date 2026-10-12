/* Pure helper: merges shared items into one date-ordered exhibit list. */
import { describeReviewDate, type ReviewDateFields, type ReviewDateInfo } from "@/lib/review-date-certainty";

type Row = Record<string, unknown>;

export interface BinderEntry extends ReviewDateFields {
  id: string;
  kind: "incident" | "evidence" | "request";
  label: string;
  exhibit: string;
  date: string | null;
  /** Kept separate from asserted dates; approximate days are ordering surrogates. */
  sortDate?: string | null;
  dateInfo?: ReviewDateInfo;
  dateProvenance?: "client_event_date" | "request_submission";
  title: string;
  body: string | null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

function dateFields(row: Row): ReviewDateFields & { dateInfo: ReviewDateInfo; sortDate: string | null } {
  const anchor = row.anchor_incident as ReviewDateFields["anchor_incident"];
  const fields: ReviewDateFields = {
    date: str(row.date),
    date_precision: str(row.date_precision),
    date_range_start: str(row.date_range_start),
    date_range_end: str(row.date_range_end),
    anchor_label: str(row.anchor_label),
    anchor_incident: anchor && typeof anchor === "object" ? anchor : null,
  };
  const dateInfo = describeReviewDate(fields);
  return { ...fields, dateInfo, sortDate: dateInfo.sortDate };
}

/** Works with older hand-constructed BinderEntry values as well as enriched entries. */
export function binderDateInfo(entry: BinderEntry): ReviewDateInfo {
  return describeReviewDate(entry);
}

export function formatBinderDate(entry: BinderEntry): string {
  const info = binderDateInfo(entry);
  return entry.dateProvenance === "request_submission" || entry.kind === "request"
    ? `Request submitted: ${info.text}`
    : info.text;
}

/**
 * `exhibitLabels` (item key -> printed label) switches numbering from "position in date
 * order" to the attorney's frozen exhibit package, so adding an earlier-dated item no
 * longer renumbers everything after it. An item missing from the map prints as
 * "Not yet numbered". Without it, behavior is unchanged.
 */
export function buildBinderEntries(
  incidents: Row[],
  evidence: Row[],
  requests: Row[],
  exhibitLabels?: ReadonlyMap<string, string>,
): BinderEntry[] {
  const out: Omit<BinderEntry, "exhibit">[] = [];
  for (const i of incidents) {
    out.push({
      id: String(i.id),
      kind: "incident",
      label: "Documented entry",
      ...dateFields(i),
      date: str(i.date),
      dateProvenance: "client_event_date",
      title: str(i.title) ?? str(i.location) ?? "Journal entry",
      body: str(i.description),
    });
  }
  for (const e of evidence) {
    out.push({
      id: String(e.id),
      kind: "evidence",
      label: "File",
      ...dateFields(e),
      date: str(e.date),
      dateProvenance: "client_event_date",
      title: str(e.title) ?? "Untitled file",
      body: str(e.description) ?? str(e.transcript) ?? str(e.extracted_text),
    });
  }
  for (const r of requests) {
    if (r.status !== "submitted") continue;
    out.push({
      id: String(r.id),
      kind: "request",
      label: "Answered request",
      ...dateFields({ date: str(r.submitted_at)?.slice(0, 10) ?? null }),
      date: str(r.submitted_at)?.slice(0, 10) ?? null,
      dateProvenance: "request_submission",
      title: str(r.title) ?? "Request",
      body: str(r.response_note),
    });
  }
  out.sort((a, b) => {
    if (a.sortDate === b.sortDate) return 0;
    if (!a.sortDate) return 1;
    if (!b.sortDate) return -1;
    return a.sortDate.localeCompare(b.sortDate);
  });
  return out.map((e, n) => ({
    ...e,
    exhibit: exhibitLabels
      ? (exhibitLabels.get(`${e.kind}:${e.id}`) ?? "Not yet numbered")
      : `Exhibit ${n + 1}`,
  }));
}
