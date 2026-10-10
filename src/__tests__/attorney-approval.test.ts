import { describe, it, expect } from "vitest";
import {
  assertApprovedAttorney,
  assertApprovedAttorneyAccount,
} from "@/lib/attorney-approval.server";
import { fakeAdmin } from "./helpers/fake-supabase";
import { resolvePortal } from "@/lib/portal-access";

describe("database-owned attorney approval", () => {
  it.each(["pending_review", "rejected", undefined])("denies %s", async (status) => {
    const db = fakeAdmin({
      user_roles: [{ user_id: "a", role: "attorney" }],
      attorney_applications: status ? [{ user_id: "a", status }] : [],
    });
    await expect(assertApprovedAttorneyAccount(db, "a")).rejects.toThrow(
      "Attorney approval required",
    );
  });
  it("accepts a reviewed account", async () => {
    const db = fakeAdmin({
      user_roles: [{ user_id: "a", role: "attorney" }],
      attorney_applications: [{ user_id: "a", status: "approved" }],
    });
    await expect(assertApprovedAttorneyAccount(db, "a")).resolves.toBeUndefined();
  });
  it("cannot use another applicant’s approval", async () => {
    const db = fakeAdmin({ attorney_applications: [{ user_id: "b", status: "approved" }] });
    await expect(assertApprovedAttorney(db, "a")).rejects.toThrow("Attorney approval required");
  });
  it("keeps survivor-only access available", async () => {
    await expect(
      assertApprovedAttorneyAccount(
        fakeAdmin({ user_roles: [{ user_id: "s", role: "survivor" }] }),
        "s",
      ),
    ).resolves.toBeUndefined();
  });
  it("routes pending attorney accounts to intake", () => {
    expect(
      resolvePortal({
        roles: ["attorney"],
        is_survivor: false,
        is_org_partner: false,
        attorney_approved: false,
      }),
    ).toBe("/attorney-apply");
  });
  it("routes reviewed attorneys to the portal", () => {
    expect(
      resolvePortal({
        roles: ["attorney"],
        is_survivor: false,
        is_org_partner: false,
        attorney_approved: true,
      }),
    ).toBe("/clients");
  });
});
