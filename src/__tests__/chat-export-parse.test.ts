import { describe, expect, it } from "vitest";
import {
  CALL_RECORD_SENDER,
  inferDateOrder,
  parseChatExport,
  parseExportTime,
} from "@/lib/chat-export/parse";

const IOS = [
  "‎[1/15/24, 9:41:05 PM] Alex: You can't keep doing this",
  "[1/15/24, 9:43:12 PM] Sam: Doing what?",
  "second line of the same message",
  "",
  "after a blank line",
  "‎[1/16/24, 2:07:30 AM] Alex: ‎image omitted",
].join("\n");

const ANDROID = [
  "1/15/24, 21:41 - Messages and calls are end-to-end encrypted. No one outside of this chat can read them.",
  "1/15/24, 21:41 - Alex: Where are you",
  "1/16/24, 02:07 - Alex: <Media omitted>",
  "1/16/24, 02:09 - Missed voice call",
  "1/16/24, 02:10 - Alex: did you see the video call, I left a note",
].join("\n");

describe("parseChatExport — bracketed (iOS-style) exports", () => {
  const r = parseChatExport(IOS);

  it("reads sender, date, 24h time and body", () => {
    expect(r.format).toBe("bracketed");
    expect(r.messages).toHaveLength(3);
    expect(r.messages[0]).toMatchObject({
      sender: "Alex",
      sent_on: "2024-01-15",
      sent_at_time: "21:41:05",
      body: "You can't keep doing this",
      line: 1,
    });
  });

  it("keeps multi-line messages together, blank lines included", () => {
    expect(r.messages[1]!.body).toBe(
      "Doing what?\nsecond line of the same message\n\nafter a blank line",
    );
  });

  it("flags attachment markers and handles AM correctly", () => {
    expect(r.messages[2]).toMatchObject({
      sent_at_time: "02:07:30",
      has_attachment_marker: true,
      attachment_marker_text: "image omitted",
    });
  });

  it("counts participants", () => {
    expect(r.participants).toEqual([
      { name: "Alex", count: 2 },
      { name: "Sam", count: 1 },
    ]);
    expect(r.firstDate).toBe("2024-01-15");
    expect(r.lastDate).toBe("2024-01-16");
  });
});

describe("parseChatExport — dashed (Android-style) exports", () => {
  const r = parseChatExport(ANDROID);

  it("skips the app's own notices but reports them", () => {
    expect(r.format).toBe("dashed");
    expect(r.systemLines).toHaveLength(1);
    expect(r.systemLines[0]!.text).toMatch(/end-to-end encrypted/);
  });

  it("keeps call records as evidence of contact", () => {
    const call = r.messages.find((m) => m.kind === "call_record")!;
    expect(call.sender).toBe(CALL_RECORD_SENDER);
    expect(call.sent_at_time).toBe("02:09:00");
    expect(call.body).toBe("Missed voice call");
    expect(r.participants.map((p) => p.name)).not.toContain(CALL_RECORD_SENDER);
  });

  it("never drops a real message that merely mentions 'video call' or 'left'", () => {
    const real = r.messages.find((m) => m.body.startsWith("did you see the video call"));
    expect(real).toBeDefined();
    expect(real!.kind).toBe("text");
    expect(real!.sender).toBe("Alex");
  });

  it("does not treat the continuation of a system line as a message", () => {
    const withSystemTail = parseChatExport(
      "1/15/24, 21:41 - Messages and calls are end-to-end encrypted.\nLearn more.\n1/15/24, 21:42 - Alex: hi",
    );
    expect(withSystemTail.messages).toHaveLength(1);
    expect(withSystemTail.messages[0]!.body).toBe("hi");
  });
});

describe("date order", () => {
  it("infers day-first when a first part exceeds 12", () => {
    const r = parseChatExport("[25/12/23, 10:00:00] A: hi\n[03/04/23, 10:00:00] B: yo");
    expect(r.dateOrder).toBe("dmy");
    expect(r.dateOrderAssumed).toBe(false);
    expect(r.messages[1]!.sent_on).toBe("2023-04-03");
  });

  it("infers month-first when a second part exceeds 12", () => {
    const r = parseChatExport("[12/25/23, 10:00:00] A: hi");
    expect(r.dateOrder).toBe("mdy");
    expect(r.dateOrderAssumed).toBe(false);
  });

  it("says so when the file cannot settle it, and lets the caller override", () => {
    const text = "[03/04/23, 10:00:00] A: hi";
    const guessed = parseChatExport(text);
    expect(guessed.dateOrderAssumed).toBe(true);
    expect(guessed.messages[0]!.sent_on).toBe("2023-03-04");
    expect(guessed.warnings.join(" ")).toMatch(/March 4 or April 3/);

    const forced = parseChatExport(text, { dateOrder: "dmy" });
    expect(forced.dateOrderAssumed).toBe(false);
    expect(forced.messages[0]!.sent_on).toBe("2023-04-03");
  });

  it("reads year-first dates", () => {
    expect(inferDateOrder(["2024-05-12"])).toEqual({ order: "ymd", assumed: false });
    const r = parseChatExport("2024-05-12 21:14 - John: hey");
    expect(r.messages[0]).toMatchObject({ sent_on: "2024-05-12", sent_at_time: "21:14:00" });
  });

  it("keeps a message with an impossible date, undated, and says so", () => {
    const r = parseChatExport("[2/30/24, 10:00:00 AM] A: hi");
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0]!.sent_on).toBeNull();
    expect(r.undatedCount).toBe(1);
    expect(r.warnings.join(" ")).toMatch(/isn't a real calendar date/);
  });
});

describe("parseExportTime", () => {
  it("handles 12-hour edge cases", () => {
    expect(parseExportTime("12:05:00 AM")).toBe("00:05:00");
    expect(parseExportTime("12:05 PM")).toBe("12:05:00");
    expect(parseExportTime("1:05 pm")).toBe("13:05:00");
    expect(parseExportTime("4.32 p.m.")).toBe("16:32:00");
  });
  it("rejects nonsense", () => {
    expect(parseExportTime("25:00")).toBeNull();
    expect(parseExportTime("13:00 PM")).toBeNull();
    expect(parseExportTime("10:75")).toBeNull();
  });
  it("tolerates the narrow no-break space iOS puts before AM/PM", () => {
    const r = parseChatExport("[1/5/24, 4:32:10 PM] A: hi");
    expect(r.messages[0]!.sent_at_time).toBe("16:32:10");
  });
});

describe("attachment markers", () => {
  it("recognises the shapes WhatsApp uses", () => {
    const r = parseChatExport(
      [
        "[1/5/24, 4:32:10 PM] A: <attached: 00000012-PHOTO-2024-01-05-16-32-10.jpg>",
        "1/5/24, 16:33 - B: IMG-20240105-WA0001.jpg (file attached)",
        "1/5/24, 16:34 - B: voice message omitted",
        "1/5/24, 16:35 - B: I attached the photo you asked for",
      ].join("\n"),
    );
    expect(r.messages.map((m) => m.has_attachment_marker)).toEqual([true, true, true, false]);
  });
});

describe("not a chat export", () => {
  it("reports unrecognized instead of inventing messages", () => {
    const r = parseChatExport("Dear diary,\nToday was a day.");
    expect(r.format).toBe("unrecognized");
    expect(r.messages).toHaveLength(0);
    expect(r.ignoredLeadingLines).toBe(2);
    expect(r.warnings[0]).toMatch(/couldn't find any messages/);
  });

  it("does not guess at an iMessage-style export (date line, name line, text)", () => {
    // Formats we cannot verify are rejected, never half-read: a wrong guess would
    // put a survivor's messages on the wrong dates or under the wrong sender.
    const r = parseChatExport(
      [
        "Jan 05, 2024  4:32:10 PM",
        "Me",
        "where are you",
        "",
        "Jan 05, 2024  4:33:00 PM",
        "Alex",
        "home",
      ].join("\n"),
    );
    expect(r.format).toBe("unrecognized");
    expect(r.messages).toHaveLength(0);
  });

  it("does not cap or truncate large exports", () => {
    const lines = Array.from(
      { length: 12000 },
      (_, i) => `[1/${(i % 28) + 1}/24, 9:00:00 AM] A: message ${i}`,
    ).join("\n");
    expect(parseChatExport(lines).messages).toHaveLength(12000);
  });
});
