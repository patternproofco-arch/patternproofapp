import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const attorneyPortal = readFileSync(
  new URL("../lib/attorney-portal.functions.ts", import.meta.url),
  "utf8",
);
const firmFunctions = readFileSync(
  new URL("../lib/firm-grants.functions.ts", import.meta.url),
  "utf8",
);
const controlsMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260823190000_secure_multiseat_controls.sql",
    import.meta.url,
  ),
  "utf8",
);
const foundationMigration = readFileSync(
  new URL("../../supabase/migrations/20260823040000_secure_multiseat.sql", import.meta.url),
  "utf8",
);

describe("multi-seat authorization regressions", () => {
  it("revalidates firm grants against current membership before list reads", () => {
    expect(attorneyPortal.match(/verifiedFirmGrantLinkIds/g)?.length).toBeGreaterThanOrEqual(3);
    expect(attorneyPortal).toContain('.from("firm_members")');
  });

  it("keeps private case notes on the owner-only link assertion", () => {
    const noteSection = attorneyPortal.slice(
      attorneyPortal.indexOf("export const getCaseNote"),
      attorneyPortal.indexOf("/* ------------------------- signed evidence URLs"),
    );
    expect(noteSection).toContain("assertLink(context.userId, data.clientId)");
    expect(noteSection).not.toContain("assertCaseAccess(context.userId, data.clientId)");
  });

  it("revokes grants before deleting a firm membership", () => {
    const revokeAt = controlsMigration.indexOf("UPDATE public.case_grants");
    const deleteAt = controlsMigration.indexOf("DELETE FROM public.firm_members");
    expect(revokeAt).toBeGreaterThan(0);
    expect(deleteAt).toBeGreaterThan(revokeAt);
  });

  it("never returns raw team invitation tokens", () => {
    expect(firmFunctions).not.toMatch(/invitation:\s*\{[^}]*token/s);
  });

  it("creates the seat columns before enforcing the limit", () => {
    const columnsAt = foundationMigration.indexOf("ADD COLUMN IF NOT EXISTS seats_included");
    const triggerAt = foundationMigration.indexOf("CREATE TRIGGER firm_members_enforce_seat_limit");
    expect(columnsAt).toBeGreaterThan(0);
    expect(triggerAt).toBeGreaterThan(columnsAt);
  });

  it("rechecks incompatible professional roles inside invitation RPCs", () => {
    expect(foundationMigration).toContain("role <> 'attorney'::public.app_role");
    expect(foundationMigration).toContain("role <> 'advocate'::public.app_role");
  });
});
