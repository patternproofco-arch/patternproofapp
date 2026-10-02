// Browser-side extraction of media files from a WhatsApp-style chat export zip.
// Soft path only: photos become evidence the same way other uploads do (preserve
// → soft draft in /drafts → OCR fills extracted_text later). No characterisation.

import { checkUploadSize } from "@/lib/upload-limits";

export interface ChatExportMediaItem {
  /** Path inside the zip. */
  entryName: string;
  /** Basename used to match attachment markers. */
  filename: string;
  blob: Blob;
  mime: string;
  bytes: number;
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i;
const MEDIA_EXT =
  /\.(jpe?g|png|gif|webp|heic|heif|bmp|mp4|mov|m4a|mp3|opus|aac|wav|pdf)$/i;

function mimeForName(name: string): string {
  const n = name.toLowerCase();
  if (/\.jpe?g$/.test(n)) return "image/jpeg";
  if (/\.png$/.test(n)) return "image/png";
  if (/\.gif$/.test(n)) return "image/gif";
  if (/\.webp$/.test(n)) return "image/webp";
  if (/\.heic$/.test(n)) return "image/heic";
  if (/\.heif$/.test(n)) return "image/heif";
  if (/\.bmp$/.test(n)) return "image/bmp";
  if (/\.pdf$/.test(n)) return "application/pdf";
  if (/\.mp4$/.test(n)) return "video/mp4";
  if (/\.mov$/.test(n)) return "video/quicktime";
  if (/\.m4a$/.test(n)) return "audio/mp4";
  if (/\.mp3$/.test(n)) return "audio/mpeg";
  if (/\.opus$/.test(n)) return "audio/opus";
  if (/\.aac$/.test(n)) return "audio/aac";
  if (/\.wav$/.test(n)) return "audio/wav";
  return "application/octet-stream";
}

export type ExtractChatMediaResult = {
  items: ChatExportMediaItem[];
  /** Media entries skipped for size or cap. */
  skipped: number;
  /** True when the file was not a zip. */
  notZip: boolean;
};

/**
 * Read image (and optional other media) bytes out of an export zip.
 * Caps how many files we pull so a huge export cannot overwhelm the device.
 * Soft claims only — caller preserves via the normal evidence path.
 */
export async function extractChatExportMedia(
  file: File,
  options?: { maxItems?: number; imagesOnly?: boolean },
): Promise<ExtractChatMediaResult> {
  const maxItems = options?.maxItems ?? 40;
  const imagesOnly = options?.imagesOnly ?? true;
  const isZip = /\.zip$/i.test(file.name || "") || file.type === "application/zip";
  if (!isZip) return { items: [], skipped: 0, notZip: true };

  const { default: JSZip } = await import("jszip");
  const buf = await file.arrayBuffer();
  let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    return { items: [], skipped: 0, notZip: false };
  }

  const entries = Object.values(zip.files).filter(
    (f) => !f.dir && !f.name.startsWith("__MACOSX/") && !/(^|\/)\./.test(f.name),
  );
  const mediaEntries = entries.filter((f) =>
    imagesOnly ? IMAGE_EXT.test(f.name) : MEDIA_EXT.test(f.name),
  );

  const items: ChatExportMediaItem[] = [];
  let skipped = 0;
  for (const entry of mediaEntries) {
    if (items.length >= maxItems) {
      skipped += 1;
      continue;
    }
    const filename = entry.name.split("/").pop() || entry.name;
    const mime = mimeForName(filename);
    const bytes = await entry.async("uint8array");
    const blob = new Blob([new Uint8Array(bytes)], { type: mime });
    const probe = { name: filename, size: bytes.byteLength, type: mime };
    if (checkUploadSize(probe)) {
      skipped++;
      continue;
    }
    items.push({
      entryName: entry.name,
      filename,
      blob,
      mime,
      bytes: bytes.byteLength,
    });
  }
  return { items, skipped, notZip: false };
}

/** Case-insensitive basename match between zip entry and attachment marker. */
export function matchMediaToMarker(
  items: ChatExportMediaItem[],
  markerFilename: string | null,
): ChatExportMediaItem | null {
  if (!markerFilename) return null;
  const want = markerFilename.trim().toLowerCase();
  if (!want) return null;
  return (
    items.find((i) => i.filename.toLowerCase() === want) ??
    items.find((i) => i.entryName.toLowerCase().endsWith("/" + want)) ??
    null
  );
}
