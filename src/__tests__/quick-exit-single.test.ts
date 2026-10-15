import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Every _authenticated route renders inside AppShell, which owns the single Quick
// Exit. A route that adds its own stacks a second button (live bug on /onboarding).
describe("exactly one Quick Exit on survivor routes", () => {
  const dir = "src/routes/_authenticated";
  const files = readdirSync(dir).filter((f) => f.endsWith(".tsx"));

  it("AppShell renders the shared Quick Exit", () => {
    expect(readFileSync("src/components/AppShell.tsx", "utf8")).toMatch(
      /<QuickExitButton phoneDock \/>/,
    );
  });

  it("no _authenticated route renders its own Quick Exit", () => {
    expect(files.length).toBeGreaterThan(20);
    const offenders = files.filter((f) =>
      /<(QuickExitButton|PublicQuickExit)\b/.test(readFileSync(`${dir}/${f}`, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
