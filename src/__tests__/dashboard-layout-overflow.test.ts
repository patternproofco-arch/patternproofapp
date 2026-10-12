import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

/**
 * Layout contract for the phone overflow that pushed /dashboard to ~790px and Quick Exit off-screen.
 * Real rendering is checked in e2e/mobile-overflow.e2e.ts (mocked session); this pins the source.
 */
describe("signed-in layout cannot widen the page on phones", () => {
  it("dashboard grids use minmax(0, 1fr) so long labels can't size the track", () => {
    const src = read("src/routes/_authenticated/dashboard.tsx");
    expect(src.match(/gridTemplateColumns: "minmax\(0, 1fr\)"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("recent activity rows are shrinkable (truncate needs min-width:0 up the chain)", () => {
    const src = read("src/components/RecentActivityFeed.tsx");
    expect(src).toMatch(/grid-cols-\[minmax\(0,1fr\)\]/);
    expect(src).toMatch(/<li key=\{`\$\{it\.kind\}-\$\{it\.id\}`\} className="min-w-0">/);
  });

  it("incident location wraps instead of refusing to shrink", () => {
    const src = read("src/components/IncidentCard.tsx");
    expect(src).not.toMatch(/flex shrink-0 items-center gap-1 text-\[12px\]/);
    expect(src).toMatch(/\[overflow-wrap:anywhere\]/);
  });

  it("the signed-in shell clips horizontal overflow (clip, so sticky still works)", () => {
    const css = read("src/styles.css");
    expect(css).toMatch(/\.pp-app-shell \{[^}]*overflow-x: clip;/);
    expect(css).toMatch(/\.collapse-inner \{[^}]*overflow: clip;/);
  });

  it("Quick Exit is fixed, at least 44x44, and clamped to the visible viewport", () => {
    const btn = read("src/components/QuickExitButton.tsx");
    expect(btn).toMatch(/fixed/);
    expect(btn).toMatch(/min-h-\[44px\] min-w-\[44px\]/);
    const drag = read("src/hooks/use-draggable.ts");
    expect(drag).toMatch(/visualViewport/);
    expect(drag).toMatch(/window\.addEventListener\("resize", clamp\)/);
    const css = read("src/styles.css");
    expect(css).toMatch(/\.pp-global-exit \{\s*min-height: 44px;/);
  });

  it("entry form save action is sticky above the tab bar and keyboard", () => {
    const css = read("src/styles.css");
    expect(css).toMatch(/\.pp-sticky-save \{[^}]*position: sticky;/);
    expect(css).toMatch(/var\(--pp-tabbar-h/);
    expect(css).toMatch(/var\(--pp-kb-inset/);
    expect(css).toMatch(/safe-area-inset-bottom/);
    expect(read("src/routes/_authenticated/journal.tsx")).toMatch(/pp-sticky-save/);
    expect(read("src/components/BottomTabBar.tsx")).toMatch(/--pp-tabbar-h/);
    expect(read("src/hooks/use-viewport-insets.ts")).toMatch(/--pp-kb-inset/);
  });
});
