import { describe, expect, it } from "vitest";
import { parseChatExport } from "@/lib/chat-export/parse";
import {
  DRAFT_DESCRIPTION_MAX,
  buildDayDraft,
  planChatDayDrafts,
} from "@/lib/chat-export/day-drafts";

const SAMPLE = [
  "[1/15/24, 1:07:00 AM] Alex: where are you",
  "[1/15/24, 1:09:00 AM] Alex: answer me",
  "still here",
  "[1/15/24, 9:00:00 AM] Sam: I was asleep",
  "[1/15/24, 9:05:00 AM] Missed voice call",
  "[1/16/24, 3:30:00 PM] Sam: ok",
].join("\n");

const messages = parseChatExport(SAMPLE).messages;

describe("buildDayDraft", () => {
  const d = buildDayDraft("2024-01-15", messages, "Sam")!;

  it("quotes the messages in time order with the file's own times", () => {
    expect(d.time).toBe("01:07");
    expect(d.description).toContain("Exported chat, 2024-01-15 (times as shown in the file).");
    expect(d.description).toContain("1:07 AM — Alex: where are you");
    expect(d.description).toContain("1:09 AM — Alex: answer me\n    still here");
    expect(d.description).toContain("9:05 AM — (call record): Missed voice call");
    expect(d.description.indexOf("1:07 AM")).toBeLessThan(d.description.indexOf("9:00 AM"));
  });

  it("states counts and times and nothing characterising", () => {
    expect(d.description).toContain("2 messages from Alex");
    const lower = d.description.toLowerCase();
    for (const w of ["harass", "threat", "abus", "control", "stalk", "intimidat"]) {
      expect(lower).not.toContain(w);
    }
  });

  it("returns null for a day with no messages", () => {
    expect(buildDayDraft("2030-01-01", messages, "Sam")).toBeNull();
  });
});

describe("length limit", () => {
  const long = Array.from(
    { length: 400 },
    (_, i) =>
      `[1/20/24, 10:${String(i % 60).padStart(2, "0")}:00 AM] A: ${"word ".repeat(20)}#${i}`,
  ).join("\n");
  const big = parseChatExport(long).messages;

  it("never exceeds the draft limit and says how many messages were left out", () => {
    const d = buildDayDraft("2024-01-20", big, "B")!;
    expect(d.description.length).toBeLessThanOrEqual(DRAFT_DESCRIPTION_MAX);
    expect(d.omittedCount).toBeGreaterThan(0);
    expect(d.description).toContain(`(+${d.omittedCount} more messages that day`);
  });

  it("keeps a single oversized first message, cut and labelled", () => {
    const one = parseChatExport(`[1/21/24, 9:00:00 AM] A: ${"x".repeat(9000)}`).messages;
    const d = buildDayDraft("2024-01-21", one, "B")!;
    expect(d.description.length).toBeLessThanOrEqual(DRAFT_DESCRIPTION_MAX);
    expect(d.description).toContain("this message continues in your imported chat");
  });
});

describe("planChatDayDrafts", () => {
  const base = {
    messages,
    meName: "Sam",
    participant: "Alex",
    batchIdFor: (date: string) => `batch-${date}`,
  };

  it("makes one pending, model-less, private-by-default draft per picked day", () => {
    const { rows } = planChatDayDrafts({
      ...base,
      days: ["2024-01-16", "2024-01-15", "2024-01-15"],
      alreadyDrafted: new Set(),
    });
    expect(rows.map((r) => r.sort_key)).toEqual(["2024-01-15", "2024-01-16"]);
    for (const r of rows) {
      expect(r).toMatchObject({
        status: "pending",
        model: null,
        date_certainty: "confirmed",
        sort_key_kind: "message_sent_at",
      });
      expect(r.source_evidence_ids).toEqual([]);
    }
    expect(rows[0]!.source_summary).toBe("From your imported chat with Alex — 2024-01-15");
    expect(rows[0]!.confidence_notes.join(" ")).toMatch(/Nothing reaches your timeline/);
  });

  it("does not duplicate a day that already has a draft", () => {
    const r = planChatDayDrafts({
      ...base,
      days: ["2024-01-15", "2024-01-16"],
      alreadyDrafted: new Set(["batch-2024-01-15"]),
    });
    expect(r.rows.map((x) => x.sort_key)).toEqual(["2024-01-16"]);
    expect(r.skippedExisting).toBe(1);
  });

  it("skips picked days that have no messages", () => {
    const r = planChatDayDrafts({ ...base, days: ["2030-01-01"], alreadyDrafted: new Set() });
    expect(r.rows).toEqual([]);
    expect(r.skippedNoMessages).toBe(1);
  });
});
