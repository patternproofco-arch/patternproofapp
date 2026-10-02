import { describe, expect, it } from "vitest";
import { parseChatExport } from "@/lib/chat-export/parse";
import {
  buildMessageDraft,
  filenameFromAttachmentMarker,
  planChatMessageDrafts,
} from "@/lib/chat-export/message-drafts";

const SAMPLE = [
  "[1/15/24, 1:07:00 AM] Alex: where are you",
  "[1/15/24, 1:09:00 AM] Alex: answer me",
  "still here",
  "[1/15/24, 9:00:00 AM] Sam: I was asleep",
  "[1/15/24, 9:05:00 AM] Missed voice call",
  "[1/15/24, 9:10:00 AM] Alex: IMG-20240115-WA0001.jpg (file attached)",
  "[1/16/24, 3:30:00 PM] Sam: ok",
].join("\n");

const messages = parseChatExport(SAMPLE).messages.map((m, i) => ({
  ...m,
  position: i + 1,
}));

describe("buildMessageDraft", () => {
  it("quotes one message with the file's own time and no characterisation", () => {
    const d = buildMessageDraft(messages[0]!)!;
    expect(d.date).toBe("2024-01-15");
    expect(d.time).toBe("01:07");
    expect(d.description).toContain("Exported chat message, 2024-01-15");
    expect(d.description).toContain("1:07 AM — Alex: where are you");
    const lower = d.description.toLowerCase();
    for (const w of ["harass", "threat", "abus", "control", "stalk", "intimidat"]) {
      expect(lower).not.toContain(w);
    }
  });

  it("keeps multi-line continuation text", () => {
    const d = buildMessageDraft(messages[1]!)!;
    expect(d.description).toContain("answer me");
    expect(d.description).toContain("still here");
  });

  it("notes attachment markers without inventing labels", () => {
    const attach = messages.find((m) => m.has_attachment_marker)!;
    const d = buildMessageDraft(attach)!;
    expect(d.description).toContain("Attachment marked in export");
    expect(d.description).toMatch(/IMG-20240115-WA0001\.jpg/i);
  });

  it("returns null for undated messages", () => {
    expect(
      buildMessageDraft({
        sender: "A",
        kind: "text",
        sent_on: null,
        sent_at_time: "09:00:00",
        body: "hi",
        has_attachment_marker: false,
      }),
    ).toBeNull();
  });
});

describe("planChatMessageDrafts", () => {
  const base = {
    messages,
    meName: "Sam",
    participant: "Alex",
    batchIdFor: (key: string) => `batch-${key}`,
  };

  it("makes one pending, model-less draft per message", () => {
    const { rows } = planChatMessageDrafts({
      ...base,
      alreadyDrafted: new Set(),
    });
    // 5 text/call + 1 attachment message with dates = 6
    expect(rows.length).toBe(messages.filter((m) => m.sent_on).length);
    for (const r of rows) {
      expect(r).toMatchObject({
        status: "pending",
        model: null,
        date_certainty: "confirmed",
        sort_key_kind: "message_sent_at",
      });
      expect(r.source_evidence_ids).toEqual([]);
      expect(r.confidence_notes.join(" ")).toMatch(/Nothing reaches your timeline/);
    }
    expect(rows[0]!.source_summary).toMatch(/imported chat with Alex/);
    expect(rows[0]!.sort_key).toBe("2024-01-15T01:07:00");
  });

  it("does not duplicate a message that already has a draft", () => {
    // buildMessageDraft prefers id, else pos:N — tests use position.
    const built = buildMessageDraft(messages[0]!)!;
    expect(built.key).toBe(`pos:${messages[0]!.position}`);
    const r = planChatMessageDrafts({
      ...base,
      alreadyDrafted: new Set([`batch-${built.key}`]),
    });
    expect(r.skippedExisting).toBe(1);
    expect(r.rows.length).toBe(messages.filter((m) => m.sent_on).length - 1);
  });

  it("respects a limit and reports truncation", () => {
    const r = planChatMessageDrafts({
      ...base,
      alreadyDrafted: new Set(),
      limit: 2,
    });
    expect(r.rows.length).toBe(2);
    expect(r.truncated).toBe(true);
  });
});

describe("filenameFromAttachmentMarker", () => {
  it("reads Android-style file attached markers", () => {
    expect(filenameFromAttachmentMarker("IMG-20240115-WA0001.jpg (file attached)")).toBe(
      "IMG-20240115-WA0001.jpg",
    );
  });

  it("reads iOS-style <attached: …> markers", () => {
    expect(filenameFromAttachmentMarker("<attached: 00000001-PHOTO.jpg>")).toBe(
      "00000001-PHOTO.jpg",
    );
  });

  it("returns null for media-omitted markers", () => {
    expect(filenameFromAttachmentMarker("<Media omitted>")).toBeNull();
    expect(filenameFromAttachmentMarker("image omitted")).toBeNull();
  });
});
