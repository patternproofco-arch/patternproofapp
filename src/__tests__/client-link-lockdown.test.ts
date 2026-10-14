import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Lovable's lock_client_link_updates, renumbered to 0033 in the Lovable sync.
const sql = readFileSync("drizzle/migrations/0038_lock_client_link_updates.sql", "utf8");
const guard197 = readFileSync(
  "supabase/migrations/20261008120000_acl_client_update_guard_allowlist.sql",
  "utf8",
);
const guardBody = guard197.slice(
  guard197.indexOf("CREATE OR REPLACE FUNCTION public.attorney_client_links_client_update_guard()"),
);

describe("survivor cannot reopen or widen a share from the browser", () => {
  it("drops the loose client update policy", () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Clients manage clio share consent"/);
  });
  it("only lets clients update consent and withdrawal columns", () => {
    expect(sql).toMatch(
      /GRANT UPDATE \(clio_share_consent, clio_share_consent_at, status, revoked_at\)/,
    );
  });
  it("uses the reviewed #197 guard body verbatim, not Lovable's looser one", () => {
    expect(sql).toContain(guardBody.trim());
    expect(sql).toContain("NEW.revoked_at := now();");
    expect(sql).not.toMatch(/SET search_path TO 'public'/);
    expect(sql).not.toContain("Only consent and withdrawal can be changed here");
  });
  it("is identical in the Supabase migration path", () => {
    expect(
      readFileSync("supabase/migrations/20261011190000_lock_client_link_updates.sql", "utf8"),
    ).toBe(sql);
  });
});
