/**
 * Guide chat is shown as plain text (pre-wrap), not rendered markdown.
 * Models still sometimes emit **bold**, *italics*, or escaped \* markers.
 * Strip those so survivors never see leftover asterisks.
 *
 * Soft claim: best-effort cleanup of common markdown artifacts — not a full
 * markdown parser, and not a guarantee against every odd model output.
 */

/** Collapse common markdown emphasis / bullet asterisks into plain text. */
export function stripGuideAnswerMarkdown(text: string): string {
  let out = text;

  // Escaped asterisks models sometimes emit (\*)
  out = out.replace(/\\\*/g, "");

  // **bold** then *italic* (order matters so bold isn't half-stripped)
  out = out.replace(/\*\*([^*]+)\*\*/g, "$1");
  out = out.replace(/(^|[^*\n])\*([^*\n]+)\*(?!\*)/g, "$1$2");

  // Lines that used * as a bullet
  out = out.replace(/^[ \t]*\*[ \t]+/gm, "• ");

  // Any remaining stray asterisk runs
  out = out.replace(/\*+/g, "");

  return out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ {2,}/g, " ")
    .trim();
}

/**
 * Prefer PatternProof feature names over UI chrome descriptions.
 * "Add an entry" is the product name for creating a journal/incident entry —
 * never "the + button" / "the plus button".
 *
 * Note for Experience glance: product copy should say "Add an entry", not
 * describe the control as a plus / + button.
 */
export function preferFeatureNames(text: string): string {
  return text
    .replace(/\bthe\s*\+\s*button\b/gi, "Add an entry")
    .replace(/\bthe\s+plus\s+button\b/gi, "Add an entry")
    .replace(/\bplus\s+button\b/gi, "Add an entry")
    .replace(/\b\+\s*button\b/gi, "Add an entry")
    .replace(/\b(tap|click|press|use)\s+the\s*\+(?!\w)/gi, "$1 Add an entry")
    .replace(/\bthe\s*\+(?!\w)/gi, "Add an entry");
}

/** Full post-process for a Guide reply before it reaches the UI. */
export function cleanGuideAnswer(text: string): string {
  return preferFeatureNames(stripGuideAnswerMarkdown(text));
}
