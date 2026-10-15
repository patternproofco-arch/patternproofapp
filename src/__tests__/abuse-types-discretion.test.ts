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

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NAV_TABS, SECTION_SEGMENTS } from "@/lib/nav-tabs";
import { PICKER_ONLY_LABELS, groupLabelFor, groupLabelByKey } from "@/lib/abuse-types";

const SENSITIVE = /unwanted sexual contact|\bthreats?\b|\bstalking\b|\bharassment\b|coercive control/i;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("picker-only labels stay off chips, Home, titles, nav and notifications", () => {
  it("list is what Experience named", () => {
    expect(PICKER_ONLY_LABELS).toEqual([
      "Unwanted sexual contact", "Threats", "Stalking", "Harassment", "Coercive control",
    ]);
  });
  it("filter chips and aggregate labels never use them", () => {
    for (const g of TIMELINE_GROUPS) expect(g.label).not.toMatch(SENSITIVE);
    for (const l of [...PICKER_ONLY_LABELS, "sexual", "stalking", "Sexual violence"])
      expect(groupLabelFor(l)).not.toMatch(SENSITIVE);
    for (const g of TIMELINE_GROUPS) expect(groupLabelByKey(g.key)).toBe(g.label);
  });
  it("nav tabs and section segments never use them", () => {
    const labels = [
      ...NAV_TABS.map((t) => t.label),
      ...Object.values(SECTION_SEGMENTS).flatMap((s) => (s ?? []).map((x) => x.label)),
    ];
    for (const l of labels) expect(l).not.toMatch(SENSITIVE);
  });
  it("no route <title> uses them", () => {
    for (const f of walk("src/routes").filter((p) => p.endsWith(".tsx"))) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/\btitle:\s*["'`]([^"'`]+)["'`]/g))
        expect(`${f}: ${m[1]}`).not.toMatch(SENSITIVE);
    }
  });
  it("Home, notifications and observation copy never use them", () => {
    const files = [
      "src/routes/_authenticated/dashboard.tsx",
      "src/components/survivor/HomeGuideCard.tsx",
      "src/lib/home-guide.ts",
      "src/components/NotificationBanner.tsx",
      "src/components/NewConnectionNotice.tsx",
    ];
    for (const f of files) {
      let src = "";
      try {
        src = readFileSync(f, "utf8");
      } catch {
        continue;
      }
      const strings = [...src.matchAll(/["'`]([^"'`\n]{3,})["'`]|>([^<>{}\n]{3,})</g)].map((m) => m[1] ?? m[2]);
      for (const s of strings) expect(`${f}: ${s}`).not.toMatch(SENSITIVE);
    }
  });
});
