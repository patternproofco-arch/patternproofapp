/* Pure helper: turns binder entries into neutral, numbered declaration paragraphs. */
import type { BinderEntry } from "@/lib/binder";

function formatDate(d: string | null): string {
  if (!d) return "an undated occasion";
  const parsed = new Date(`${d.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function clip(text: string | null, max = 280): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function pleadingParagraph(e: BinderEntry, n: number): string {
  const when = formatDate(e.date);
  const summary = clip(e.body);
  const noun =
    e.kind === "evidence" ? "a file titled" : e.kind === "request" ? "an answered request titled" : "an entry titled";
  const lead = `${n}. On ${when}, the client documented ${noun} "${e.title}".`;
  const detail = summary ? ` The client's record reads: "${summary}"` : "";
  return `${lead}${detail} See ${e.exhibit}.`;
}

export function buildPleadingText(entries: BinderEntry[]): string {
  const header =
    "DRAFT FACTUAL CHRONOLOGY — for attorney review and editing. User-reviewed, not court-verified.";
  return [header, "", ...entries.map((e, i) => pleadingParagraph(e, i + 1))].join("\n\n");
}
