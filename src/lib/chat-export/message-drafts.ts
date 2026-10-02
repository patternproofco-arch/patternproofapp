// Turns individual messages from an imported chat into draft entries.
// Pure and deterministic: each draft quotes one message's own text with the
// file's own time. No AI, no characterisation. Nothing reaches the timeline
// until the survivor approves it; approved entries stay private until shared.
// Companion to day-drafts.ts (one draft per day). This path is one draft per
// message — the clear "entire thread → each message draft" flow.

import { formatClock } from "./digest";
import type { DraftableMessage, PlannedDraftRow } from "./day-drafts";
import { DRAFT_DESCRIPTION_MAX } from "./day-drafts";

export { DRAFT_DESCRIPTION_MAX };

export interface MessageDraft {
  /** YYYY-MM-DD from the export, or null when undated. */
  date: string | null;
  /** HH:MM of this message, or null. */
  time: string | null;
  description: string;
  /** Stable key for de-dupe: prefers id/position, else date+time+sender+body. */
  key: string;
}

export type MessageDraftable = DraftableMessage & {
  position?: number | null;
  id?: string | null;
  attachment_marker_text?: string | null;
};

const oneLine = (body: string) => body.replace(/\n/g, "\n    ");

/** Draft text for a single imported chat message. */
export function buildMessageDraft(message: MessageDraftable): MessageDraft | null {
  const body = (message.body ?? "").trim();
  // Empty attachment-only rows still become drafts so the marker is reviewable.
  if (!body && !message.has_attachment_marker) return null;
  if (!message.sent_on) return null;

  const when = message.sent_at_time ? formatClock(message.sent_at_time) : "time not shown";
  const sender = message.sender || "Unknown";
  const attach =
    message.has_attachment_marker && message.attachment_marker_text
      ? `\nAttachment marked in export: ${message.attachment_marker_text.slice(0, 120)}`
      : message.has_attachment_marker
        ? "\nAttachment marked in export."
        : "";

  const header = `Exported chat message, ${message.sent_on} (time as shown in the file).`;
  const quote = body
    ? `${when} — ${sender}: ${oneLine(body)}`
    : `${when} — ${sender}: (attachment marker only)`;
  const description = `${header}\n${quote}${attach}`.slice(0, DRAFT_DESCRIPTION_MAX);

  const key =
    message.id ??
    (message.position != null
      ? `pos:${message.position}`
      : `${message.sent_on}|${message.sent_at_time ?? ""}|${sender}|${body.slice(0, 80)}`);

  return {
    date: message.sent_on,
    time: message.sent_at_time ? message.sent_at_time.slice(0, 5) : null,
    description,
    key,
  };
}

/**
 * One draft per message, skipping keys that already have a draft. `batchIdFor`
 * must be stable per (thread, message) so the same message is never drafted twice.
 */
export function planChatMessageDrafts(args: {
  messages: MessageDraftable[];
  meName?: string | null;
  participant?: string | null;
  batchIdFor: (key: string) => string;
  alreadyDrafted: ReadonlySet<string>;
  /** Optional cap so a huge thread can be drafted in chunks. */
  limit?: number;
}): {
  rows: PlannedDraftRow[];
  skippedExisting: number;
  skippedUndated: number;
  skippedEmpty: number;
  truncated: boolean;
} {
  const rows: PlannedDraftRow[] = [];
  let skippedExisting = 0;
  let skippedUndated = 0;
  let skippedEmpty = 0;
  let truncated = false;
  const who = args.participant?.trim() ? ` with ${args.participant.trim()}` : "";
  const limit = args.limit ?? Number.POSITIVE_INFINITY;

  const ordered = [...args.messages].sort((a, b) => {
    const d = (a.sent_on ?? "").localeCompare(b.sent_on ?? "");
    if (d !== 0) return d;
    const t = (a.sent_at_time ?? "").localeCompare(b.sent_at_time ?? "");
    if (t !== 0) return t;
    return (a.position ?? 0) - (b.position ?? 0);
  });

  for (const m of ordered) {
    if (rows.length >= limit) {
      truncated = true;
      break;
    }
    if (!m.sent_on) {
      skippedUndated++;
      continue;
    }
    const built = buildMessageDraft(m);
    if (!built) {
      skippedEmpty++;
      continue;
    }
    const batchId = args.batchIdFor(built.key);
    if (args.alreadyDrafted.has(batchId)) {
      skippedExisting++;
      continue;
    }
    const sortKey = m.sent_at_time ? `${m.sent_on}T${m.sent_at_time}` : m.sent_on;
    rows.push({
      batch_id: batchId,
      sort_key: sortKey,
      sort_key_kind: "message_sent_at",
      date_certainty: "confirmed",
      draft: {
        date: built.date!,
        time: built.time,
        description: built.description,
        abuse_types: [],
      },
      source_evidence_ids: [],
      source_summary: `From your imported chat${who} — ${built.date} ${built.time ?? ""}`.trim(),
      confidence_notes: [
        "Quoted from your exported chat file. Time is as shown in the file.",
        ...(m.has_attachment_marker
          ? [
              "This message marks an attachment in the export. If you kept the photo from the zip, it can appear as its own draft after it is preserved.",
            ]
          : []),
        "Nothing reaches your timeline until you approve this draft.",
      ],
      status: "pending",
      model: null,
    });
  }

  return { rows, skippedExisting, skippedUndated, skippedEmpty, truncated };
}

/**
 * Pull a likely media filename out of a WhatsApp-style attachment marker.
 * Returns null when the marker has no usable name (e.g. "<Media omitted>").
 */
export function filenameFromAttachmentMarker(marker: string | null | undefined): string | null {
  if (!marker) return null;
  const t = marker.trim();
  const attached = t.match(/^<attached:\s*([^>]+)>$/i);
  if (attached?.[1]) return attached[1].trim().split(/[/\\]/).pop() || null;
  const fileAttached = t.match(
    /^([\w\-. ()]+\.(jpe?g|png|gif|webp|heic|mp4|mov|opus|m4a|mp3|pdf|vcf))\s*\(file attached\)$/i,
  );
  if (fileAttached?.[1]) return fileAttached[1].trim();
  if (/^[\w\-. ()]+\.(jpe?g|png|gif|webp|heic|mp4|mov|opus|m4a|mp3|pdf|vcf)$/i.test(t)) {
    return t;
  }
  return null;
}
