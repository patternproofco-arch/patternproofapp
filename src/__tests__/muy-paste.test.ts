import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BRINGUP_FILES,
  SECTION0,
  SECTION2,
  SECTION3,
  buildPaste,
} from "../../scripts/muy-paste.mjs";

const read = (p: string) => readFileSync(p, "utf8");

describe("muy bring-up paste", () => {
  const paste: string = buildPaste();

  it("starts with the muy-only line and the step order for Grace", () => {
    expect(paste.split("\n")[0]).toBe(
      "-- RUN ON muy (muynotmkcmehxnkhffzl) ONLY — Lovable sync reconcile",
    );
    const top = paste.slice(0, 2500);
    expect(top).toContain("1) Run SECTION 0 and save the output");
    expect(top).toContain("2) Run SECTION 1");
    expect(top).toContain("3) Run SECTION 2 and send the output to Builder");
    expect(top).toContain("SECTION 3 is an undo");
  });

  it("section 1 is every bring-up migration verbatim, in order, ending with the reconcile", () => {
    let at = 0;
    for (const f of BRINGUP_FILES as string[]) {
      const body = read(`supabase/migrations/${f}.sql`).trimEnd();
      const i = paste.indexOf(body, at);
      expect(i, f).toBeGreaterThan(at);
      at = i + body.length;
    }
    expect((BRINGUP_FILES as string[]).at(-1)).toBe("20261011200000_lovable_sync_reconcile");
    expect(read("supabase/migrations/20261011200000_lovable_sync_reconcile.sql")).toBe(
      read("drizzle/migrations/0040_lovable_sync_reconcile.sql"),
    );
  });

  it("sections 0 and 2 are verbatim and read-only; section 3 is commented out", () => {
    for (const f of [SECTION0, SECTION2]) {
      const body = read(f);
      expect(paste).toContain(body.trimEnd());
      expect(body).not.toMatch(
        /^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE|TRUNCATE)\b/im,
      );
    }
    const s3 = paste.slice(paste.indexOf("SECTION 3: UNDO"));
    for (const line of s3.split("\n").slice(1).filter(Boolean))
      expect(line.startsWith("--")).toBe(true);
    expect(s3).toContain(
      read(SECTION3)
        .trimEnd()
        .split("\n")
        .map((l) => "-- " + l)
        .join("\n"),
    );
  });

  it("section 2 checks the five untracked tables and the undo snapshot", () => {
    const s2 = read(SECTION2);
    for (const t of [
      "email_send_log",
      "suppressed_emails",
      "clio_document_exports",
      "org_follow_ups",
      "referral_engagements",
    ])
      expect(s2).toContain(`'${t}'`);
    expect(s2).toMatch(/relforcerowsecurity/);
    expect(s2).toContain("_reconcile_secdef_acl_snapshot");
  });
});
