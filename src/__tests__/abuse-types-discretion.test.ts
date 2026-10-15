import { describe, expect, it } from "vitest";
import {
  ABUSE_TYPES,
  TIMELINE_GROUPS,
  formalTypeLabel,
  timelineGroupOf,
  typeLabel,
} from "@/lib/abuse-types";

describe("discreet display labels", () => {
  it("survivor-facing labels carry no harm words; values unchanged", () => {
    for (const t of ABUSE_TYPES) expect(t.label).not.toMatch(/abuse|violence|assault|violation/i);
    expect(ABUSE_TYPES.map((t) => t.value)).toContain("verbal");
    expect(typeLabel("emotional")).toBe("Hurtful words");
  });
  it("professional/court surfaces keep formal terms", () => {
    expect(formalTypeLabel("verbal")).toBe("Verbal abuse");
    expect(formalTypeLabel("physical")).toBe("Physical violence");
    expect(formalTypeLabel("financial")).toBe("Financial control");
  });
  it("every stored value maps to one of six timeline groups", () => {
    expect(TIMELINE_GROUPS.map((g) => g.label)).toEqual([
      "Things said", "Things done", "Money", "Messages & calls", "Where I go", "Other",
    ]);
    for (const t of ABUSE_TYPES) expect(TIMELINE_GROUPS.some((g) => g.key === timelineGroupOf(t.value))).toBe(true);
    expect(timelineGroupOf("stalking")).toBe("where");
    expect(timelineGroupOf("something-new")).toBe("other");
  });
});
