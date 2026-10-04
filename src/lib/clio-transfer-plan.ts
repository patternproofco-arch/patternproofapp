/**
 * Clio transfer plan (pure).
 *
 * Decides, before anything is sent, exactly which documents go to Clio, under
 * which names, and which items are NOT going and why. Nothing is dropped quietly:
 * every shared item ends up either as a planned document or in `excluded` with a
 * reason the attorney sees on the review screen and in the job record.
 *
 *  - one document per numbered exhibit (the file itself, or a plain-text page for an
 *    entry or answered request), named with the exhibit number from the frozen package;
 *  - one exhibit index, uploaded last;
 *  - an optional ZIP of the whole binder;
 *  - an item with no frozen number is not sent (a number is never invented for it);
 *  - a name already used in the matter for different content gets a "revised" suffix,
 *    so an earlier copy (and any edits an attorney made to it in Clio) is never replaced.
 */

import { renderChronologyRow, type ChronologyRow } from "@/lib/chronology";

export type PlanKind = "exhibit" | "index" | "zip";

export type PlannedItem = {
  seq: number;
  kind: PlanKind;
  itemKey: string | null;
  exhibitNumber: number | null;
  documentName: string;
  /** Change marker at plan time. A transfer step refuses to send changed content. */
  marker: string | null;
  /** How the bytes are produced at send time. */
  source: "evidence_file" | "text_page" | "index" | "zip";
  note: string | null;
};

export type ExcludedItem = {
  itemKey: string;
  label: string;
  reason: "not_numbered";
  message: string;
};

export type EvidenceFileInfo = {
  /** Lower-case extension without the dot, when the stored path has one. */
  extension: string | null;
};

export type PriorDocument = {
  documentName: string;
  marker: string | null;
};

export const MAX_NAME = 120;

function cleanTitle(title: string): string {
  return (
    title
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60)
      .trim() || "Untitled"
  );
}

export function exhibitNumberLabel(n: number): string {
  return String(n).padStart(3, "0");
}

export function documentNameFor(row: ChronologyRow, ext: string): string {
  const n = row.exhibit.number!;
  const date = row.date.sortDate ?? "undated";
  const base = `Exhibit ${exhibitNumberLabel(n)} - ${date} - ${cleanTitle(row.title)}`;
  return `${base.slice(0, MAX_NAME - ext.length - 1).trim()}.${ext}`;
}

export type TransferPlan = {
  packageVersion: number;
  items: PlannedItem[];
  excluded: ExcludedItem[];
  /** Evidence rows whose stored file has no readable path. They are still planned, and fail visibly. */
  filesWithoutPath: string[];
};

export function planTransfer(args: {
  rows: readonly ChronologyRow[];
  packageVersion: number;
  files: ReadonlyMap<string, EvidenceFileInfo | null>;
  prior: readonly PriorDocument[];
  includeZip: boolean;
}): TransferPlan {
  const numbered = args.rows
    .filter((r) => r.exhibit.status === "numbered" && r.exhibit.number !== null)
    .sort((a, b) => a.exhibit.number! - b.exhibit.number!);
  const excluded: ExcludedItem[] = args.rows
    .filter((r) => r.exhibit.status !== "numbered")
    .map((r) => ({
      itemKey: r.key,
      label: r.title,
      reason: "not_numbered" as const,
      message:
        "This item has no fixed exhibit number yet, so it was not sent. Number it in the exhibit package, then send again.",
    }));

  const priorByName = new Map(args.prior.map((p) => [p.documentName, p]));
  const used = new Set<string>();
  const items: PlannedItem[] = [];
  const filesWithoutPath: string[] = [];

  const unique = (name: string, marker: string | null): { name: string; note: string | null } => {
    let candidate = name;
    let note: string | null = null;
    const earlier = priorByName.get(candidate);
    if (earlier && earlier.marker !== marker) {
      // Same exhibit, changed content: keep the earlier copy, send the new one beside it.
      const dot = candidate.lastIndexOf(".");
      const stem = dot > 0 ? candidate.slice(0, dot) : candidate;
      const ext = dot > 0 ? candidate.slice(dot) : "";
      candidate = `${stem} (revised)${ext}`;
      note = "The earlier copy in Clio is left as it is. This is a newer version of the same exhibit.";
    }
    let n = 2;
    while (used.has(candidate)) {
      const dot = candidate.lastIndexOf(".");
      const stem = dot > 0 ? candidate.slice(0, dot) : candidate;
      const ext = dot > 0 ? candidate.slice(dot) : "";
      candidate = `${stem.replace(/ \(\d+\)$/, "")} (${n++})${ext}`;
    }
    used.add(candidate);
    return { name: candidate, note };
  };

  for (const row of numbered) {
    let ext = "txt";
    let source: PlannedItem["source"] = "text_page";
    if (row.kind === "evidence") {
      const info = args.files.get(row.id) ?? null;
      source = "evidence_file";
      if (!info) filesWithoutPath.push(row.key);
      ext = info?.extension || "bin";
    }
    const { name, note } = unique(documentNameFor(row, ext), row.marker);
    items.push({
      seq: items.length + 1,
      kind: "exhibit",
      itemKey: row.key,
      exhibitNumber: row.exhibit.number,
      documentName: name,
      marker: row.marker,
      source,
      note,
    });
  }

  const index = unique(`Exhibit Index - package v${args.packageVersion}.txt`, null);
  items.push({
    seq: items.length + 1,
    kind: "index",
    itemKey: null,
    exhibitNumber: null,
    documentName: index.name,
    marker: null,
    source: "index",
    note: null,
  });
  if (args.includeZip) {
    const zip = unique(`Exhibit Binder - package v${args.packageVersion}.zip`, null);
    items.push({
      seq: items.length + 1,
      kind: "zip",
      itemKey: null,
      exhibitNumber: null,
      documentName: zip.name,
      marker: null,
      source: "zip",
      note: null,
    });
  }
  return { packageVersion: args.packageVersion, items, excluded, filesWithoutPath };
}

// ---------------------------------------------------------------------------
// Text that goes into Clio
// ---------------------------------------------------------------------------

export const TRANSFER_DISCLAIMER = [
  "Prepared from items the client chose to share. The client's words are quoted as entered.",
  "Not verified. This does not state that anything is authentic, complete, admissible or accurate.",
].join(" ");

/** Plain-text page for an exhibit that is an entry or an answered request. */
export function exhibitPageText(row: ChronologyRow): string {
  return [
    row.exhibit.label.toUpperCase(),
    "",
    ...renderChronologyRow(row).map((l) => l.replace(/^ {3}/, "")),
    "",
    TRANSFER_DISCLAIMER,
    "",
  ].join("\n");
}

export type IndexLine = {
  exhibitNumber: number;
  row: ChronologyRow;
  documentName: string;
  status: "confirmed" | "failed" | "pending" | "skipped" | "uploading" | "needs_review";
  /** Fingerprint of the exact bytes PatternProof sent, when it was sent. */
  sha256: string | null;
};

export function indexText(args: {
  packageVersion: number;
  matterLabel: string;
  generatedAt: string;
  lines: readonly IndexLine[];
  excluded: readonly ExcludedItem[];
  withdrawn: ReadonlyArray<{ number: number }>;
}): string {
  const out = [
    `EXHIBIT INDEX (exhibit package v${args.packageVersion})`,
    `Clio matter: ${args.matterLabel}`,
    `Prepared: ${args.generatedAt}`,
    "",
    "Exhibit numbers are fixed by the exhibit package and do not change when items are added.",
    "",
  ];
  for (const l of args.lines) {
    out.push(
      `Exhibit ${exhibitNumberLabel(l.exhibitNumber)} | ${l.row.date.text} | ${l.row.title}`,
      `   File in Clio: ${l.documentName}`,
      `   Transfer status when this index was made: ${l.status}`,
      l.sha256 ? `   SHA-256 of the file as PatternProof sent it: ${l.sha256}` : "   No fingerprint (not sent yet or not a file)",
      "",
    );
  }
  if (args.withdrawn.length) {
    out.push(
      `No longer shared by the client (numbers stay reserved): ${args.withdrawn.map((w) => `Exhibit ${exhibitNumberLabel(w.number)}`).join(", ")}`,
      "",
    );
  }
  if (args.excluded.length) {
    out.push(`Not sent, no fixed exhibit number yet: ${args.excluded.length} item(s).`, "");
  }
  out.push(
    "A SHA-256 fingerprint shows that a file has not changed since PatternProof sent it. It does not show that the file is genuine or that its contents are true.",
    TRANSFER_DISCLAIMER,
    "",
  );
  return out.join("\n");
}
