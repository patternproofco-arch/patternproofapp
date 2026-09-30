/* Pure helper: merges shared items into one date-ordered exhibit list. */

type Row = Record<string, unknown>;

export interface BinderEntry {
  id: string;
  kind: "incident" | "evidence" | "request";
  label: string;
  exhibit: string;
  date: string | null;
  title: string;
  body: string | null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

export function buildBinderEntries(
  incidents: Row[],
  evidence: Row[],
  requests: Row[],
): BinderEntry[] {
  const out: Omit<BinderEntry, "exhibit">[] = [];
  for (const i of incidents) {
    out.push({
      id: String(i.id),
      kind: "incident",
      label: "Documented entry",
      date: str(i.date),
      title: str(i.title) ?? str(i.location) ?? "Journal entry",
      body: str(i.description),
    });
  }
  for (const e of evidence) {
    out.push({
      id: String(e.id),
      kind: "evidence",
      label: "File",
      date: str(e.date) ?? str(e.created_at)?.slice(0, 10) ?? null,
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
      date: str(r.submitted_at)?.slice(0, 10) ?? null,
      title: str(r.title) ?? "Request",
      body: str(r.response_note),
    });
  }
  out.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });
  return out.map((e, n) => ({ ...e, exhibit: `Exhibit ${n + 1}` }));
}
