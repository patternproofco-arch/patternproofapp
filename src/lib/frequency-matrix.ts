// Objective message frequency matrix.
//
// Deterministic counts over messages exactly as they were imported. No AI, no
// scoring, no wording about what any message says or means. The same input
// always produces the same sheet. Sender names are shown as they appear in the
// imported file; nothing here relabels a person.

/** The only fields the matrix ever reads. Message text is never needed. */
export interface MatrixInputMessage {
  sender: string | null;
  sender_side: string | null;
  /** YYYY-MM-DD as stored. Anything else is treated as "no date". */
  sent_on: string | null;
  /** HH:MM or HH:MM:SS as stored, no time zone conversion. */
  sent_at_time: string | null;
  has_attachment_marker?: boolean | null;
  is_call_record?: boolean | null;
  /**
   * Source file for this row, when known. Used only to detect overlapping
   * imports (same stamp from more than one file). Never printed as body text.
   */
  sourceDocumentId?: string | null;
}

export type MatrixGranularity = "day" | "week" | "month" | "quarter" | "year";

export interface MatrixColumn {
  key: string;
  label: string;
  total: number;
}

export interface MatrixRow {
  key: string;
  label: string;
  /** One count per column, same order as `columns`. */
  counts: number[];
  total: number;
  /** Messages stamped 12:00 to 5:59 AM. */
  earlyHours: number;
  /** Distinct dates in this period with at least one message. */
  daysWithMessages: number;
}

export interface WeekGridRow {
  day: string;
  /** One count per time block, same order as `TIME_BLOCKS`. */
  counts: number[];
  noTime: number;
  total: number;
}

export interface MatrixParticipant {
  label: string;
  count: number;
}

export interface MatrixSourceEntry {
  label: string;
  detail?: string | null;
}

export interface MatrixCoverage {
  /** True when the reader stopped at MATRIX_MAX_MESSAGES. */
  truncatedAtLimit: boolean;
  /** Messages used for counts after duplicate/overlap rules. */
  countedMessages: number;
  /** Raw rows before duplicate/overlap drop. */
  rawImported: number;
  /** Thread.message_count when known; null if unknown. */
  storedMessageCount: number | null;
  /** Import/parse marked incomplete or partial. */
  incompleteExport: boolean;
  incompleteReason: string | null;
  duplicatesSkipped: number;
  overlapDuplicatesSkipped: number;
}

export interface FrequencyMatrix {
  totals: {
    imported: number;
    dated: number;
    undated: number;
    callRecords: number;
    attachments: number;
    withTime: number;
    earlyHours: number;
    duplicatesSkipped: number;
    overlapDuplicatesSkipped: number;
  };
  coverage: MatrixCoverage;
  /** Every named participant (and call records), not capped to page columns. */
  participants: MatrixParticipant[];
  /** Supporting source index (files / import notes). */
  sources: MatrixSourceEntry[];
  firstDate: string | null;
  lastDate: string | null;
  spanDays: number;
  granularity: MatrixGranularity | null;
  columns: MatrixColumn[];
  /** Period rows shown on the one-page summary. */
  rows: MatrixRow[];
  /**
   * Remaining period rows when the full span does not fit the summary page.
   * Totals still include every dated message; nothing is dropped from counts.
   */
  appendixRows: MatrixRow[];
  busiestDay: { date: string; count: number } | null;
  weekGrid: WeekGridRow[];
}

export interface MatrixMeta {
  conversation: string;
  source?: string | null;
  importedOn?: string | null;
  exhibitLabel?: string | null;
  generatedOn: string;
  /** Approved exhibit package version, when the attorney has fixed numbers. */
  packageVersion?: number | null;
}

/* ------------------------------ soft copy ------------------------------ */

export const MATRIX_TITLE = "Message frequency matrix";
export const MATRIX_SUBTITLE = "Observed counts from imported messages";
export const MATRIX_NOTES: readonly string[] = [
  "Counts only. This sheet does not describe what any message says or means.",
  "Counted from the imported file as stored in PatternProof. Sender names are shown as they appear in that file.",
  "Duplicate rows with the same sender, date, and time are counted once. When that same stamp appears in more than one imported file, it is counted once and noted as an overlapping import. Rows without a date or time are each counted separately.",
  "Group chats list every participant in the source index. The period grid shows up to three named senders; additional senders are grouped as Other senders.",
  "Call records are counted in their own column, not as a person. Messages without a date are counted in the total but not placed in the period grid.",
  "Times are as shown in the file, with no time zone conversion. The 12:00-5:59 AM column counts messages stamped in that window.",
  "If an import is incomplete or the conversation is larger than the reader limit, the coverage note above says what was included and what was not.",
  "Prepared from the account holder's own records. Please check counts against the original file before relying on them.",
];
export const MATRIX_EMPTY =
  "No imported messages with dates yet. Once a chat export or screenshots are imported, counts appear here.";

/** Fits one printed letter page alongside the day-of-week grid. */
export const MAX_PERIOD_ROWS = 20;
/** Named sender columns before the rest are grouped. */
export const MAX_SENDER_COLUMNS = 3;

export const TIME_BLOCKS = ["12-6 AM", "6 AM-12 PM", "12-6 PM", "6 PM-12 AM"] as const;
export const EARLY_HOURS_LABEL = "12:00-5:59 AM";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const CALL_RECORD_SENDER = "(call record)";
const CALLS_KEY = "__calls";
const OTHER_KEY = "__other";

/* ------------------------------ date helpers ------------------------------ */

const DAY_MS = 86_400_000;

/** UTC midnight ms for a valid YYYY-MM-DD, otherwise null. */
export function parseDay(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
    return null;
  }
  return t;
}

/** Hour 0-23 from HH:MM[:SS], otherwise null. */
export function parseHour(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h;
}

function isoDay(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** "Mar 3, 2025". Deterministic, no locale. */
export function formatDay(iso: string): string {
  const t = parseDay(iso);
  if (t == null) return iso;
  const d = new Date(t);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** 0 = Monday ... 6 = Sunday. */
function weekdayIndex(t: number): number {
  return (new Date(t).getUTCDay() + 6) % 7;
}

function periodStart(t: number, g: MatrixGranularity): number {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  switch (g) {
    case "day":
      return t;
    case "week":
      return t - weekdayIndex(t) * DAY_MS;
    case "month":
      return Date.UTC(y, m, 1);
    case "quarter":
      return Date.UTC(y, m - (m % 3), 1);
    case "year":
      return Date.UTC(y, 0, 1);
  }
}

function nextPeriod(start: number, g: MatrixGranularity): number {
  const d = new Date(start);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  switch (g) {
    case "day":
      return start + DAY_MS;
    case "week":
      return start + 7 * DAY_MS;
    case "month":
      return Date.UTC(y, m + 1, 1);
    case "quarter":
      return Date.UTC(y, m + 3, 1);
    case "year":
      return Date.UTC(y + 1, 0, 1);
  }
}

function periodLabel(start: number, g: MatrixGranularity): string {
  const d = new Date(start);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  switch (g) {
    case "day":
      return `${WEEKDAYS[weekdayIndex(start)]} ${formatDay(isoDay(start))}`;
    case "week":
      return `Week of ${formatDay(isoDay(start))}`;
    case "month":
      return `${MONTHS[m]} ${y}`;
    case "quarter":
      return `Q${Math.floor(m / 3) + 1} ${y}`;
    case "year":
      return String(y);
  }
}

function countPeriods(first: number, last: number, g: MatrixGranularity): number {
  let n = 0;
  for (let p = periodStart(first, g); p <= last; p = nextPeriod(p, g)) {
    n++;
    if (n > MAX_PERIOD_ROWS) break;
  }
  return n;
}

/** The finest grouping whose row count still fits one page. */
export function chooseGranularity(first: number, last: number): MatrixGranularity {
  for (const g of ["day", "week", "month", "quarter"] as const) {
    if (countPeriods(first, last, g) <= MAX_PERIOD_ROWS) return g;
  }
  return "year";
}

/* ------------------------------ prepare / dedup ------------------------------ */

export type BuildMatrixOptions = {
  /** Reader stopped at the 50,000-message limit. */
  truncated?: boolean;
  /** message_threads.message_count when known. */
  storedMessageCount?: number | null;
  /** Import or parse did not finish cleanly. */
  incompleteExport?: boolean;
  incompleteReason?: string | null;
  /** Supporting source index entries (filenames, capture notes). */
  sources?: readonly MatrixSourceEntry[];
};

/**
 * Fingerprint for count dedup: sender, side, date, and time, plus call/attachment
 * markers. Message body is never part of this. Rows without both a parseable date
 * and time are kept individually (index makes the key unique) so undated or
 * untimed messages are not collapsed. Same stamp from different source files is
 * an overlapping import (still counted once).
 */
export function countFingerprint(m: MatrixInputMessage, index: number): string {
  const day = (m.sent_on ?? "").trim();
  const time = (m.sent_at_time ?? "").trim();
  if (parseDay(day) == null || parseHour(time) == null) {
    return `row:${index}`;
  }
  const sender = (m.sender ?? "").trim();
  const side = (m.sender_side ?? "").trim() || "unknown";
  const call = isCall(m) ? "1" : "0";
  const att = m.has_attachment_marker ? "1" : "0";
  return `${call}|${sender}|${side}|${day}|${time}|${att}`;
}

export type PreparedMatrixMessages = {
  /** Rows kept for counting (first occurrence of each fingerprint). */
  messages: MatrixInputMessage[];
  rawImported: number;
  duplicatesSkipped: number;
  overlapDuplicatesSkipped: number;
  participants: MatrixParticipant[];
};

/**
 * Deterministic prepare step: drop exact duplicate stamps; when the same stamp
 * appears under more than one source document, keep one row and note the overlap.
 * Order is preserved (first wins).
 */
export function prepareMatrixMessages(
  messages: readonly MatrixInputMessage[],
): PreparedMatrixMessages {
  const seen = new Map<string, { source: string | null }>();
  const kept: MatrixInputMessage[] = [];
  let duplicatesSkipped = 0;
  let overlapDuplicatesSkipped = 0;
  messages.forEach((m, index) => {
    const fp = countFingerprint(m, index);
    const src = m.sourceDocumentId?.trim() || null;
    const prior = seen.get(fp);
    if (!prior) {
      seen.set(fp, { source: src });
      kept.push(m);
      return;
    }
    if (src && prior.source && src !== prior.source) {
      overlapDuplicatesSkipped++;
    } else {
      duplicatesSkipped++;
    }
  });

  const participantCounts = new Map<string, number>();
  for (const m of kept) {
    const s = senderOf(m);
    participantCounts.set(s.label, (participantCounts.get(s.label) ?? 0) + 1);
  }
  const participants = [...participantCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    messages: kept,
    rawImported: messages.length,
    duplicatesSkipped,
    overlapDuplicatesSkipped,
    participants,
  };
}

/** Soft coverage lines for the sheet header and plain-text export. */
export function coverageLines(c: MatrixCoverage): string[] {
  const lines: string[] = [];
  const stored = c.storedMessageCount;
  if (c.truncatedAtLimit || (stored != null && stored > c.rawImported)) {
    const ofStored =
      stored != null
        ? ` of ${stored.toLocaleString()} messages stored for this conversation`
        : "";
    lines.push(
      `COVERAGE: Counts include the first ${c.rawImported.toLocaleString()} imported messages${ofStored}. Messages after that were not read for this sheet.`,
    );
  } else if (stored != null && stored > c.countedMessages && c.duplicatesSkipped + c.overlapDuplicatesSkipped > 0) {
    lines.push(
      `COVERAGE: ${c.countedMessages.toLocaleString()} distinct stamps counted from ${c.rawImported.toLocaleString()} imported rows (${stored.toLocaleString()} stored on the thread).`,
    );
  }
  if (c.duplicatesSkipped > 0) {
    lines.push(
      `${c.duplicatesSkipped.toLocaleString()} duplicate row(s) with the same sender, date, and time were counted once.`,
    );
  }
  if (c.overlapDuplicatesSkipped > 0) {
    lines.push(
      `${c.overlapDuplicatesSkipped.toLocaleString()} overlapping import row(s) (same stamp in more than one file) were counted once.`,
    );
  }
  if (c.incompleteExport) {
    lines.push(
      c.incompleteReason?.trim() ||
        "This import is incomplete or partial. Counts cover only messages that were imported.",
    );
  }
  return lines;
}

/* ------------------------------ senders ------------------------------ */

function isCall(m: MatrixInputMessage): boolean {
  return !!m.is_call_record || (m.sender ?? "").trim() === CALL_RECORD_SENDER;
}

/** Column key and label for one message. Names are kept exactly as imported. */
function senderOf(m: MatrixInputMessage): { key: string; label: string } {
  if (isCall(m)) return { key: CALLS_KEY, label: "Call records" };
  const name = (m.sender ?? "").trim();
  if (name) return { key: `name:${name}`, label: name };
  if (m.sender_side === "outgoing")
    return { key: "side:outgoing", label: "Outgoing (no name shown)" };
  if (m.sender_side === "incoming")
    return { key: "side:incoming", label: "Incoming (no name shown)" };
  return { key: "side:unknown", label: "Sender not shown" };
}

/* ------------------------------ builder ------------------------------ */

export function buildFrequencyMatrix(
  messages: readonly MatrixInputMessage[],
  opts: BuildMatrixOptions = {},
): FrequencyMatrix {
  const prepared = prepareMatrixMessages(messages);
  const working = prepared.messages;

  const totals = {
    imported: prepared.rawImported,
    dated: 0,
    undated: 0,
    callRecords: 0,
    attachments: 0,
    withTime: 0,
    earlyHours: 0,
    duplicatesSkipped: prepared.duplicatesSkipped,
    overlapDuplicatesSkipped: prepared.overlapDuplicatesSkipped,
  };

  // Sender totals decide which names get their own column (all messages, dated or not).
  const senderCounts = new Map<string, { label: string; count: number }>();
  for (const m of working) {
    const s = senderOf(m);
    const cur = senderCounts.get(s.key) ?? { label: s.label, count: 0 };
    cur.count++;
    senderCounts.set(s.key, cur);
    if (s.key === CALLS_KEY) totals.callRecords++;
    if (m.has_attachment_marker) totals.attachments++;
  }
  const ranked = [...senderCounts.entries()]
    .filter(([k]) => k !== CALLS_KEY)
    .sort((a, b) => b[1].count - a[1].count || a[1].label.localeCompare(b[1].label));
  const named =
    ranked.length > MAX_SENDER_COLUMNS + 1 ? ranked.slice(0, MAX_SENDER_COLUMNS) : ranked;
  const grouped = ranked.length - named.length;
  const columnKeys = named.map(([k]) => k);
  const columns: MatrixColumn[] = named.map(([k, v]) => ({ key: k, label: v.label, total: 0 }));
  if (grouped > 0) {
    columnKeys.push(OTHER_KEY);
    columns.push({ key: OTHER_KEY, label: `Other senders (${grouped})`, total: 0 });
  }
  if (totals.callRecords > 0) {
    columnKeys.push(CALLS_KEY);
    columns.push({ key: CALLS_KEY, label: "Call records", total: 0 });
  }
  const colIndex = (key: string) => {
    const i = columnKeys.indexOf(key);
    return i >= 0 ? i : columnKeys.indexOf(OTHER_KEY);
  };

  // Dated messages only from here on.
  type Dated = { t: number; hour: number | null; col: number };
  const dated: Dated[] = [];
  for (const m of working) {
    const t = parseDay(m.sent_on);
    if (t == null) {
      totals.undated++;
      continue;
    }
    totals.dated++;
    const hour = parseHour(m.sent_at_time);
    if (hour != null) {
      totals.withTime++;
      if (hour < 6) totals.earlyHours++;
    }
    dated.push({ t, hour, col: colIndex(senderOf(m).key) });
  }

  const coverage: MatrixCoverage = {
    truncatedAtLimit: !!opts.truncated,
    countedMessages: working.length,
    rawImported: prepared.rawImported,
    storedMessageCount: opts.storedMessageCount ?? null,
    incompleteExport: !!opts.incompleteExport,
    incompleteReason: opts.incompleteReason ?? null,
    duplicatesSkipped: prepared.duplicatesSkipped,
    overlapDuplicatesSkipped: prepared.overlapDuplicatesSkipped,
  };
  const sources = [...(opts.sources ?? [])];
  const participants = prepared.participants;

  const weekGrid: WeekGridRow[] = WEEKDAYS.map((day) => ({
    day,
    counts: TIME_BLOCKS.map(() => 0),
    noTime: 0,
    total: 0,
  }));

  const empty = (): FrequencyMatrix => ({
    totals,
    coverage,
    participants,
    sources,
    firstDate: null,
    lastDate: null,
    spanDays: 0,
    granularity: null,
    columns,
    rows: [],
    appendixRows: [],
    busiestDay: null,
    weekGrid,
  });

  if (dated.length === 0) return empty();

  let first = Infinity;
  let last = -Infinity;
  for (const d of dated) {
    if (d.t < first) first = d.t;
    if (d.t > last) last = d.t;
  }
  const granularity = chooseGranularity(first, last);

  // Every period between the first and last date, including empty ones, so
  // quiet stretches show as zeros rather than disappearing.
  const allRows: MatrixRow[] = [];
  const rowByStart = new Map<number, { row: MatrixRow; days: Set<number> }>();
  for (let p = periodStart(first, granularity); p <= last; p = nextPeriod(p, granularity)) {
    const row: MatrixRow = {
      key: isoDay(p),
      label: periodLabel(p, granularity),
      counts: columns.map(() => 0),
      total: 0,
      earlyHours: 0,
      daysWithMessages: 0,
    };
    allRows.push(row);
    rowByStart.set(p, { row, days: new Set() });
  }

  const perDay = new Map<number, number>();
  for (const d of dated) {
    const slot = rowByStart.get(periodStart(d.t, granularity))!;
    slot.row.counts[d.col]!++;
    slot.row.total++;
    slot.days.add(d.t);
    columns[d.col]!.total++;
    if (d.hour != null && d.hour < 6) slot.row.earlyHours++;
    perDay.set(d.t, (perDay.get(d.t) ?? 0) + 1);

    const w = weekGrid[weekdayIndex(d.t)]!;
    w.total++;
    if (d.hour == null) w.noTime++;
    else w.counts[Math.floor(d.hour / 6)]!++;
  }
  for (const { row, days } of rowByStart.values()) row.daysWithMessages = days.size;

  let busiestDay: { date: string; count: number } | null = null;
  for (const [t, count] of [...perDay.entries()].sort((a, b) => a[0] - b[0])) {
    if (!busiestDay || count > busiestDay.count) busiestDay = { date: isoDay(t), count };
  }

  // One-page summary: keep the first MAX_PERIOD_ROWS periods; put the rest in an
  // appendix rather than shrinking type. Totals still cover every dated message.
  const rows = allRows.slice(0, MAX_PERIOD_ROWS);
  const appendixRows = allRows.length > MAX_PERIOD_ROWS ? allRows.slice(MAX_PERIOD_ROWS) : [];

  return {
    totals,
    coverage,
    participants,
    sources,
    firstDate: isoDay(first),
    lastDate: isoDay(last),
    spanDays: Math.round((last - first) / DAY_MS) + 1,
    granularity,
    columns,
    rows,
    appendixRows,
    busiestDay,
    weekGrid,
  };
}

/* ------------------------------ text output ------------------------------ */

const GROUPING_LABEL: Record<MatrixGranularity, string> = {
  day: "by day",
  week: "by week (Monday start)",
  month: "by month",
  quarter: "by quarter",
  year: "by year",
};

export function groupingLabel(g: MatrixGranularity | null): string {
  return g ? GROUPING_LABEL[g] : "";
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function summaryLine(m: FrequencyMatrix): string {
  const bits = [
    plural(m.totals.imported, "imported message"),
    `${m.coverage.countedMessages} counted`,
    `${m.totals.dated} with a date`,
    `${m.totals.undated} without a date`,
  ];
  if (m.totals.callRecords > 0) bits.push(plural(m.totals.callRecords, "call record"));
  if (m.totals.attachments > 0) bits.push(plural(m.totals.attachments, "attachment marker"));
  if (m.totals.duplicatesSkipped > 0)
    bits.push(plural(m.totals.duplicatesSkipped, "duplicate skipped", "duplicates skipped"));
  if (m.totals.overlapDuplicatesSkipped > 0)
    bits.push(plural(m.totals.overlapDuplicatesSkipped, "overlap skipped", "overlaps skipped"));
  return bits.join(" · ");
}

export function rangeLine(m: FrequencyMatrix): string | null {
  if (!m.firstDate || !m.lastDate) return null;
  return `${formatDay(m.firstDate)} to ${formatDay(m.lastDate)} (${plural(m.spanDays, "day")}), grouped ${groupingLabel(m.granularity)}`;
}

function table(header: string[], body: string[][]): string[] {
  const widths = header.map((h, i) => Math.max(h.length, ...body.map((r) => (r[i] ?? "").length)));
  const fmt = (cells: string[]) =>
    cells
      .map((c, i) => (i === 0 ? c.padEnd(widths[i]!) : c.padStart(widths[i]!)))
      .join(" | ")
      .trimEnd();
  return [fmt(header), widths.map((w) => "-".repeat(w)).join("-+-"), ...body.map(fmt)];
}

export function periodTableHeader(m: FrequencyMatrix): string[] {
  return [
    "Period",
    ...m.columns.map((c) => c.label),
    "Total",
    EARLY_HOURS_LABEL,
    "Days with messages",
  ];
}

/** Plain text a person can paste into a document. Same numbers as the sheet. */
export function frequencyMatrixToText(m: FrequencyMatrix, meta: MatrixMeta): string {
  const out: string[] = [];
  out.push(`${MATRIX_TITLE.toUpperCase()} (${MATRIX_SUBTITLE.toLowerCase()})`);
  if (meta.exhibitLabel?.trim()) out.push(meta.exhibitLabel.trim());
  if (meta.packageVersion != null) out.push(`Exhibit package: v${meta.packageVersion}`);
  else if ("packageVersion" in meta) out.push("Exhibit package: none (provisional labels)");
  out.push(`Conversation: ${meta.conversation}`);
  if (meta.source) out.push(`Source file: ${meta.source}`);
  if (meta.importedOn) out.push(`Imported: ${meta.importedOn}`);
  out.push(`Prepared: ${meta.generatedOn}`);
  for (const line of coverageLines(m.coverage)) out.push(line);
  out.push(summaryLine(m));
  const range = rangeLine(m);
  if (range) out.push(`Range: ${range}`);
  out.push("");

  const periodDays = [...m.rows, ...m.appendixRows].reduce((n, r) => n + r.daysWithMessages, 0);
  const periodBody = (rows: MatrixRow[]) =>
    rows.map((r) => [
      r.label,
      ...r.counts.map(String),
      String(r.total),
      String(r.earlyHours),
      String(r.daysWithMessages),
    ]);
  const totalsRow = [
    "All periods",
    ...m.columns.map((c) => String(c.total)),
    String(m.totals.dated),
    String(m.totals.earlyHours),
    String(periodDays),
  ];

  if (m.rows.length === 0) {
    out.push(MATRIX_EMPTY);
  } else {
    if (m.appendixRows.length > 0) {
      out.push(
        `Summary period grid (${m.rows.length} of ${m.rows.length + m.appendixRows.length} periods). Totals include every dated message. Remaining periods are in the appendix.`,
      );
    }
    out.push(...table(periodTableHeader(m), [...periodBody(m.rows), totalsRow]));
    if (m.busiestDay) {
      out.push("");
      out.push(
        `Highest single-day count: ${m.busiestDay.count} on ${formatDay(m.busiestDay.date)}`,
      );
    }
    out.push("");
    out.push("Day of week by time of day (messages with a date)");
    out.push(
      ...table(
        ["Day", ...TIME_BLOCKS, "Time not shown", "Total"],
        m.weekGrid.map((w) => [w.day, ...w.counts.map(String), String(w.noTime), String(w.total)]),
      ),
    );
    if (m.appendixRows.length > 0) {
      out.push("");
      out.push("Appendix: remaining periods (same columns; not shrunk)");
      out.push(...table(periodTableHeader(m), periodBody(m.appendixRows)));
    }
  }

  if (m.participants.length > 0) {
    out.push("");
    out.push("Source index — participants (as shown in the file)");
    for (const p of m.participants) out.push(`- ${p.label}: ${p.count}`);
  }
  if (m.sources.length > 0) {
    out.push("");
    out.push("Source index — files and import notes");
    for (const s of m.sources) {
      out.push(s.detail?.trim() ? `- ${s.label}: ${s.detail}` : `- ${s.label}`);
    }
  }

  out.push("");
  out.push("Notes");
  for (const n of MATRIX_NOTES) out.push(`- ${n}`);
  return out.join("\n");
}
