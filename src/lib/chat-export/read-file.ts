// Browser-side reading of an exported chat file (.txt, or the .zip WhatsApp
// makes when you export with media). The ORIGINAL bytes are hashed before
// anything is parsed, so the fingerprint is of exactly what the survivor gave
// us — not of our reading of it.

export interface ChatExportFile {
  /** Decoded transcript text handed to the parser. */
  text: string;
  /** Hash of the file the survivor picked (the zip, if it was a zip). */
  sha256: string;
  originalFilename: string;
  bytes: number;
  mime: string;
  sourceType: "txt" | "zip";
  /** Inside a zip: which entry we read the transcript from. */
  transcriptEntry: string | null;
  /** Inside a zip: media files that were not imported. */
  skippedMediaCount: number;
}

export class ChatExportReadError extends Error {}

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const MEDIA_EXT = /\.(jpe?g|png|gif|webp|heic|mp4|mov|m4a|mp3|opus|aac|wav|pdf|vcf)$/i;

function decode(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export async function readChatExportFile(file: File): Promise<ChatExportFile> {
  const buf = await file.arrayBuffer();
  const sha256 = await sha256Hex(buf);
  const name = file.name || "chat-export";
  const isZip = /\.zip$/i.test(name) || file.type === "application/zip";

  if (!isZip) {
    return {
      text: decode(new Uint8Array(buf)),
      sha256,
      originalFilename: name,
      bytes: file.size,
      mime: file.type || "text/plain",
      sourceType: "txt",
      transcriptEntry: null,
      skippedMediaCount: 0,
    };
  }

  const { default: JSZip } = await import("jszip");
  let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    throw new ChatExportReadError("We couldn't open that zip file. Is it a complete download?");
  }
  const entries = Object.values(zip.files).filter((f) => !f.dir && !f.name.startsWith("__MACOSX/"));
  const texts = entries.filter((f) => /\.txt$/i.test(f.name));
  if (texts.length === 0) {
    throw new ChatExportReadError(
      "There's no chat text file inside that zip. Export the chat again and choose 'Without media' or 'Attach media' — either gives a _chat.txt.",
    );
  }
  // WhatsApp names it _chat.txt (iOS) or "WhatsApp Chat with <name>.txt" (Android).
  const preferred =
    texts.find((f) => /(^|\/)_chat\.txt$/i.test(f.name)) ??
    texts.find((f) => /whatsapp chat/i.test(f.name)) ??
    texts[0]!;
  const bytes = await preferred.async("uint8array");

  return {
    text: decode(bytes),
    sha256,
    originalFilename: name,
    bytes: file.size,
    mime: file.type || "application/zip",
    sourceType: "zip",
    transcriptEntry: preferred.name,
    skippedMediaCount: entries.filter((f) => MEDIA_EXT.test(f.name)).length,
  };
}
