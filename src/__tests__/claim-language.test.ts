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
        for (const m of text.matchAll(new RegExp(re.source, re.flags + "g"))) {
          // Explicit disclaimers ("we do not offer end-to-end encryption") are fine.
          const around = text.slice(Math.max(0, (m.index ?? 0) - 90), (m.index ?? 0) + 40);
          if (/\bnot\b|\bno\b|\bnever\b/i.test(around)) continue;
          offenders.push(`${file}: ${m[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
