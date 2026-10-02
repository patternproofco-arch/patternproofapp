// Neutral, computed-only summaries of a parsed chat export. Counts and times,
// never characterisation: "14 messages between 1:07 AM and 2:58 AM", not
// "harassing messages". Courts discard software that labels people, and a
// survivor's record should only ever say what the file says.

import { CALL_RECORD_SENDER, type ChatMessage } from "./parse";

export interface DayDigest {
  date: string;
  total: number;
  bySender: { name: string; count: number }[];
  /** Earliest / latest HH:MM:SS seen that day. */
  firstTime: string | null;
  lastTime: string | null;
  /** Messages stamped between 00:00 and 05:59. */
  overnight: number;
  callRecords: number;
  attachments: number;
}

const OVERNIGHT_END_HOUR = 6;

export type DigestMessage = Pick<
  ChatMessage,
  "sender" | "kind" | "sent_on" | "sent_at_time" | "has_attachment_marker"
>;

export function buildDayDigest(messages: DigestMessage[]): DayDigest[] {
  const days = new Map<string, DayDigest & { _s: Map<string, number> }>();
  for (const m of messages) {
    if (!m.sent_on) continue;
    let d = days.get(m.sent_on);
    if (!d) {
      d = {
        date: m.sent_on,
        total: 0,
        bySender: [],
        firstTime: null,
        lastTime: null,
        overnight: 0,
        callRecords: 0,
        attachments: 0,
        _s: new Map(),
      };
      days.set(m.sent_on, d);
    }
    d.total++;
    if (m.kind === "call_record") d.callRecords++;
    else d._s.set(m.sender, (d._s.get(m.sender) ?? 0) + 1);
    if (m.has_attachment_marker) d.attachments++;
    const t = m.sent_at_time;
    if (t) {
      if (!d.firstTime || t < d.firstTime) d.firstTime = t;
      if (!d.lastTime || t > d.lastTime) d.lastTime = t;
      if (Number(t.slice(0, 2)) < OVERNIGHT_END_HOUR) d.overnight++;
    }
  }
  return [...days.values()]
    .map(({ _s, ...d }) => ({
      ...d,
      bySender: [..._s.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** "13:07:00" -> "1:07 AM". */
export function formatClock(t: string): string {
  const [h, m] = t.split(":").map(Number) as [number, number];
  const mer = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${mer}`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * One factual sentence for a day. `meName` is the survivor's own name in the
 * export, used only to word "you" vs a named other person.
 */
export function describeDay(day: DayDigest, meName?: string | null): string {
  const parts: string[] = [];
  const texts = day.bySender;
  if (texts.length > 0) {
    const each = texts
      .map((s) => `${plural(s.count, "message")} from ${s.name === meName ? "you" : s.name}`)
      .join(", ");
    parts.push(each);
  }
  if (day.callRecords > 0) parts.push(plural(day.callRecords, "call record"));
  if (day.attachments > 0) parts.push(plural(day.attachments, "attachment"));
  let sentence = parts.join("; ") || plural(day.total, "entry", "entries");
  if (day.firstTime && day.lastTime) {
    sentence +=
      day.firstTime === day.lastTime
        ? ` at ${formatClock(day.firstTime)}`
        : `, between ${formatClock(day.firstTime)} and ${formatClock(day.lastTime)}`;
  }
  return `${sentence}.`;
}

export { CALL_RECORD_SENDER };
