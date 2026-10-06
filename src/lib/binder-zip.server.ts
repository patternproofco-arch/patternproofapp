/**
 * Builds an Exhibit Binder ZIP with Exhibit N naming for Clio / local download.
 *
 * Soft claims only: user-reviewed shared items, not court-verified. Does not
 * determine admissibility or replace professional judgment.
 */
import JSZip from "jszip";
import { createHash } from "crypto";
import type { BinderEntry } from "@/lib/binder";
import { buildPleadingText } from "@/lib/pleading";

export type BinderZipFile = {
  /** Path inside the ZIP (posix). */
  path: string;
  bytes: Uint8Array;
  /** Optional content-type hint for evidence binaries. */
  contentType?: string;
};

export type BuiltBinderZip = {
  zipBuf: Uint8Array;
  fileStem: string;
  documentName: string;
  exhibitCount: number;
  fileCount: number;
};

function sha256(buf: ArrayBuffer | Uint8Array): string {
  return createHash("sha256")
    .update(Buffer.from(buf as ArrayBuffer))
    .digest("hex");
}

function safeTitle(title: string): string {
  return (
    title
      .replace(/[^a-zA-Z0-9-_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "untitled"
  );
}

/** "Exhibit 1" → "Exhibit_1" for filenames. */
export function exhibitFilePrefix(exhibit: string): string {
  return exhibit.replace(/\s+/g, "_");
}

export function binderEntryFileStem(entry: BinderEntry): string {
  const date = entry.date ?? "undated";
  return `${exhibitFilePrefix(entry.exhibit)}_${date}_${safeTitle(entry.title)}`;
}

function entryMarkdown(entry: BinderEntry): string {
  const lines = [
    `# ${entry.exhibit}`,
    "",
    `**Kind:** ${entry.label}`,
    `**Date:** ${entry.date ?? "Date not given"}`,
    `**Title:** ${entry.title}`,
    "",
  ];
  if (entry.body) {
    lines.push("## Client record", "", entry.body, "");
  }
  lines.push(
    "---",
    "",
    "User-reviewed shared item for professional review. Not court-verified.",
    "PatternProof does not determine admissibility or replace professional judgment.",
    "",
  );
  return lines.join("\n");
}

function indexMarkdown(entries: BinderEntry[]): string {
  const rows = entries.map(
    (e) =>
      `| ${e.exhibit} | ${e.date ?? "—"} | ${e.label} | ${e.title.replace(/\|/g, "\\|")} |`,
  );
  return [
    "# Exhibit binder index",
    "",
    "Shared items the client chose to share, numbered in date order.",
    "User-reviewed, not court-verified.",
    "",
    "| Exhibit | Date | Kind | Title |",
    "|---------|------|------|-------|",
    ...rows,
    "",
  ].join("\n");
}

function readmeText(
  exhibitCount: number,
  generatedAt: string,
  packageVersion: number | null | undefined,
): string {
  const packet =
    packageVersion != null
      ? `Exhibit package: v${packageVersion}`
      : "Exhibit package: none (labels may be provisional)";
  return [
    "PatternProof Exhibit Binder",
    "",
    `Generated: ${generatedAt}`,
    `Exhibits: ${exhibitCount}`,
    packet,
    "",
    "This archive packages shared journal entries, files, and answered requests",
    "with Exhibit N labels matching the attorney portal binder on PatternProof.",
    "",
    "Contents:",
    "  README.txt                 — this file",
    "  index.md                   — exhibit list",
    "  factual-chronology.txt     — declaration-format draft (edit before use)",
    "  exhibits/                  — one folder per exhibit (markdown + file when present)",
    "  manifest.json              — SHA-256 fingerprints for included binaries",
    "",
    "Soft claims only. User-reviewed, not court-verified.",
    "PatternProof helps organize documentation for professional review.",
    "It does not determine admissibility, make legal findings, or replace",
    "professional judgment.",
    "",
  ].join("\n");
}

/**
 * Pure ZIP builder. Pass evidence bytes keyed by evidence id when available;
 * missing binaries still get a markdown page so the exhibit number is preserved.
 */
export async function buildExhibitBinderZip(args: {
  entries: BinderEntry[];
  /** Evidence id → raw file bytes (and optional extension / content type). */
  evidenceFiles?: Map<
    string,
    { bytes: Uint8Array; extension?: string; contentType?: string }
  >;
  clientRef?: string;
  generatedAt?: string;
  /** Chronology text to include instead of the short summary form (full quotes, dates as recorded). */
  chronologyText?: string;
  /** Approved exhibit package version these numbers come from, when known. */
  packageVersion?: number | null;
}): Promise<BuiltBinderZip> {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const entries = args.entries;
  const evidenceFiles = args.evidenceFiles ?? new Map();
  const zip = new JSZip();
  const fileHashes: Array<{ path: string; sha256: string; bytes: number }> = [];

  zip.file("README.txt", readmeText(entries.length, generatedAt, args.packageVersion));
  zip.file("index.md", indexMarkdown(entries));
  zip.file("factual-chronology.txt", args.chronologyText ?? buildPleadingText(entries));

  const exhibitsFolder = zip.folder("exhibits");
  for (const entry of entries) {
    if (!exhibitsFolder) break;
    const stem = binderEntryFileStem(entry);
    const folder = exhibitsFolder.folder(stem);
    if (!folder) continue;
    folder.file(`${stem}.md`, entryMarkdown(entry));

    if (entry.kind === "evidence") {
      const file = evidenceFiles.get(entry.id);
      if (file?.bytes?.byteLength) {
        const ext = (file.extension || "bin").replace(/^\./, "").slice(0, 12);
        const binaryPath = `exhibits/${stem}/${stem}.${ext}`;
        folder.file(`${stem}.${ext}`, file.bytes);
        const hash = sha256(file.bytes);
        fileHashes.push({
          path: binaryPath,
          sha256: hash,
          bytes: file.bytes.byteLength,
        });
      }
    }
  }

  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        generated_at: generatedAt,
        client_ref: args.clientRef ?? null,
        exhibit_count: entries.length,
        package_version: args.packageVersion ?? null,
        generator: "PatternProof Exhibit Binder ZIP v1",
        exhibits: entries.map((e) => ({
          exhibit: e.exhibit,
          kind: e.kind,
          id: e.id,
          date: e.date,
          title: e.title,
          folder: binderEntryFileStem(e),
        })),
        file_hashes: fileHashes,
        disclaimer:
          "User-reviewed shared items for professional review. Not court-verified. PatternProof does not determine admissibility or replace professional judgment.",
      },
      null,
      2,
    ),
  );

  const zipBuf = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const ts = generatedAt.replace(/[:.]/g, "-");
  const ref = (args.clientRef ?? "client").slice(0, 8);
  const fileStem = `exhibit-binder-${ref}-${ts}`;
  return {
    zipBuf,
    fileStem,
    documentName: `${fileStem}.zip`,
    exhibitCount: entries.length,
    fileCount: fileHashes.length,
  };
}
