import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GUIDE_COPY,
  notNow,
  pickGuideState,
  settleOnReturn,
  startSuggestion,
  type GuideInputs,
} from "@/lib/home-guide";

const T = "2026-10-15";
const base: GuideInputs = {
  entries: 3,
  draftWaiting: false,
  requestWaiting: false,
  quickExitTried: true,
};

describe("Home guide card: state priority", () => {
  it("first true state wins: first-mark > draft > request > quick-exit > default", () => {
    const all = { entries: 0, draftWaiting: true, requestWaiting: true, quickExitTried: false };
    expect(pickGuideState(all, {}, T)).toBe("first-mark");
    expect(pickGuideState({ ...all, entries: 1 }, {}, T)).toBe("draft");
    expect(pickGuideState({ ...all, entries: 1, draftWaiting: false }, {}, T)).toBe("request");
    expect(pickGuideState({ ...base, quickExitTried: false }, {}, T)).toBe("quick-exit");
    expect(pickGuideState(base, {}, T)).toBe("default");
  });

  it("rest card holds for the rest of that day only", () => {
    expect(pickGuideState({ ...base, draftWaiting: true }, { restDay: T }, T)).toBe("rest");
    expect(pickGuideState({ ...base, draftWaiting: true }, { restDay: T }, "2026-10-16")).toBe(
      "draft",
    );
  });
});

describe("Not now", () => {
  it("hides that suggestion until tomorrow and shows the default", () => {
    const inputs = { ...base, draftWaiting: true, quickExitTried: false };
    const m = notNow({}, "draft", T);
    expect(pickGuideState(inputs, m, T)).toBe("default");
    expect(pickGuideState(inputs, m, "2026-10-16")).toBe("draft");
  });
  it("works for request and quick-exit too, and never hides first-mark", () => {
    expect(pickGuideState({ ...base, requestWaiting: true }, notNow({}, "request", T), T)).toBe(
      "default",
    );
    expect(pickGuideState({ ...base, quickExitTried: false }, notNow({}, "quick-exit", T), T)).toBe(
      "default",
    );
    expect(pickGuideState({ ...base, entries: 0 }, notNow({}, "draft", T), T)).toBe("first-mark");
  });
});

describe("completing a suggestion shows the rest card", () => {
  it("first Note saved → rest; returning without saving keeps the suggestion", () => {
    const m = startSuggestion({}, "first-mark", { ...base, entries: 0 }, T);
    expect(settleOnReturn(m, { ...base, entries: 0 }, T)).toEqual(m);
    const done = settleOnReturn(m, { ...base, entries: 1 }, T);
    expect(done.restDay).toBe(T);
    expect(pickGuideState({ ...base, entries: 1 }, done, T)).toBe("rest");
  });
  it("draft read, quick exit practised", () => {
    const d = startSuggestion({}, "draft", { ...base, draftWaiting: true }, T);
    expect(settleOnReturn(d, base, T).restDay).toBe(T);
    const q = startSuggestion({}, "quick-exit", { ...base, quickExitTried: false }, T);
    expect(settleOnReturn(q, base, T).restDay).toBe(T);
  });
  it("a pending suggestion from another day is dropped", () => {
    const m = startSuggestion({}, "default", base, "2026-10-14");
    expect(settleOnReturn(m, { ...base, entries: 9 }, T)).toEqual({ pending: undefined });
  });
});

describe("copy rules", () => {
  const text = Object.values(GUIDE_COPY)
    .flatMap((c) => [c.title, c.line, c.action])
    .join(" | ");
  it("uses the agreed strings", () => {
    expect(GUIDE_COPY["first-mark"].title).toBe("Add your first Note");
    expect(GUIDE_COPY.default.action).toBe("Add a Note");
    expect(GUIDE_COPY.rest.action).toBe("Add another Note");
  });
  it("no counts, checklists, 'you haven't', deadlines, or share/invite/AI/export suggestions", () => {
    expect(text).not.toMatch(/\d/);
    expect(text).not.toMatch(
      /haven't|have not|step \d|checklist|progress|deadline|due|by tomorrow/i,
    );
    // "…unless you choose to share" is reassurance, not a suggestion.
    const suggestions = text.replace("It stays private unless you choose to share.", "");
    expect(suggestions).not.toMatch(/\b(share|sharing|invite|AI|assistant|export|download)\b/i);
  });
  it("the card has a Start here eyebrow and test hooks; Quick Exit stays in the shell", () => {
    const card = readFileSync("src/components/survivor/HomeGuideCard.tsx", "utf8");
    expect(card).toContain("Start here");
    expect(card).toContain('data-testid="home-guide-card"');
    expect(card).toContain("data-state={state}");
    expect(card).not.toMatch(/quickExit\(/);
    expect(readFileSync("src/components/AppShell.tsx", "utf8")).toMatch(
      /<QuickExitButton phoneDock \/>/,
    );
  });
});
