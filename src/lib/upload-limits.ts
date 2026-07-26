/**
 * One place for every upload size cap in the app.
 *
 * Photos and documents share a 25 MB default. Audio and video get their own,
 * higher ceilings — a single flat 25 MB limit would break screen-recording and
 * long voice-note imports, which are legitimately large.
 */
export const UPLOAD_LIMITS = {
  /** Photos, screenshots, scans, PDFs. */
  document: 25 * 1024 * 1024,
  /** Voice notes and audio evidence. */
  audio: 100 * 1024 * 1024,
  /** Screen recordings and video evidence. */
  video: 200 * 1024 * 1024,
} as const;

export type UploadKind = keyof typeof UPLOAD_LIMITS;

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

/** Pick the right ceiling from a MIME type (or filename as a fallback). */
export function uploadKindFor(mimeOrName: string): UploadKind {
  const v = (mimeOrName || "").toLowerCase();
  if (v.startsWith("video/") || /\.(mp4|mov|m4v|webm|avi)$/.test(v)) return "video";
  if (v.startsWith("audio/") || /\.(mp3|m4a|wav|aac|ogg|caf)$/.test(v)) return "audio";
  return "document";
}

/**
 * Returns null when the file is fine, or a calm, specific message when it isn't.
 * Message copy is deliberately non-alarming and tells the survivor what to do.
 */
export function checkUploadSize(file: { name: string; size: number; type?: string }): string | null {
  const kind = uploadKindFor(file.type || file.name);
  const limit = UPLOAD_LIMITS[kind];
  if (file.size <= limit) return null;
  const hint =
    kind === "video"
      ? "Try a shorter recording, or split it into parts."
      : kind === "audio"
        ? "Try splitting the recording into shorter pieces."
        : "Try a smaller photo, or split a long PDF into sections.";
  return `“${file.name}” is ${humanSize(file.size)} — over the ${humanSize(limit)} limit. ${hint}`;
}
