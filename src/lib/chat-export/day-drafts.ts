// Turns the days a survivor picks from an imported chat into draft entries.
// Pure and deterministic: the text is the survivor's own messages, quoted, with
// counts and times from describeDay. No AI, no characterisation. Nothing here
// reaches her timeline — each draft waits in "Drafts to review" until she
// approves it, and an approved entry is private until she shares it.

import { buildDayDigest, describeDay, formatClock, type DigestMessage } from "./digest";

export const DRAFT_DESCRIPTION_MAX = 4000;
/** Room kept for the closing "N more messages" note. */
const TAIL_RESERVE = 130;

export interface DraftableMessage extends DigestMessage {
  body: string;
}

export interface DayDraft {
  date: string;
  /** HH:MM of the first message that day, or null. */
  time: string | null;
  description: string;
  /** Messages left out of the text because of the length limit. */
  omittedCount: number;
}

const oneLine = (body: string) => body.replace(/\n/g, "\n    ");

/** Draft text for one calendar day of an imported chat. */
export function buildDayDraft(
  date: string,
  messages: DraftableMessage[],
  meName?: string | null,
): DayDraft | null {
  const day = buildDayDigest(messages).find((d) => d.date === date);
  if (!day) return null;

  const ordered = [...messages]
    .filter((m) => m.sent_on === date)
    .sort((a, b) => (a.sent_at_time ?? "").localeCompare(b.sent_at_time ?? ""));

  const header = `Exported chat, ${date} (times as shown in the file).\n${describeDay(day, meName)}\n`;
  const budget = DRAFT_DESCRIPTION_MAX - header.length - TAIL_RESERVE;

  const lines: string[] = [];
  let used = 0;
  let included = 0;
  for (const m of ordered) {
    const when = m.sent_at_time ? formatClock(m.sent_at_time) : "time not shown";
    let line = `${when} — ${m.sender}: ${oneLine(m.body)}`;
    if (used + line.length + 1 > budget) {
      // Never drop the day's first message just for being long: cut it, say so.
      if (included > 0) break;
      line = `${line.slice(0, Math.max(budget - 60, 0))}… (this message continues in your imported chat)`;
    }
    lines.push(line);
    used += line.length + 1;
    included++;
  }
  const omitted = ordered.length - included;
  const tail =
    omitted > 0
      ? `\n(+${omitted} more ${omitted === 1 ? "message" : "messages"} that day, in your imported chat.)`
      : "";

  return {
    date,
    time: day.firstTime ? day.firstTime.slice(0, 5) : null,
    description: `${header}\n${lines.join("\n")}${tail}`.slice(0, DRAFT_DESCRIPTION_MAX),
    omittedCount: omitted,
  };
}

export interface PlannedDraftRow {
  batch_id: string;
  sort_key: string;
  sort_key_kind: "message_sent_at";
  date_certainty: "confirmed";
  draft: { date: string; time: string | null; description: string; abuse_types: never[] };
  source_evidence_ids: string[];
  source_summary: string;
  confidence_notes: string[];
  status: "pending";
  model: null;
}

/**
 * One draft per picked day, skipping days that already have one. `batchIdFor`
 * must be stable per (thread, day) so picking the same day twice never creates
 * a duplicate, even after the first draft was approved.
 */
export function planChatDayDrafts(args: {
  days: string[];
  messages: DraftableMessage[];
  meName?: string | null;
  participant?: string | null;
  batchIdFor: (date: string) => string;
  alreadyDrafted: ReadonlySet<string>;
}): { rows: PlannedDraftRow[]; skippedExisting: number; skippedNoMessages: number } {
  const rows: PlannedDraftRow[] = [];
  let skippedExisting = 0;
  let skippedNoMessages = 0;
  const who = args.participant?.trim() ? ` with ${args.participant.trim()}` : "";

  for (const date of [...new Set(args.days)].sort()) {
    const batchId = args.batchIdFor(date);
    if (args.alreadyDrafted.has(batchId)) {
      skippedExisting++;
      continue;
    }
    const d = buildDayDraft(date, args.messages, args.meName);
    if (!d) {
      skippedNoMessages++;
      continue;
    }
    rows.push({
      batch_id: batchId,
      sort_key: date,
      sort_key_kind: "message_sent_at",
      // The date is what the exported file says for these messages.
      date_certainty: "confirmed",
      draft: { date, time: d.time, description: d.description, abuse_types: [] },
      source_evidence_ids: [],
      source_summary: `From your imported chat${who} — ${date}`,
      confidence_notes: [
        "Quoted from your exported chat file. Times are as shown in the file.",
        ...(d.omittedCount > 0
          ? [`Long day: ${d.omittedCount} later message(s) are not quoted here.`]
          : []),
        "Nothing reaches your timeline until you approve this draft.",
      ],
      status: "pending",
      model: null,
    });
  }
  return { rows, skippedExisting, skippedNoMessages };
}
