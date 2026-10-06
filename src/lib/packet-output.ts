/**
 * One approved exhibit-package version for attorney outputs (pure).
 *
 * Binder, chronology, declaration, frequency matrix, and Clio transfer should
 * cite the same frozen numbers. If a shared item changes after that package,
 * identify the change and require review (a new package version that keeps
 * numbers and refreshes markers) before generating an updated copy.
 *
 * Soft educational wording only. Markers detect change; they are not proof of
 * authenticity.
 */

import type { PackageDiff } from "@/lib/exhibit-numbering";
import type { ChronologyRow, DeclarationContent, DraftParagraph } from "@/lib/chronology";
import { BASIS_LABEL, buildDraftParagraphs } from "@/lib/chronology";

export type PacketRef = {
  version: number;
  /** When this package version was saved (ISO), when known. */
  approvedAt: string | null;
};

/** Short label for headers and export banners. */
export function packetVersionLabel(ref: PacketRef | number | null | undefined): string {
  if (ref == null) return "No approved exhibit package yet";
  const version = typeof ref === "number" ? ref : ref.version;
  return `Exhibit package v${version}`;
}

/** One line for plain-text exports. */
export function packetVersionExportLine(ref: PacketRef | number | null | undefined): string {
  if (ref == null) {
    return "Exhibit package: none (numbers are provisional and may change).";
  }
  const version = typeof ref === "number" ? ref : ref.version;
  const at =
    typeof ref === "object" && ref.approvedAt
      ? ` · approved ${ref.approvedAt.slice(0, 10)}`
      : "";
  return `Exhibit package: v${version}${at}`;
}

export type OutputGate = {
  /** True when it is safe to generate/copy citing the current package. */
  ok: boolean;
  reasons: string[];
  /** Item keys whose content changed after the approved package. */
  changedKeys: string[];
};

/**
 * Block generating updated outputs when facts behind fixed exhibit numbers changed,
 * when the draft cites an older package, or when included draft items need re-review.
 */
export function gatePacketOutput(opts: {
  packageVersion: number | null;
  packageDiff: PackageDiff | null;
  /** Declaration draft cites an older package than the current one. */
  packageBehind?: boolean;
  /** Included draft keys whose source changed after the attorney reviewed them. */
  changedSinceReview?: readonly string[];
  /** Require an approved package (Clio / binder citing fixed numbers). */
  requirePackage?: boolean;
}): OutputGate {
  const reasons: string[] = [];
  const changedKeys = opts.packageDiff?.changed ?? [];

  if (opts.requirePackage && opts.packageVersion == null) {
    reasons.push("Fix exhibit numbers in an approved package before generating this output.");
  }
  if (changedKeys.length > 0) {
    reasons.push(
      `${changedKeys.length} numbered item(s) changed after exhibit package v${opts.packageVersion}. Review them and save a new package version (numbers stay the same) before generating an updated output.`,
    );
  }
  if (opts.packageBehind) {
    reasons.push("This draft cites an older exhibit package. Move the draft to the current package before copying.");
  }
  const review = opts.changedSinceReview ?? [];
  if (review.length > 0) {
    reasons.push(
      `${review.length} included item(s) changed after you reviewed them. Acknowledge each change before copying the draft.`,
    );
  }
  return { ok: reasons.length === 0, reasons, changedKeys: [...changedKeys] };
}

/** How a declaration paragraph relates to the client's record. */
export type SourceKind = "observation" | "quotation" | "software_extracted" | "attorney_written" | "unavailable";

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  observation: "Person's observation (as they entered it)",
  quotation: "Quotation from the client's record",
  software_extracted: "Text read from a file by software (not part of the draft wording unless you add it)",
  attorney_written: "Written by the attorney",
  unavailable: "Source no longer shared",
};

export type CopyPreviewSection = {
  n: number;
  exhibit: string | null;
  origin: DraftParagraph["origin"];
  /** Exact paragraph text that will be copied. */
  text: string;
  kinds: SourceKind[];
  kindLabels: string[];
  flags: string[];
  /** Software-extracted text for this item, shown separately so it is never mistaken for the draft. */
  softwareExtracted: { kind: "transcript" | "extracted_text"; text: string; checked: boolean } | null;
};

/**
 * Build a copy preview that keeps observations, quotations, and software-extracted
 * text distinct. The `text` fields are exactly what renderDeclarationText will copy
 * for each paragraph; machine text is listed beside, never silently folded in.
 */
export function buildDeclarationCopyPreview(
  content: DeclarationContent,
  rows: readonly ChronologyRow[],
): CopyPreviewSection[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const paragraphs = buildDraftParagraphs(content, rows);
  return paragraphs.map((p) => {
    if (p.origin === "attorney_added") {
      return {
        n: p.n,
        exhibit: p.exhibit,
        origin: p.origin,
        text: p.text,
        kinds: ["attorney_written" as const],
        kindLabels: [SOURCE_KIND_LABEL.attorney_written],
        flags: p.flags,
        softwareExtracted: null,
      };
    }
    const row = p.key ? byKey.get(p.key) : undefined;
    if (!row) {
      return {
        n: p.n,
        exhibit: p.exhibit,
        origin: p.origin,
        text: p.text,
        kinds: ["unavailable" as const],
        kindLabels: [SOURCE_KIND_LABEL.unavailable],
        flags: p.flags,
        softwareExtracted: null,
      };
    }
    const kinds: SourceKind[] = [];
    // Generated wording quotes the client's entered text (observation) and may
    // quote a file description. Message/OCR body is software-extracted and stays out.
    if (row.quote) kinds.push("quotation");
    else kinds.push("observation");
    if (row.machineText) kinds.push("software_extracted");
    return {
      n: p.n,
      exhibit: p.exhibit,
      origin: p.origin,
      text: p.text,
      kinds,
      kindLabels: kinds.map((k) => SOURCE_KIND_LABEL[k]),
      flags: p.flags,
      softwareExtracted: row.machineText
        ? { kind: row.machineText.kind, text: row.machineText.text, checked: row.machineText.checked }
        : null,
    };
  });
}

/** Chronology row lines that name observation vs software-extracted for a copy preview. */
export function chronologyRowSourceNotes(r: ChronologyRow): string[] {
  const notes: string[] = [`Basis: ${BASIS_LABEL[r.basis]}`];
  if (r.quote) notes.push("Includes the person's own wording (quoted in full).");
  if (r.machineText) {
    notes.push(
      `Software-extracted ${r.machineText.kind}${r.machineText.checked ? " (checked)" : " (not checked)"} is listed separately below and is not mixed into the quoted entry.`,
    );
  }
  return notes;
}
