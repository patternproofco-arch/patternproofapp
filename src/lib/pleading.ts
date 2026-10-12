/* Pure helper: turns binder entries into neutral, numbered declaration paragraphs. */
import { binderDateInfo, type BinderEntry } from "@/lib/binder";

function clip(text: string | null, max = 280): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function pleadingParagraph(e: BinderEntry, n: number): string {
  const when = binderDateInfo(e).lead;
  const summary = clip(e.body);
  const noun =
    e.kind === "evidence" ? "a file titled" : e.kind === "request" ? "an answered request titled" : "an entry titled";
  // A file's event date must not be asserted to be its upload/creation date.
  const lead = e.kind === "evidence"
    ? `${n}. The client provided ${noun} "${e.title}". Recorded event timing: ${binderDateInfo(e).text}.`
    : e.kind === "request"
      ? `${n}. ${when}, the client submitted ${noun} "${e.title}" (request submission date, not an event date).`
      : `${n}. ${when}, the client's entry titled "${e.title}" records the following.`;
  const detail = summary ? ` The client's record reads: "${summary}"` : "";
  return `${lead}${detail} See ${e.exhibit}.`;
}

export function buildPleadingText(entries: BinderEntry[]): string {
  const header =
    "DRAFT FACTUAL CHRONOLOGY — for attorney review and editing. User-reviewed, not court-verified.";
  return [header, "", ...entries.map((e, i) => pleadingParagraph(e, i + 1))].join("\n\n");
}
