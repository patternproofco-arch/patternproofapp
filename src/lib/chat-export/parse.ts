// Pure, deterministic parser for exported chat transcripts (WhatsApp iOS and
// Android .txt, plus the generic "date time - Name: text" family).
// No network, no AI. Runs in the survivor's browser; everything is testable.

export type DateOrder = "mdy" | "dmy" | "ymd";

/** Sender label for call records the app wrote into the chat (not a person). */
export const CALL_RECORD_SENDER = "(call record)";

export interface ChatMessage {
  /** Name exactly as it appears in the export, or CALL_RECORD_SENDER. */
  sender: string;
  kind: "text" | "call_record";
  /** YYYY-MM-DD, or null when the date could not be read as a real calendar date. */
  sent_on: string | null;
  /** HH:MM:SS (24h). */
  sent_at_time: string | null;
  body: string;
  has_attachment_marker: boolean;
  attachment_marker_text: string | null;
  /** 1-based line number of the message's first line in the source file. */
  line: number;
}

export interface ChatParseResult {
  /** Which header shape matched: "[date, time] Name: text" or "date, time - Name: text". */
  format: "bracketed" | "dashed" | "unrecognized";
  messages: ChatMessage[];
  participants: { name: string; count: number }[];
  dateOrder: DateOrder;
  /** True when the file gave no way to tell day-first from month-first. */
  dateOrderAssumed: boolean;
  /** Lines the app wrote about itself (encryption notice, "X joined"…), not imported. */
  systemLines: {
    sent_on: string | null;
    sent_at_time: string | null;
    text: string;
    line: number;
  }[];
  /** Non-empty lines before the first message that were not messages. */
  ignoredLeadingLines: number;
  /** Messages whose date was not a real calendar date. */
  undatedCount: number;
  firstDate: string | null;
  lastDate: string | null;
  warnings: string[];
}

export interface ParseOptions {
  /** Force the day/month order instead of inferring it. */
  dateOrder?: DateOrder;
}

const INVISIBLE = /[‎‏‪-‮﻿]/g;
const SPACES = /[   ]/g;

const ATTACHMENT_PATTERNS: RegExp[] = [
  /^<media omitted>$/i,
  /^<attached:\s*[^>]+>$/i,
  /^(image|video|audio|sticker|gif|document|contact card|location|voice message)\s+omitted$/i,
  /^[\w\-. ()]+\.(jpe?g|png|gif|webp|heic|mp4|mov|opus|m4a|mp3|pdf|vcf)\s*\(file attached\)$/i,
  /^<attached:.*>$/i,
];

// Lines the app writes about itself. Tested against the text BEFORE the first
// colon (the would-be sender name) or a colon-less line — never against a
// person's message body, so a real message is never dropped as "system".
const SYSTEM_PHRASES: RegExp[] = [
  /messages and calls are end-to-end encrypted/i,
  /messages to this (chat|group) are now secured/i,
  /^you (created|joined|left|were added|were removed)/i,
  /\b(created|changed|deleted) (this )?group/i,
  /changed the subject/i,
  /changed (this group's|the group) (icon|description|settings)/i,
  /security code (with .+ )?changed/i,
  /changed their phone number/i,
  /turned (on|off) disappearing messages/i,
  /\b(added|removed) .+/i,
  /\bjoined using this group's invite link$/i,
  /\bleft$/i,
];

// Call entries ARE evidence of contact, so they are kept as call records.
const CALL_RECORD = /^(missed|declined)?\s*(voice|video) call\b/i;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function normalizeYear(raw: string): number {
  const n = Number(raw);
  return raw.length <= 2 ? 2000 + n : n;
}

// A header is "<stamp> <separator> <rest>". Two shapes cover WhatsApp and most
// generic exports; the stamp itself is parsed separately.
const STAMP =
  "(\\d{1,4}[\\/.\\-]\\d{1,2}[\\/.\\-]\\d{1,4}),?\\s+(\\d{1,2}[:.]\\d{2}(?:[:.]\\d{2})?(?:\\s?[AaPp]\\.?\\s?[Mm]\\.?)?)";
const BRACKET_HEADER = new RegExp(`^\\[\\s*${STAMP}\\s*\\]\\s*(.*)$`);
const DASH_HEADER = new RegExp(`^${STAMP}\\s+[-–—]\\s+(.*)$`);

interface RawHeader {
  style: "bracket" | "dash";
  date: string;
  time: string;
  rest: string;
}

function matchHeader(line: string): RawHeader | null {
  const b = line.match(BRACKET_HEADER);
  if (b) return { style: "bracket", date: b[1]!, time: b[2]!, rest: b[3]! };
  const d = line.match(DASH_HEADER);
  if (d) return { style: "dash", date: d[1]!, time: d[2]!, rest: d[3]! };
  return null;
}

/** "4:32:10 PM" / "16:32" / "4.32 p.m." -> "HH:MM:SS". */
export function parseExportTime(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s?([AaPp])?\.?\s?([Mm])?\.?$/);
  if (!m) return null;
  let hour = Number(m[1]);
  const min = Number(m[2]);
  const sec = m[3] ? Number(m[3]) : 0;
  if (min > 59 || sec > 59) return null;
  const mer = m[4]?.toLowerCase();
  if (mer) {
    if (hour < 1 || hour > 12) return null;
    if (mer === "p" && hour < 12) hour += 12;
    if (mer === "a" && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }
  return `${pad(hour)}:${pad(min)}:${pad(sec)}`;
}

function splitDate(raw: string): [string, string, string] | null {
  const m = raw.match(/^(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4})$/);
  return m ? [m[1]!, m[2]!, m[3]!] : null;
}

/**
 * Looks at every date in the file. A part above 12 settles day vs month; four
 * digits first means year-first. If nothing settles it we say so rather than
 * silently guessing — a day/month swap would put whole conversations on the
 * wrong dates in front of a judge.
 */
export function inferDateOrder(dates: string[]): { order: DateOrder; assumed: boolean } {
  let firstIsYear = false;
  let firstOver12 = false;
  let secondOver12 = false;
  for (const raw of dates) {
    const p = splitDate(raw);
    if (!p) continue;
    if (p[0].length === 4) {
      firstIsYear = true;
      continue;
    }
    if (Number(p[0]) > 12) firstOver12 = true;
    if (Number(p[1]) > 12) secondOver12 = true;
  }
  if (firstIsYear) return { order: "ymd", assumed: false };
  if (firstOver12 && !secondOver12) return { order: "dmy", assumed: false };
  if (secondOver12 && !firstOver12) return { order: "mdy", assumed: false };
  return { order: "mdy", assumed: true };
}

function toIsoDate(raw: string, order: DateOrder): string | null {
  const p = splitDate(raw);
  if (!p) return null;
  let y: number, m: number, d: number;
  if (order === "ymd") {
    if (p[0].length !== 4) return null;
    [y, m, d] = [Number(p[0]), Number(p[1]), Number(p[2])];
  } else {
    if (p[2].length !== 4 && p[2].length !== 2) return null;
    y = normalizeYear(p[2]);
    if (order === "mdy") [m, d] = [Number(p[0]), Number(p[1])];
    else [d, m] = [Number(p[0]), Number(p[1])];
  }
  return isRealDate(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
}

function attachmentMarker(body: string): string | null {
  const t = body.trim();
  if (!t) return null;
  for (const re of ATTACHMENT_PATTERNS) if (re.test(t)) return t.slice(0, 120);
  return null;
}

/** Splits "Name: body". Returns null when there is no sender (a system line). */
function splitSender(rest: string): { sender: string; body: string } | null {
  const m = rest.match(/^([^:]{1,80}?):\s?([\s\S]*)$/);
  if (!m) return null;
  const sender = m[1]!.trim();
  if (!sender || SYSTEM_PHRASES.some((re) => re.test(sender))) return null;
  return { sender, body: m[2]! };
}

interface Draft {
  header: RawHeader;
  kind: "text" | "call_record";
  sender: string;
  body: string;
  line: number;
}

export function parseChatExport(input: string, options: ParseOptions = {}): ChatParseResult {
  const text = input.replace(INVISIBLE, "").replace(SPACES, " ");
  const lines = text.split(/\r\n|\n|\r/);

  const drafts: Draft[] = [];
  let current: Draft | null = null;
  const systemRaw: { header: RawHeader; text: string; line: number }[] = [];
  let ignoredLeadingLines = 0;
  let bracketHeaders = 0;
  let dashHeaders = 0;
  // A system line must not swallow the next message's continuation lines.
  let inSystem = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const header = matchHeader(line);
    if (header) {
      inSystem = false;
      const split = splitSender(header.rest);
      if (!split) {
        const restText = header.rest.trim();
        if (CALL_RECORD.test(restText)) {
          drafts.push({
            header,
            kind: "call_record",
            sender: CALL_RECORD_SENDER,
            body: restText,
            line: i + 1,
          });
        } else {
          systemRaw.push({ header, text: restText, line: i + 1 });
        }
        current = null;
        inSystem = true;
        continue;
      }
      if (header.style === "bracket") bracketHeaders++;
      else dashHeaders++;
      current = { header, kind: "text", sender: split.sender, body: split.body, line: i + 1 };
      drafts.push(current);
    } else if (current && !inSystem) {
      // A continuation line of a multi-line message. Blank lines inside a
      // message are kept; trailing ones are trimmed below.
      current.body += `\n${line}`;
    } else if (!current && !inSystem && line.trim()) {
      if (drafts.length === 0) ignoredLeadingLines++;
    }
  }

  const rawDates = drafts.map((d) => d.header.date);
  const inferred = inferDateOrder(rawDates);
  const order = options.dateOrder ?? inferred.order;
  const assumed = options.dateOrder ? false : inferred.assumed;

  const messages: ChatMessage[] = drafts.map((d) => {
    const body = d.body.replace(/\s+$/, "");
    const marker = attachmentMarker(body);
    return {
      sender: d.sender,
      kind: d.kind,
      sent_on: toIsoDate(d.header.date, order),
      sent_at_time: parseExportTime(d.header.time),
      body,
      has_attachment_marker: marker !== null,
      attachment_marker_text: marker,
      line: d.line,
    };
  });

  const counts = new Map<string, number>();
  for (const m of messages) {
    if (m.kind === "text") counts.set(m.sender, (counts.get(m.sender) ?? 0) + 1);
  }
  const participants = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const dated = messages.map((m) => m.sent_on).filter((v): v is string => !!v);
  const sortedDates = [...dated].sort();
  const undatedCount = messages.length - dated.length;

  const warnings: string[] = [];
  if (messages.length === 0) {
    warnings.push(
      "We couldn't find any messages in this file. It may not be a chat export we can read yet — screenshots always work.",
    );
  }
  if (assumed && messages.length > 0) {
    warnings.push(
      "Dates like 03/04/24 can mean March 4 or April 3, and this file doesn't settle it. Check the first and last dates below and switch the order if they look wrong.",
    );
  }
  if (undatedCount > 0) {
    warnings.push(
      `${undatedCount} message${undatedCount === 1 ? "" : "s"} had a date that isn't a real calendar date, so they were kept without one.`,
    );
  }
  if (participants.length > 6) {
    warnings.push(
      "More than six senders were found — this may be a group chat, or some lines may have been read as names by mistake.",
    );
  }

  const format: ChatParseResult["format"] =
    messages.length === 0 ? "unrecognized" : bracketHeaders >= dashHeaders ? "bracketed" : "dashed";

  const systemLines = systemRaw.map((r) => ({
    sent_on: toIsoDate(r.header.date, order),
    sent_at_time: parseExportTime(r.header.time),
    text: r.text.slice(0, 200),
    line: r.line,
  }));

  return {
    format,
    messages,
    participants,
    dateOrder: order,
    dateOrderAssumed: assumed,
    systemLines,
    ignoredLeadingLines,
    undatedCount,
    firstDate: sortedDates[0] ?? null,
    lastDate: sortedDates[sortedDates.length - 1] ?? null,
    warnings,
  };
}
