import { describe, expect, it } from "vitest";
import { parseChatExport } from "@/lib/chat-export/parse";
import {
  buildDayDigest,
  countMessagesOnDays,
  describeDay,
  findMyName,
  formatClock,
} from "@/lib/chat-export/digest";

const SAMPLE = [
  "[1/15/24, 1:07:00 AM] Alex: where are you",
  "[1/15/24, 1:09:00 AM] Alex: answer me",
  "[1/15/24, 2:58:00 AM] Alex: <Media omitted>",
  "[1/15/24, 9:00:00 AM] Sam: I was asleep",
  "[1/15/24, 9:05:00 AM] Missed voice call",
  "[1/16/24, 3:30:00 PM] Sam: ok",
].join("\n");

describe("buildDayDigest", () => {
  const days = buildDayDigest(parseChatExport(SAMPLE).messages);

  it("groups by date in order", () => {
    expect(days.map((d) => d.date)).toEqual(["2024-01-15", "2024-01-16"]);
    expect(days[0]!.total).toBe(5);
  });

  it("counts senders, calls, attachments and overnight messages", () => {
    expect(days[0]).toMatchObject({
      bySender: [
        { name: "Alex", count: 3 },
        { name: "Sam", count: 1 },
      ],
      callRecords: 1,
      attachments: 1,
      overnight: 3,
      firstTime: "01:07:00",
      lastTime: "09:05:00",
    });
  });
});

describe("describeDay", () => {
  const days = buildDayDigest(parseChatExport(SAMPLE).messages);

  it("states counts and times and nothing else", () => {
    const s = describeDay(days[0]!, "Sam");
    expect(s).toBe(
      "3 messages from Alex, 1 message from you; 1 call record; 1 attachment, between 1:07 AM and 9:05 AM.",
    );
  });

  it("never uses characterising language", () => {
    const s = describeDay(days[0]!, "Sam").toLowerCase();
    for (const w of ["harass", "threat", "abus", "control", "stalk", "intimidat", "aggress"]) {
      expect(s).not.toContain(w);
    }
  });

  it("words a single-moment day without a range", () => {
    expect(describeDay(days[1]!, "Sam")).toBe("1 message from you at 3:30 PM.");
  });
});

describe("formatClock", () => {
  it("formats noon, midnight and afternoon", () => {
    expect(formatClock("00:05:00")).toBe("12:05 AM");
    expect(formatClock("12:00:00")).toBe("12:00 PM");
    expect(formatClock("15:30:00")).toBe("3:30 PM");
  });
});

describe("countMessagesOnDays", () => {
  const days = buildDayDigest(parseChatExport(SAMPLE).messages);
  it("sums every message, call records included, on the picked days only", () => {
    expect(countMessagesOnDays(days, new Set(["2024-01-15"]))).toBe(5);
    expect(countMessagesOnDays(days, new Set(["2024-01-15", "2024-01-16"]))).toBe(6);
    expect(countMessagesOnDays(days, new Set(["2030-01-01"]))).toBe(0);
    expect(countMessagesOnDays(days, new Set())).toBe(0);
  });
});

describe("findMyName", () => {
  it("is the most common sender of outgoing messages", () => {
    expect(
      findMyName([
        { sender: "Sam", sender_side: "outgoing" },
        { sender: "Sam", sender_side: "outgoing" },
        { sender: "Alex", sender_side: "incoming" },
        { sender: "Sam2", sender_side: "outgoing" },
      ]),
    ).toBe("Sam");
  });
  it("is null with no outgoing messages", () => {
    expect(findMyName([{ sender: "Alex", sender_side: "incoming" }])).toBeNull();
    expect(findMyName([])).toBeNull();
  });
});
