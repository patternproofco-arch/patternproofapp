import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION =
  "supabase/migrations/20260924160000_honour_share_expiry_has_attorney_access.sql";

describe("honour share expiry in has_attorney_access (RLS)", () => {
  const sql = readFileSync(MIGRATION, "utf8");

  it("redefines private.has_attorney_access with active + expiry fail-closed", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION private.has_attorney_access");
    expect(sql).toContain("status = 'active'");
    // Expired-but-active must be denied at the helper (matches app-server isExpired).
    expect(sql).toMatch(/expires_at IS NULL OR expires_at > now\(\)/);
  });

  it("applies the same expiry gate to firm peer SELECT on attorney_client_links", () => {
    expect(sql).toContain("Firm colleagues read firm client links");
    const firmBlock = sql.slice(sql.indexOf("Firm colleagues read firm client links"));
    expect(firmBlock).toMatch(/expires_at IS NULL OR expires_at > now\(\)/);
    expect(firmBlock).toContain("status = 'active'");
  });

  it("applies the same expiry gate to org peer SELECT on advocate_client_links", () => {
    expect(sql).toContain("Org colleagues read org client links");
    const orgBlock = sql.slice(sql.indexOf("Org colleagues read org client links"));
    expect(orgBlock).toMatch(/expires_at IS NULL OR expires_at > now\(\)/);
    expect(orgBlock).toContain("status = 'active'");
  });

  it("documents that an expired-but-active link is denied (contract)", () => {
    // Static contract: helper EXISTS clause must require non-expired.
    // Live DB RLS denial is verified after Guardian CLEAR + apply.
    const fn = sql.slice(
      sql.indexOf("CREATE OR REPLACE FUNCTION private.has_attorney_access"),
      sql.indexOf("REVOKE ALL ON FUNCTION private.has_attorney_access"),
    );
    expect(fn).toContain("AND status = 'active'");
    expect(fn).toContain("AND (expires_at IS NULL OR expires_at > now())");
    // Must not weaken to status-only.
    expect(fn.replace(/\s+/g, " ")).not.toMatch(
      /WHERE attorney_user_id = _attorney_id AND client_user_id = _client_id AND status = 'active'\)/,
    );
  });
});
