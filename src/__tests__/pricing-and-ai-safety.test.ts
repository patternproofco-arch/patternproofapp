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
  // Live (non-comment) source may not reference the removed diagnostic fields
  // or name psychological tactics. Comment lines documenting the removal are
  // allowed, but NO file is exempt wholesale.
  const FORBIDDEN = [/abuser_tactics/, /main_pattern_label/, /secondary_patterns/, /what_pattern_may_show/, /DARVO/i, /love[- ]bomb/i, /\/abuser-tactics/];
  // Guardrail prompts name terms only to forbid the model from using them.
  const GUARDRAIL = /ai-chat\.functions\.ts|agent-prompt\.ts/;

  function liveLines(text: string) {
    let inBlock = false;
    return text.split("\n").filter((line) => {
      const t = line.trim();
      if (inBlock) {
        if (t.includes("*/")) inBlock = false;
        return false;
      }
      if (t.startsWith("/*")) {
        if (!t.includes("*/")) inBlock = true;
        return false;
      }
      return !t.startsWith("//") && !t.startsWith("*");
    });
  }

  it("has no live reference to the removed diagnostic fields or tactic labels", () => {
    const offenders: string[] = [];
    for (const [file, text] of SOURCES) {
      if (GUARDRAIL.test(file)) continue;
      liveLines(text).forEach((line, i) => {
        for (const re of FORBIDDEN) {
          if (re.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim().slice(0, 80)}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the attorney_summary prompt to dates, counts, and frequency only", () => {
    const src = readFileSync("src/lib/pattern-analysis.functions.ts", "utf8");
    expect(src).toMatch(/attorney_summary/);
    expect(src).toMatch(/FREQUENCY ONLY/);
    // No live line may mention tactics (the removal comment is allowed).
    expect(liveLines(src).filter((l) => /tactic/i.test(l))).toEqual([]);
  });

  it("has no /abuser-tactics route or route-tree entry", () => {
    expect(SOURCES.some(([f]) => f.includes("abuser-tactics"))).toBe(false);
    expect(readFileSync("src/routeTree.gen.ts", "utf8")).not.toContain("abuser-tactics");
  });

  it("ignores abuser_tactics on legacy cached analyses", () => {
    const legacy = {
      abuser_tactics: [{ tactic: "Legacy label", description: "legacy description" }],
      main_pattern_label: "Legacy primary pattern",
      secondary_patterns: ["Legacy secondary"],
      what_pattern_may_show: "Legacy interpretation",
      attorney_summary: "12 entries between March and August.",
    };
    const r = buildPatternExport(legacy, { attorney_summary: { status: "confirmed" } });
    const blob = JSON.stringify(r.redactedAnalysis) + r.lines.join("\n");
    for (const s of ["Legacy label", "legacy description", "Legacy primary pattern", "Legacy secondary", "Legacy interpretation"]) {
      expect(blob).not.toContain(s);
    }
    expect(r.redactedAnalysis.attorney_summary).toBe("12 entries between March and August.");
  });
});
