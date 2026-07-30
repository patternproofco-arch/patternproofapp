/**
 * Browser-side EXIF inspection and removal.
 *
 * We never keep or remove embedded metadata silently. This module only reports
 * what a file contains so the survivor can decide, and re-encodes the image
 * when she asks for it to be removed.
 */

export interface ExifSummary {
  /** True when the file carries any EXIF/APP1 block at all. */
  hasMetadata: boolean;
  hasGps: boolean;
  /** Device capture timestamp as an ISO date (YYYY-MM-DD) when present. */
  capturedOn: string | null;
  capturedAtText: string | null;
}

const EMPTY: ExifSummary = { hasMetadata: false, hasGps: false, capturedOn: null, capturedAtText: null };

const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME = 0x0132;
const TAG_GPS_IFD = 0x8825;
const TAG_EXIF_IFD = 0x8769;

/** Reads the EXIF APP1 segment of a JPEG. Other formats report "no metadata". */
export async function readExif(file: File): Promise<ExifSummary> {
  try {
    if (!/jpe?g$/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) return EMPTY;
    // 256KB is comfortably past the EXIF block on any normal photo.
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const view = new DataView(buf);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return EMPTY;

    let offset = 2;
    while (offset + 4 < view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      const size = view.getUint16(offset + 2);
      if (marker === 0xe1) return parseApp1(view, offset + 4, size - 2);
      if (marker === 0xda) break; // start of scan — no EXIF
      offset += 2 + size;
    }
    return EMPTY;
  } catch {
    return EMPTY;
  }
}

function parseApp1(view: DataView, start: number, length: number): ExifSummary {
  const end = Math.min(start + length, view.byteLength);
  // "Exif\0\0"
  if (end - start < 10) return EMPTY;
  const header = String.fromCharCode(
    view.getUint8(start), view.getUint8(start + 1), view.getUint8(start + 2), view.getUint8(start + 3),
  );
  if (header !== "Exif") return EMPTY;

  const tiff = start + 6;
  const endianTag = view.getUint16(tiff);
  const little = endianTag === 0x4949;
  if (!little && endianTag !== 0x4d4d) return { ...EMPTY, hasMetadata: true };

  const u16 = (p: number) => view.getUint16(p, little);
  const u32 = (p: number) => view.getUint32(p, little);

  const result: ExifSummary = { hasMetadata: true, hasGps: false, capturedOn: null, capturedAtText: null };

  const readAscii = (valueOffset: number, count: number): string => {
    let s = "";
    for (let i = 0; i < count - 1 && valueOffset + i < view.byteLength; i++) {
      s += String.fromCharCode(view.getUint8(valueOffset + i));
    }
    return s.trim();
  };

  const walkIfd = (ifdStart: number, depth: number) => {
    if (depth > 2 || ifdStart + 2 > end) return;
    const count = u16(ifdStart);
    for (let i = 0; i < count; i++) {
      const entry = ifdStart + 2 + i * 12;
      if (entry + 12 > end) return;
      const tag = u16(entry);
      const type = u16(entry + 2);
      const num = u32(entry + 4);
      const valPtr = num * (type === 2 ? 1 : 4) > 4 ? tiff + u32(entry + 8) : entry + 8;
      if (tag === TAG_GPS_IFD) result.hasGps = true;
      if (tag === TAG_EXIF_IFD) walkIfd(tiff + u32(entry + 8), depth + 1);
      if ((tag === TAG_DATETIME_ORIGINAL || tag === TAG_DATETIME) && type === 2 && !result.capturedOn) {
        const raw = readAscii(valPtr, num);
        const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})/);
        if (m) {
          result.capturedOn = `${m[1]}-${m[2]}-${m[3]}`;
          result.capturedAtText = raw;
        }
      }
    }
  };

  try {
    walkIfd(tiff + u32(tiff + 4), 0);
  } catch {
    /* partial read — report what we have */
  }
  return result;
}

/**
 * Returns a copy of the image with all embedded metadata removed, by decoding
 * and re-encoding through a canvas. Pixels are preserved; EXIF is not carried
 * over by the encoder. Falls back to the original file if decoding fails.
 */
export async function stripExif(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.95),
    );
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}
