import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Poster tokens: every text/background pair the survivor app uses must reach 4.5:1.
const css = readFileSync("src/styles-survivor-poster.css", "utf8");
const token = (name: string) => {
  const m = css.match(new RegExp(`--pp2-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`missing token ${name}`);
  return m[1];
};
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const PAIRS: Array<[string, string]> = [
  ["ink", "cream"],
  ["ink", "paper"],
  ["ink", "aqua"],
  ["ink", "chartreuse"],
  ["ink", "clay"],
  ["cream", "ink"],
  ["muted", "cream"],
  ["muted", "paper"],
  ["muted", "aqua"],
  ["muted", "chartreuse"],
  ["clay-text", "cream"],
];

describe("poster token contrast", () => {
  it("helper fails a pair under 4.5", () => {
    expect(contrast("#999999", "#ffffff")).toBeLessThan(4.5);
  });
  for (const [fg, bg] of PAIRS) {
    it(`${fg} on ${bg} is at least 4.5:1`, () => {
      expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
    });
  }
  it("has no blur, gradient or shadow declarations", () => {
    const decls = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(decls).not.toMatch(/gradient\(|blur\(/);
    expect(decls).not.toMatch(/box-shadow:(?!\s*none)/);
  });
});
