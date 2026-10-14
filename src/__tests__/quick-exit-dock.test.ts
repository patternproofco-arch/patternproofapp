import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { onboardingQuickExitDock, shellQuickExitDock } from "@/lib/quick-exit-dock";

describe("Quick Exit docking on phones", () => {
  it("survivor shell docks in the sticky header's left slot below 640px", () => {
    expect(shellQuickExitDock(390)).toEqual({ left: 16, top: 13 });
    expect(shellQuickExitDock(1024)).toEqual({ right: 16, top: 70 });
    expect(shellQuickExitDock(undefined)).toEqual({ right: 16, top: 70 });
  });
  it("onboarding docks top-right inside its sticky header row below 640px", () => {
    expect(onboardingQuickExitDock(390)).toEqual({ right: 20, top: 14 });
    expect(onboardingQuickExitDock(800)).toEqual({ right: 16, top: 70 });
  });
  it("the survivor shell header is sticky and opaque on phones", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const block = css.slice(css.lastIndexOf("@media (max-width: 639.98px)"));
    expect(block).toMatch(/\.pp-app-shell \.pp-shell-header \{[^}]*position: sticky;[^}]*top: 0;/);
    expect(block).toMatch(/background: var\(--pp-ground\)/);
  });
  it("Quick Exit is still rendered (not hidden) in the shell and onboarding", () => {
    expect(readFileSync("src/components/AppShell.tsx", "utf8")).toMatch(/<QuickExitButton\s/);
    expect(readFileSync("src/routes/_authenticated/onboarding.tsx", "utf8")).toMatch(
      /<QuickExitButton\s/,
    );
  });
});
