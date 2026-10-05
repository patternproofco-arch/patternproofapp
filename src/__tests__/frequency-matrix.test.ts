import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MATRIX_EMPTY,
  MATRIX_NOTES,
  MATRIX_SUBTITLE,
  MATRIX_TITLE,
  MAX_PERIOD_ROWS,
  buildFrequencyMatrix,
  chooseGranularity,
  frequencyMatrixToText,
  parseDay,
  parseHour,
  type MatrixInputMessage,
} from "@/lib/frequency-matrix";
import { MATRIX_MESSAGE_COLUMNS, toMatrixInput } from "@/lib/frequency-matrix.server";

const msg = (
  sender: string | null,
  sent_on: string | null,
  sent_at_time: string | null = null,
  extra: Partial<MatrixInputMessage> = {},
): MatrixInputMessage => ({
  sender,
  sender_side: "unknown",
  sent_on,
  sent_at_time,
  ...extra,
});

const META = { conversation: "Chat with J", generatedOn: "Oct 5, 2026" };

describe("buildFrequencyMatrix counts", () => {
  // 2025-03-03 is a Monday.
  const sample: MatrixInputMessage[] = [
    msg("Alex", "2025-03-03", "01:15:00"),
    msg("Alex", "2025-03-03", "01:40:00"),
    msg("Alex", "2025-03-03", "23:59:00"),
    msg("Sam", "2025-03-03", "09:00:00"),
    msg("Alex", "2025-03-05", "14:00:00", { has_attachment_marker: true }),
    msg("(call record)", "2025-03-05", "15:00:00"),
    msg("Sam", "2025-03-09", null),
    msg("Alex", null, "10:00:00"),
    msg("Alex", "not a date"),
  ];
  const m = buildFrequencyMatrix(sample);

  it("totals every imported message and splits dated from undated", () => {
    expect(m.totals).toEqual({
      imported: 9,
      dated: 7,
      undated: 2,
      callRecords: 1,
      attachments: 1,
      withTime: 6,
      earlyHours: 2,
    });
    expect(m.firstDate).toBe("2025-03-03");
    expect(m.lastDate).toBe("2025-03-09");
    expect(m.spanDays).toBe(7);
  });

  it("uses day rows for a short span and includes empty days as zeros", () => {
    expect(m.granularity).toBe("day");
    expect(m.rows.map((r) => r.key)).toEqual([
      "2025-03-03",
      "2025-03-04",
      "2025-03-05",
      "2025-03-06",
      "2025-03-07",
      "2025-03-08",
      "2025-03-09",
    ]);
    expect(m.rows[1]!.total).toBe(0);
    expect(m.rows[0]!.label).toBe("Mon Mar 3, 2025");
  });

  it("counts by sender column, with call records in their own column", () => {
    expect(m.columns.map((c) => c.label)).toEqual(["Alex", "Sam", "Call records"]);
    expect(m.rows[0]!.counts).toEqual([3, 1, 0]);
    expect(m.rows[0]!.earlyHours).toBe(2);
    expect(m.rows[2]!.counts).toEqual([1, 0, 1]);
    expect(m.columns.map((c) => c.total)).toEqual([4, 2, 1]);
    // Column totals only include dated messages, matching the grid.
    expect(m.columns.reduce((n, c) => n + c.total, 0)).toBe(m.totals.dated);
  });

  it("row totals add up and days-with-messages counts distinct dates", () => {
    for (const r of m.rows) expect(r.counts.reduce((a, b) => a + b, 0)).toBe(r.total);
    expect(m.rows.reduce((n, r) => n + r.total, 0)).toBe(m.totals.dated);
    expect(m.rows.reduce((n, r) => n + r.daysWithMessages, 0)).toBe(3);
  });

  it("fills the day-of-week by time-of-day grid", () => {
    const mon = m.weekGrid[0]!;
    expect(mon.day).toBe("Mon");
    expect(mon.counts).toEqual([2, 1, 0, 1]);
    expect(mon.total).toBe(4);
    const sun = m.weekGrid[6]!;
    expect(sun.noTime).toBe(1);
    expect(m.weekGrid.reduce((n, w) => n + w.total, 0)).toBe(m.totals.dated);
  });

  it("reports the highest single-day count, earliest date on ties", () => {
    expect(m.busiestDay).toEqual({ date: "2025-03-03", count: 4 });
    const tie = buildFrequencyMatrix([msg("A", "2025-01-02"), msg("A", "2025-01-01")]);
    expect(tie.busiestDay).toEqual({ date: "2025-01-01", count: 1 });
  });

  it("is deterministic regardless of input order", () => {
    const reversed = buildFrequencyMatrix([...sample].reverse());
    expect(reversed).toEqual(m);
  });
});

describe("grouping and senders", () => {
  it("chooses the finest grouping that fits one page", () => {
    const d = (s: string) => parseDay(s)!;
    expect(chooseGranularity(d("2025-01-01"), d("2025-01-20"))).toBe("day");
    expect(chooseGranularity(d("2025-01-01"), d("2025-03-31"))).toBe("week");
    expect(chooseGranularity(d("2024-01-01"), d("2025-06-30"))).toBe("month");
    expect(chooseGranularity(d("2020-01-01"), d("2024-06-30"))).toBe("quarter");
    expect(chooseGranularity(d("2000-01-01"), d("2025-06-30"))).toBe("year");
  });

  it("never produces more period rows than fit on the page", () => {
    const many: MatrixInputMessage[] = [];
    for (let y = 2019; y <= 2025; y++) many.push(msg("A", `${y}-06-15`));
    const m = buildFrequencyMatrix(many);
    expect(m.rows.length).toBeLessThanOrEqual(MAX_PERIOD_ROWS);
    expect(m.rows.reduce((n, r) => n + r.total, 0)).toBe(7);
  });

  it("weeks start on Monday", () => {
    const m = buildFrequencyMatrix([msg("A", "2025-03-05"), msg("A", "2025-04-20")]);
    expect(m.granularity).toBe("week");
    expect(m.rows[0]!.key).toBe("2025-03-03");
    expect(m.rows[0]!.label).toBe("Week of Mar 3, 2025");
  });

  it("groups senders past the column limit into one column", () => {
    const m = buildFrequencyMatrix([
      ...Array.from({ length: 5 }, () => msg("A", "2025-01-01")),
      ...Array.from({ length: 4 }, () => msg("B", "2025-01-01")),
      ...Array.from({ length: 3 }, () => msg("C", "2025-01-01")),
      msg("D", "2025-01-01"),
      msg("E", "2025-01-01"),
    ]);
    expect(m.columns.map((c) => c.label)).toEqual(["A", "B", "C", "Other senders (2)"]);
    expect(m.rows[0]!.counts).toEqual([5, 4, 3, 2]);
  });

  it("labels screenshot imports by side without inventing names", () => {
    const m = buildFrequencyMatrix([
      msg(null, "2025-01-01", null, { sender_side: "outgoing" }),
      msg(null, "2025-01-01", null, { sender_side: "incoming" }),
      msg(null, "2025-01-01", null, { sender_side: "incoming" }),
    ]);
    expect(m.columns.map((c) => c.label)).toEqual([
      "Incoming (no name shown)",
      "Outgoing (no name shown)",
    ]);
  });

  it("rejects impossible dates and times", () => {
    expect(parseDay("2025-02-30")).toBeNull();
    expect(parseDay("03/04/2025")).toBeNull();
    expect(parseHour("24:00")).toBeNull();
    expect(parseHour("7:05 PM")).toBe(7);
    expect(parseHour("19:05:00")).toBe(19);
  });
});

describe("empty state", () => {
  it("handles no messages", () => {
    const m = buildFrequencyMatrix([]);
    expect(m.rows).toEqual([]);
    expect(m.granularity).toBeNull();
    expect(m.busiestDay).toBeNull();
    expect(m.totals.imported).toBe(0);
    const text = frequencyMatrixToText(m, META);
    expect(text).toContain(MATRIX_EMPTY);
    expect(text).toContain("0 imported messages");
  });

  it("handles messages that all lack dates", () => {
    const m = buildFrequencyMatrix([msg("A", null), msg("B", "")]);
    expect(m.totals).toMatchObject({ imported: 2, dated: 0, undated: 2 });
    expect(m.rows).toEqual([]);
    expect(frequencyMatrixToText(m, META)).toContain(MATRIX_EMPTY);
  });
});

describe("copy text", () => {
  const m = buildFrequencyMatrix([
    msg("Alex", "2025-03-03", "01:15:00"),
    msg("Sam", "2025-03-04", "09:00:00"),
  ]);
  const text = frequencyMatrixToText(m, {
    ...META,
    source: "chat.txt",
    importedOn: "Mar 10, 2025",
    exhibitLabel: "Exhibit 7",
  });

  it("carries the same numbers as the sheet", () => {
    expect(text).toContain("Exhibit 7");
    expect(text).toContain("Conversation: Chat with J");
    expect(text).toContain("Source file: chat.txt");
    expect(text).toContain("2 imported messages · 2 with a date · 0 without a date");
    expect(text).toMatch(/Mon Mar 3, 2025\s+\|\s+1 \|\s+0 \|\s+1 \|\s+1 \|\s+1/);
    expect(text).toMatch(/All periods\s+\|\s+1 \|\s+1 \|\s+2 \|\s+1 \|\s+2/);
    expect(text).toContain("Highest single-day count: 1 on Mar 3, 2025");
    expect(text).toContain("Day of week by time of day");
  });

  it("includes every note", () => {
    for (const n of MATRIX_NOTES) expect(text).toContain(n);
  });
});

describe("soft copy", () => {
  // Everything the sheet can print: builder copy, the sheet, routes and binder entry.
  const surfaces = [
    "src/lib/frequency-matrix.ts",
    "src/components/FrequencyMatrixSheet.tsx",
    "src/components/attorney/BinderFrequencyMatrixLinks.tsx",
    "src/routes/_attorney/binder.$clientId_.frequency.$threadId.tsx",
    "src/routes/_authenticated/frequency-matrix.$threadId.tsx",
  ].map((p) => [p, readFileSync(p, "utf8")] as const);

  const BANNED = [
    /court[- ]ready/i,
    /admissib/i,
    /privilege/i,
    /\bprov(e|es|en|ing)\b/i,
    /\bproof of\b/i,
    /\bfinding/i,
    /\bconclusive/i,
    /\babus(e|ive|er)\b/i,
    /harass/i,
    /coerci/i,
    /threat/i,
    /stalk/i,
    /escalat/i,
    /\bsevere|severity/i,
    /will (win|help you win)/i,
    /guarantee/i,
  ];

  it("uses no conclusion, outcome or court-ready language", () => {
    const hits: string[] = [];
    const sample = frequencyMatrixToText(buildFrequencyMatrix([msg("A", "2025-01-01")]), META);
    for (const [path, src] of [...surfaces, ["copy-text", sample] as const]) {
      for (const re of BANNED) if (re.test(src)) hits.push(`${path}: ${re}`);
    }
    expect(hits).toEqual([]);
  });

  it("labels output as observed counts from imported messages", () => {
    expect(MATRIX_TITLE).toBe("Message frequency matrix");
    expect(MATRIX_SUBTITLE).toBe("Observed counts from imported messages");
    expect(MATRIX_NOTES[0]).toMatch(/^Counts only\./);
  });

  it("never reads message text to build the matrix", () => {
    expect(MATRIX_MESSAGE_COLUMNS).not.toMatch(/\bbody\b/);
    const built = toMatrixInput({
      sender: "(call record)",
      sender_side: "unknown",
      sent_on: "2025-01-01",
      sent_at_time: null,
      has_attachment_marker: null,
      flags: { body: "should not matter" },
    });
    expect(Object.keys(built)).not.toContain("body");
    expect(built.is_call_record).toBe(true);
    expect(
      toMatrixInput({
        ...built,
        flags: { call_row: true },
        sender: "Pat",
        has_attachment_marker: false,
      }).is_call_record,
    ).toBe(true);
  });

  it("attorney matrix data uses the same access checks as viewing the thread", () => {
    const api = readFileSync("src/lib/attorney-portal.functions.ts", "utf8");
    const fn = api.slice(api.indexOf("export const getClientThreadMatrixData"));
    const body = fn.slice(0, fn.indexOf("/* ---"));
    expect(body).toMatch(/assertCaseAccess\(context\.userId, data\.clientId\)/);
    expect(body).toMatch(/assertEntitled\(context\.userId, data\.clientId\)/);
    expect(body).toMatch(/scope_threads/);
    expect(body).toMatch(/\.eq\("user_id", data\.clientId\)/);
    expect(body).toMatch(/thread\.counts_viewed_by_professional/);
    expect(body).not.toMatch(/\bbody\b/);
  });

  it("survivor matrix data is filtered to the signed-in owner", () => {
    const src = readFileSync("src/lib/frequency-matrix.functions.ts", "utf8");
    expect(src).toMatch(/requireSupabaseAuth/);
    expect(src).toMatch(/\.eq\("user_id", userId\)/);
    expect(src).toMatch(/readThreadMatrixRows\(supabase, userId, data\.threadId\)/);
  });
});

describe("readThreadMatrixRows", () => {
  function fakeDb(total: number, failAt?: number) {
    const calls: Array<{ from: number; to: number; filters: Record<string, string> }> = [];
    return {
      calls,
      from() {
        const filters: Record<string, string> = {};
        const q = {
          select: () => q,
          eq: (k: string, v: string) => ((filters[k] = v), q),
          order: () => q,
          range: async (from: number, to: number) => {
            calls.push({ from, to, filters: { ...filters } });
            if (failAt !== undefined && from >= failAt)
              return { data: null, error: { message: "x" } };
            const n = Math.max(0, Math.min(total, to + 1) - from);
            return {
              data: Array.from({ length: n }, () => ({
                sender: "A",
                sender_side: "incoming",
                sent_on: "2025-01-01",
                sent_at_time: null,
                has_attachment_marker: false,
                flags: {},
              })),
              error: null,
            };
          },
        };
        return q;
      },
    };
  }

  it("reads every page for the owner and thread", async () => {
    const { readThreadMatrixRows } = await import("@/lib/frequency-matrix.server");
    const db = fakeDb(2350);
    const r = await readThreadMatrixRows(db, "owner-1", "thread-1");
    expect(r.messages).toHaveLength(2350);
    expect(r.truncated).toBe(false);
    expect(db.calls).toHaveLength(3);
    for (const c of db.calls)
      expect(c.filters).toEqual({ thread_id: "thread-1", user_id: "owner-1" });
  });

  it("throws instead of returning a partial count", async () => {
    const { readThreadMatrixRows } = await import("@/lib/frequency-matrix.server");
    await expect(readThreadMatrixRows(fakeDb(2500, 1000), "o", "t")).rejects.toThrow(
      /couldn't count every message/,
    );
  });
});
