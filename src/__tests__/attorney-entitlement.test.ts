import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("isAttorneyEntitled attorneyPlans", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/payments.functions.ts"), "utf8");
  const block = src.slice(src.indexOf("const attorneyPlans"), src.indexOf("const attorneyPlans") + 400);

  it("includes the Charter Firm plan", () => {
    expect(block).toContain('"attorney_firm_charter_monthly"');
  });

  it("lists Charter immediately after the standard Firm plan", () => {
    expect(block.indexOf('"attorney_firm_charter_monthly"')).toBeGreaterThan(
      block.indexOf('"attorney_firm_monthly"'),
    );
  });
});
