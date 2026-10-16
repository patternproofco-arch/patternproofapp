import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PHONE_DOCK,
  WIDE_DOCK,
  clampSavedQuickExitPosition,
  quickExitDock,
} from "@/lib/quick-exit-dock";

const read = (p: string) => readFileSync(p, "utf8");

describe("Quick Exit docking on phones", () => {
  it("uses one corner (top-right) everywhere below 640px", () => {
    expect(quickExitDock(390)).toEqual({ right: 16, top: 8 });
    expect(quickExitDock(639)).toEqual(PHONE_DOCK);
    expect(quickExitDock(640)).toEqual(WIDE_DOCK);
    expect(quickExitDock(undefined)).toEqual(WIDE_DOCK);
    // Phone in landscape keeps the header dock; a desktop window does not.
    expect(quickExitDock(844, 390)).toEqual(PHONE_DOCK);
    expect(quickExitDock(1280, 800)).toEqual(WIDE_DOCK);
    expect(PHONE_DOCK).not.toHaveProperty("left");
  });
  it("shell owns the single phone dock; onboarding (inside the shell) adds no second one", () => {
    const shell = read("src/components/AppShell.tsx");
    expect(shell).toMatch(/<QuickExitButton phoneDock \/>/);
    expect(shell).toMatch(/className="pp-qe-slot"/);
    expect(shell).toMatch(/e\.key === "Escape"/);
    const onboarding = read("src/routes/_authenticated/onboarding.tsx");
    expect(onboarding).not.toMatch(/<QuickExitButton/);
    expect(onboarding).toMatch(/className="pp-qe-slot"/);
    for (const f of [
      "src/components/PinScreen.tsx",
      "src/routes/support.tsx",
      "src/routes/resources.tsx",
    ])
      expect(read(f)).toMatch(/<QuickExitButton phoneDock \/>/);
    // No survivor-facing Quick Exit is left on the old floating default.
    for (const f of [
      "src/components/PinScreen.tsx",
      "src/routes/support.tsx",
      "src/routes/resources.tsx",
      "src/components/AppShell.tsx",
      "src/routes/_authenticated/onboarding.tsx",
    ])
      expect(read(f)).not.toMatch(/<QuickExitButton\s*\/>/);
  });
  it("clamps a saved mid-screen position into the header band's top-right slot on phones", () => {
    const vp = { width: 390, height: 844 };
    const size = { width: 110, height: 44 };
    const p = clampSavedQuickExitPosition({ left: 40, top: 400 }, vp, size);
    expect(p.top + size.height).toBeLessThanOrEqual(60);
    expect(p).toEqual({ left: 390 - 110 - 16, top: 8 });
    // Narrower WebKit label still lands on the same right edge.
    const n = clampSavedQuickExitPosition({ left: 40, top: 400 }, vp, { width: 96, height: 44 });
    expect(n.left + 96).toBe(390 - 16);
    // Wider screens keep the saved position.
    expect(
      clampSavedQuickExitPosition({ left: 40, top: 400 }, { width: 1024, height: 800 }, size),
    ).toEqual({ left: 40, top: 400 });
  });
  it("computes the dock after mount and on resize/orientation change, not during render", () => {
    const src = read("src/components/QuickExitButton.tsx");
    expect(src).not.toMatch(/window\.innerWidth[^\n]*\n?[^\n]*useDraggable/);
    expect(src).toMatch(/addEventListener\("resize", measure\)/);
    expect(src).toMatch(/addEventListener\("orientationchange", measure\)/);
    expect(read("src/components/AppShell.tsx")).not.toMatch(/window\.innerWidth/);
    expect(read("src/routes/_authenticated/onboarding.tsx")).not.toMatch(/window\.innerWidth/);
  });
  it("keeps a 44px tap target and the visible label 'Quick exit'", () => {
    const src = read("src/components/QuickExitButton.tsx");
    expect(src).toMatch(/min-h-\[44px\] min-w-\[44px\]/);
    expect(src).toMatch(/<span>Quick exit<\/span>/);
  });
  it("headers are sticky and opaque on phones, with a first-paint CSS dock", () => {
    const css = read("src/styles.css");
    const block = css.slice(
      css.indexOf("@media (max-width: 639.98px), (max-height: 499.98px) {\n  .pp-qe-dock"),
    );
    expect(block).toMatch(/\.pp-qe-dock \{\s*top: calc\(env\(safe-area-inset-top, 0px\) \+ 8px\);/);
    // Survivor header: 60px, sticky, opaque at every width (mobile spec 2026-10-15).
    expect(css).toMatch(
      /\.pp-app-shell \.pp-shell-header \{[^}]*position: sticky;[^}]*top: 0;[^}]*min-height: calc\(60px[^}]*background: var\(--pp-ground\);/,
    );
  });
});
