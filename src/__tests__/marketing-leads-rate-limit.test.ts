import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const functions = readFileSync("src/lib/marketing-leads.functions.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260830120000_marketing_leads_rate_limit.sql",
  "utf8",
);

describe("marketing leads rate limiting", () => {
  it("throttles submissions by IP", () => {
    expect(functions).toContain("ipHash");
    expect(functions).toContain("IP_MAX_PER_WINDOW");
    expect(functions).toContain('.eq("ip_hash", ipHash)');
  });

  it("will not re-send a kit to the same email within the cooldown window", () => {
    expect(functions).toContain("EMAIL_COOLDOWN_MS");
    expect(functions).toContain('.eq("email", email)');
    expect(functions).toContain("recentForEmail");
  });

  it("adds an ip_hash column the rate limit check can query", () => {
    expect(migration).toContain("add column if not exists ip_hash");
    expect(migration).toContain("marketing_leads_ip_hash_created_at_idx");
  });
});
