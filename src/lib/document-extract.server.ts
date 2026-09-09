// -----------------------------------------------------------------------------
// Text extraction for uploaded documents.
//
// Three paths, in order of preference:
//   plain  — text/*, csv, markdown, json: decoded directly
//   docx   — Word files: read word/document.xml out of the zip container
//   pdf    — real text layer read with unpdf (pdf.js, Worker-safe)
//
// A PDF with no usable text layer (a scan or a photo of paper) is reported as
// `needs_ocr` rather than "empty" so the caller can fall back to a reading
// pass and the survivor is never told a readable document was blank.
//
// Nothing here interprets the text. It is stored verbatim for human review.
// -----------------------------------------------------------------------------

export type ExtractionMethod = "plain" | "docx" | "pdf-text" | "read-aloud" | "none";
export type ExtractionStatus = "ready" | "needs_ocr" | "unsupported" | "empty" | "failed";

export interface ExtractionResult {
  text: string;
  method: ExtractionMethod;
  status: ExtractionStatus;
  pages: number | null;
}

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const PLAIN_MIMES = new Set([
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "text/rtf",
  "application/rtf",
]);

/** Minimum characters per page before a PDF counts as having a real text layer. */
const MIN_CHARS_PER_PAGE = 24;

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

function tidy(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Turn one WordprocessingML part into plain text, one line per paragraph. */
export function docxXmlToText(xml: string): string {
  const withBreaks = xml
    .replace(/<w:br\b[^>]*\/?>/g, "\n")
    .replace(/<w:tab\b[^>]*\/?>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tr>/g, "\n");
  const stripped = withBreaks.replace(/<[^>]+>/g, "");
  return tidy(decodeEntities(stripped));
}

async function extractDocx(bytes: Uint8Array): Promise<ExtractionResult> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  const parts = ["word/document.xml", "word/footnotes.xml", "word/endnotes.xml"];
  const chunks: string[] = [];
  for (const p of parts) {
    const file = zip.file(p);
    if (!file) continue;
    const text = docxXmlToText(await file.async("string"));
    if (text) chunks.push(text);
  }
  const text = tidy(chunks.join("\n\n"));
  return {
    text,
    method: "docx",
    status: text ? "ready" : "empty",
    pages: null,
  };
}

async function extractPdf(bytes: Uint8Array): Promise<ExtractionResult> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [String(text)];
  const joined = tidy(
    pages.map((p, i) => `--- Page ${i + 1} ---\n${tidy(String(p ?? ""))}`).join("\n\n"),
  );
  const bodyChars = pages.reduce((n, p) => n + String(p ?? "").replace(/\s/g, "").length, 0);
  const thin = bodyChars < MIN_CHARS_PER_PAGE * Math.max(1, totalPages);
  return {
    text: thin ? "" : joined,
    method: "pdf-text",
    status: thin ? "needs_ocr" : "ready",
    pages: totalPages ?? pages.length,
  };
}

/**
 * Reads the text out of a supported document. Never throws for a readable but
 * unsupported file — it reports `unsupported` so the caller can say so plainly.
 */
export async function extractDocumentText(
  bytes: Uint8Array,
  mime: string,
  filename?: string | null,
): Promise<ExtractionResult> {
  const lowerName = (filename ?? "").toLowerCase();
  const type = (mime ?? "").toLowerCase();

  if (type.startsWith("text/") || PLAIN_MIMES.has(type) || /\.(txt|csv|md|json)$/.test(lowerName)) {
    const text = tidy(new TextDecoder("utf-8").decode(bytes));
    return { text, method: "plain", status: text ? "ready" : "empty", pages: null };
  }

  if (type === DOCX_MIME || lowerName.endsWith(".docx")) {
    return extractDocx(bytes);
  }

  if (type === "application/pdf" || lowerName.endsWith(".pdf")) {
    return extractPdf(bytes);
  }

  return { text: "", method: "none", status: "unsupported", pages: null };
}
