import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { BASE_TIERS, CHARTER_COHORT_CAP, buildTiers } from "@/lib/pricing-tiers";
import { buildPatternExport } from "@/lib/pattern-export";

function walk(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p) && !p.endsWith(".gen.ts") && !p.includes("__tests__")) out.push(p);
  }
  return out;
}
const SOURCES = walk("src").map((f) => [f, readFileSync(f, "utf8")] as const);

describe("attorney pricing", () => {
  it("keeps the Charter cohort capped at 10 firms", () => {
    expect(CHARTER_COHORT_CAP).toBe(10);
    const pricing = readFileSync("src/routes/pricing.tsx", "utf8");
    expect(pricing).toContain("first 10 firms");
    expect(pricing).not.toMatch(/first 15 firms/);
  });

  it("publishes only the three real attorney prices", () => {
    const tiers = buildTiers(4);
    expect(tiers.find((t) => t.key === "attorney_solo")?.price).toBe("$297");
    const firm = tiers.find((t) => t.key === "attorney_firm");
    expect(firm?.price).toBe("$597");
    expect(firm?.priceStrike).toBe("$897");
    expect(buildTiers(0).find((t) => t.key === "attorney_firm")?.price).toBe("$897");
    expect(BASE_TIERS.some((t) => /\$99\b|\$1,?497/.test(t.price))).toBe(false);
  });

  it("shows no stale attorney prices on the marketing pages", () => {
    for (const file of ["src/routes/for-attorneys.tsx", "src/routes/pricing.tsx"]) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/\$1,?497/);
      expect(text).not.toMatch(/\$99\s*(?:\/|per\b| a month)/);
    }
  });
});

describe("AI safety: never diagnose", () => {
  const FORBIDDEN = [/DARVO/i, /gaslight/i, /love[- ]bomb/i, /abuser_tactics/, /\/abuser-tactics/];

  it("never names or infers psychological tactics in product or prompt source", () => {
    const offenders: string[] = [];
    for (const [file, text] of SOURCES) {
      // AI guardrail prompts may name terms only to forbid/reflect them.
      const isGuardrail = /ai-chat\.functions\.ts|agent-prompt\.ts/.test(file);
      for (const re of FORBIDDEN) {
        const m = text.match(re);
        if (!m) continue;
        if (isGuardrail) continue;
        // Comments documenting the removal are allowed.
        offenders.push(`${file}: ${m[0]}`);
      }
    }
    expect(offenders.filter((o) => !/pattern-analysis\.functions\.ts|pattern-export\.ts|attorney-portal\.functions\.ts/.test(o))).toEqual([]);
  });

  it("has no /abuser-tactics route", () => {
    expect(SOURCES.some(([f]) => f.includes("abuser-tactics"))).toBe(false);
  });

  it("ignores abuser_tactics on legacy cached analyses", () => {
    const legacy = {
      abuser_tactics: [{ tactic: "Gaslighting", description: "legacy label" }],
      attorney_summary: "12 entries between March and August.",
    };
    const r = buildPatternExport(legacy, { attorney_summary: { status: "confirmed" } });
    const blob = JSON.stringify(r.redactedAnalysis) + r.lines.join("\n");
    expect(blob).not.toContain("Gaslighting");
    expect(blob).not.toContain("legacy label");
    expect(r.redactedAnalysis.attorney_summary).toBe("12 entries between March and August.");
  });
});
