import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards the truth-audit constraints: these phrases overstate what the
 * product can prove, so they must never reappear in user-facing source.
 */
const BANNED = [
  /end-to-end encrypt/i,
  /zero[- ]knowledge/i,
  /tamper[- ]proof/i,
  /bank[- ]level security/i,
  /court[- ]admissible/i,
  /guaranteed? (?:outcome|to win|result)/i,
  /military[- ]grade/i,
];

function walk(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p) && !p.endsWith(".gen.ts") && !p.includes("__tests__")) out.push(p);
  }
  return out;
}

describe("user-facing claim language", () => {
  it("contains no overstated security or legal-outcome claims", () => {
    const offenders: string[] = [];
    for (const file of walk("src")) {
      const text = readFileSync(file, "utf8");
      for (const re of BANNED) {
        const m = text.match(re);
        if (m) offenders.push(`${file}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
