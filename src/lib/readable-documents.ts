// Client-safe check for "can we read the words out of this file?".
// Kept out of the .server module so both the single-file and batch upload
// paths can use exactly the same rule.

export const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function isReadableDocument(
  mime: string | null | undefined,
  filename?: string | null,
): boolean {
  const m = (mime ?? "").toLowerCase();
  const n = (filename ?? "").toLowerCase();
  return (
    m === "application/pdf" ||
    m === DOCX_MIME_TYPE ||
    m.startsWith("text/") ||
    m === "application/json" ||
    m.startsWith("image/") ||
    /\.(pdf|docx|txt|csv|md|json|jpe?g|png|heic|heif|webp|gif)$/.test(n)
  );
}
