// Pure, deterministic helpers for turning OCR line boxes into message rows.
// No network, no AI. Everything here is testable in isolation.

export interface OcrLine {
  text: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  confidence: number;
}

export type SenderSide = "incoming" | "outgoing" | "unknown";
export type DateConfidence = "explicit_date" | "relative" | "time_only" | "none";

export interface DraftMessage {
  body: string;
  sender_side: SenderSide;
  sent_on: string | null;
  sent_at_time: string | null;
  date_confidence: DateConfidence;
  has_attachment_marker: boolean;
  attachment_marker_text: string | null;
  ocr_confidence: number;
  upload_index: number;
}

const ATTACHMENT_WORDS = [
  "photo",
  "photos",
  "image",
  "video",
  "gif",
  "sticker",
  "audio message",
  "voice message",
  "attachment",
  "document",
  "location",
  "contact card",
];

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "10:41 AM" -> "10:41:00". Returns null when no clock time is present. */
export function parseClockTime(input: string): string | null {
  const m = input.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([APap]\.?[Mm]\.?)?/);
  if (!m) return null;
  let hour = Number(m[1]);
  const min = Number(m[2]);
  const sec = m[3] ? Number(m[3]) : 0;
  if (hour > 23 || min > 59) return null;
  const mer = m[4]?.toLowerCase().replace(/\./g, "");
  if (mer === "pm" && hour < 12) hour += 12;
  if (mer === "am" && hour === 12) hour = 0;
  return `${pad(hour)}:${pad(min)}:${pad(sec)}`;
}

export interface ParsedStamp {
  date: string | null;
  time: string | null;
  confidence: DateConfidence;
}

/**
 * Parses the date/time separator text messaging apps draw between messages.
 * Handles "Today 10:41 AM", "Yesterday", "Mon, Jan 5 at 4:32 PM",
 * "1/5/24, 4:32 PM" and a bare "4:32 PM" (least reliable — no date at all).
 * `today` is injected so this stays deterministic in tests.
 */
export function parseStampLine(raw: string, today = new Date()): ParsedStamp | null {
  const s = raw.replace(/\u200e/g, "").trim();
  if (!s || s.length > 60) return null;
  const lower = s.toLowerCase();
  const time = parseClockTime(s);

  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (/\btoday\b/.test(lower)) return { date: iso(today), time, confidence: "relative" };
  if (/\byesterday\b/.test(lower)) {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return { date: iso(d), time, confidence: "relative" };
  }

  // Mon, Jan 5, 2024 at 4:32 PM  /  Jan 5 at 4:32 PM
  const named = lower.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:\w{0,2})?(?:,?\s*(\d{4}))?/,
  );
  if (named) {
    const month = MONTHS[named[1]!]!;
    const day = Number(named[2]);
    const year = named[3] ? Number(named[3]) : today.getFullYear();
    if (day >= 1 && day <= 31) {
      return { date: `${year}-${pad(month)}-${pad(day)}`, time, confidence: "explicit_date" };
    }
  }

  // 1/5/24 or 01/05/2024 or 2024-01-05
  const isoish = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoish) {
    return {
      date: `${isoish[1]}-${pad(Number(isoish[2]))}-${pad(Number(isoish[3]))}`,
      time,
      confidence: "explicit_date",
    };
  }
  const slash = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (slash) {
    const yr = Number(slash[3]);
    const year = yr < 100 ? 2000 + yr : yr;
    return {
      date: `${year}-${pad(Number(slash[1]))}-${pad(Number(slash[2]))}`,
      time,
      confidence: "explicit_date",
    };
  }

  if (time && /^[\s\d:apmAPM.\u200e]+$/.test(s)) {
    return { date: null, time, confidence: "time_only" };
  }
  return null;
}

export function detectAttachmentMarker(text: string): string | null {
  const t = text
    .trim()
    .toLowerCase()
    .replace(/[[\]()]/g, "");
  if (t.length > 24) return null;
  const hit = ATTACHMENT_WORDS.find((w) => t === w || t === `1 ${w}` || t === `${w} attachment`);
  return hit ? text.trim() : null;
}

/** Bubble side from horizontal position only — colour picking is unreliable. */
export function sideFromPosition(x0: number, x1: number, imageWidth: number): SenderSide {
  if (!imageWidth) return "unknown";
  const center = (x0 + x1) / 2 / imageWidth;
  if (center > 0.58) return "outgoing";
  if (center < 0.44) return "incoming";
  return "unknown";
}

/** Contact name/number drawn in the header band at the very top of a screenshot. */
export function extractContactHeader(lines: OcrLine[], imageHeight: number): string | null {
  if (!imageHeight) return null;
  const band = lines.filter((l) => l.y1 < imageHeight * 0.12);
  for (const l of band) {
    const t = l.text.trim();
    if (!t || t.length > 48) continue;
    if (/^(back|messages|edit|cancel|done|\d{1,2}:\d{2})/i.test(t)) continue;
    if (/[A-Za-z]{2}/.test(t) || /\d{7,}/.test(t)) return t;
  }
  return null;
}

/**
 * Groups OCR lines into candidate messages: lines that sit on the same side and
 * are vertically close belong to one bubble.
 */
export function groupLinesIntoMessages(
  lines: OcrLine[],
  imageWidth: number,
  imageHeight: number,
  uploadIndex: number,
  today = new Date(),
): DraftMessage[] {
  const sorted = [...lines].sort((a, b) => a.y0 - b.y0);
  const bodyLines = sorted.filter((l) => l.y0 > imageHeight * 0.1 && l.text.trim().length > 0);

  const out: DraftMessage[] = [];
  let ctxDate: string | null = null;
  let ctxTime: string | null = null;
  let ctxConfidence: DateConfidence = "none";
  let current: DraftMessage | null = null;
  let lastY = -Infinity;

  const flush = () => {
    if (current && current.body.trim()) out.push(current);
    current = null;
  };

  for (const line of bodyLines) {
    const text = line.text.replace(/\s+/g, " ").trim();
    const stamp = parseStampLine(text, today);
    if (stamp) {
      flush();
      if (stamp.date) ctxDate = stamp.date;
      ctxTime = stamp.time;
      ctxConfidence = stamp.confidence;
      lastY = line.y1;
      continue;
    }

    const side = sideFromPosition(line.x0, line.x1, imageWidth);
    const gap = line.y0 - lastY;
    const sameBubble = current && side === current.sender_side && gap < (line.y1 - line.y0) * 1.8;

    if (sameBubble && current) {
      current.body = `${current.body} ${text}`.trim();
      current.ocr_confidence = Math.min(current.ocr_confidence, line.confidence);
    } else {
      flush();
      current = {
        body: text,
        sender_side: side,
        sent_on: ctxDate,
        sent_at_time: ctxTime,
        date_confidence: ctxDate ? ctxConfidence : ctxTime ? "time_only" : "none",
        has_attachment_marker: false,
        attachment_marker_text: null,
        ocr_confidence: line.confidence,
        upload_index: uploadIndex,
      };
    }
    lastY = line.y1;
  }
  flush();

  for (const m of out) {
    const marker = detectAttachmentMarker(m.body);
    if (marker) {
      m.has_attachment_marker = true;
      m.attachment_marker_text = marker;
    }
  }
  return out;
}

// ---------- duplicate / overlap merging ----------

export function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const set = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3));
  return set;
}

export function similarity(a: string, b: string): number {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = trigrams(na);
  const tb = trigrams(nb);
  let shared = 0;
  ta.forEach((t) => {
    if (tb.has(t)) shared++;
  });
  return (2 * shared) / (ta.size + tb.size);
}

export interface MergedMessage extends DraftMessage {
  source_indices: number[];
}

const SHORT_TEXT_CHARS = 12;
const SIMILARITY_THRESHOLD = 0.9;

/**
 * Merges the same message captured in two overlapping screenshots. Very short
 * texts ("ok", "yes") only merge when the screenshots are adjacent in upload
 * order — identical short text sent at unrelated times must stay separate.
 * A merge never discards a screenshot: both indices survive on the kept row.
 */
export function mergeDuplicates(perImage: DraftMessage[][]): MergedMessage[] {
  const kept: MergedMessage[] = [];
  perImage.forEach((messages, imageIdx) => {
    for (const m of messages) {
      const short = normalizeForCompare(m.body).length <= SHORT_TEXT_CHARS;
      const match = kept.find((k) => {
        if (similarity(k.body, m.body) < SIMILARITY_THRESHOLD) return false;
        if (k.sent_on && m.sent_on && k.sent_on !== m.sent_on) return false;
        if (k.sent_at_time && m.sent_at_time && k.sent_at_time !== m.sent_at_time) return false;
        if (short) {
          const adjacent = k.source_indices.some((i) => Math.abs(i - imageIdx) <= 1);
          if (!adjacent) return false;
        }
        return true;
      });
      if (match) {
        if (!match.source_indices.includes(imageIdx)) match.source_indices.push(imageIdx);
        // Keep the richest version of each field.
        if (!match.sent_on && m.sent_on) {
          match.sent_on = m.sent_on;
          match.date_confidence = m.date_confidence;
        }
        if (!match.sent_at_time && m.sent_at_time) match.sent_at_time = m.sent_at_time;
        if (match.sender_side === "unknown" && m.sender_side !== "unknown")
          match.sender_side = m.sender_side;
        if (m.body.length > match.body.length) match.body = m.body;
      } else {
        kept.push({ ...m, source_indices: [imageIdx] });
      }
    }
  });
  return kept;
}

/** Chronological where dates are known; upload order otherwise (never dropped). */
export function orderMessages(messages: MergedMessage[]): MergedMessage[] {
  return [...messages].sort((a, b) => {
    const ka = `${a.sent_on ?? "9999-99-99"} ${a.sent_at_time ?? "99:99:99"}`;
    const kb = `${b.sent_on ?? "9999-99-99"} ${b.sent_at_time ?? "99:99:99"}`;
    if (ka !== kb) return ka < kb ? -1 : 1;
    return (a.source_indices[0] ?? 0) - (b.source_indices[0] ?? 0);
  });
}
