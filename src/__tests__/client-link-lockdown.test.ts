import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0027_lock_client_link_updates.sql", "utf8");

describe("survivor cannot reopen or widen a share from the browser", () => {
  it("drops the loose client update policy", () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Clients manage clio share consent"/);
  });
  it("only lets clients update consent and withdrawal columns", () => {
    expect(sql).toMatch(/GRANT UPDATE \(clio_share_consent, clio_share_consent_at, status, revoked_at\)/);
  });
  it("blocks reopening a withdrawn share", () => {
    expect(sql).toMatch(/A withdrawn share cannot be reopened/);
  });
});
