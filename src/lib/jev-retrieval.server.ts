import {
  JEV_CANDIDATE_LIMIT,
  permitsJev,
  type JevRequestProposal,
  type JevSourceField,
} from "./jev-proposals";

export type JevEvidence = {
  id: string;
  title: string;
  description: string | null;
  mime: string | null;
  file_type: string;
  ai_permission: string;
  is_sealed: boolean;
  transcript: string | null;
  transcript_status: string;
  extracted_text: string | null;
};
export type RankedJevSource = JevRequestProposal & { score: number; format: string };
const STOP = new Set(
  "a an and are as at be by can could document documents file files for from have i in is it me my of on or please record records send share shared that the their them these this to us was we with would you your".split(
    " ",
  ),
);
export function requestTerms(request: string) {
  return [
    ...new Set(
      request
        .normalize("NFKC")
        .toLowerCase()
        .match(/[\p{L}\p{N}]{3,}/gu) ?? [],
    ),
  ].filter((t) => !STOP.has(t));
}
export async function jevFingerprint(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Local lexical retrieval scans the complete saved text; only the selected window leaves the server. */
export async function rankJevSource(
  row: JevEvidence,
  terms: string[],
): Promise<RankedJevSource | null> {
  if (!permitsJev(row) || !terms.length) return null;
  const fields: Array<[JevSourceField, string, number]> = [
    ["title", row.title, 4],
    ["description", row.description ?? "", 2],
    [
      row.transcript_status === "ready" && row.transcript ? "transcript" : "extracted_text",
      row.transcript_status === "ready" && row.transcript
        ? row.transcript
        : (row.extracted_text ?? ""),
      1,
    ],
  ];
  let score = 0;
  let best: { field: JevSourceField; text: string; start: number; score: number } | null = null;
  for (const [field, text, weight] of fields) {
    // Unicode token boundaries avoid matching e.g. "rent" inside "different".
    const tokens = [...text.matchAll(/[\p{L}\p{N}]+/gu)];
    const hits = tokens.filter((m) => terms.includes(m[0].normalize("NFKC").toLowerCase()));
    score += new Set(hits.map((m) => m[0].normalize("NFKC").toLowerCase())).size * weight;
    let left = 0,
      right = 0;
    const windowTerms = new Map<string, number>();
    for (const hit of hits) {
      const start = Math.max(0, hit.index! - 160),
        end = start + 1000;
      while (right < hits.length && hits[right].index! < end) {
        const term = hits[right++][0].normalize("NFKC").toLowerCase();
        windowTerms.set(term, (windowTerms.get(term) ?? 0) + 1);
      }
      while (left < right && hits[left].index! < start) {
        const term = hits[left++][0].normalize("NFKC").toLowerCase();
        const count = windowTerms.get(term)! - 1;
        if (count) windowTerms.set(term, count);
        else windowTerms.delete(term);
      }
      if (!best || windowTerms.size > best.score)
        best = { field, text, start, score: windowTerms.size };
    }
  }
  if (!best || !score) return null;
  return {
    evidenceId: row.id,
    title: row.title.slice(0, 200),
    score,
    format: row.mime || row.file_type,
    excerpt: best.text.slice(best.start, best.start + 1000),
    excerptStart: best.start,
    sourceField: best.field,
    sourceRevision: await jevFingerprint(row),
  };
}
export function topJevSources(sources: RankedJevSource[]) {
  return sources
    .sort((a, b) => b.score - a.score || a.evidenceId.localeCompare(b.evidenceId))
    .slice(0, JEV_CANDIDATE_LIMIT);
}
