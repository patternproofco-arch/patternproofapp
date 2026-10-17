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
      attorney_access_applications: status ? [{ user_id: "a", status }] : [],
    });
    await expect(assertApprovedAttorneyAccount(db, "a")).rejects.toThrow(
      "Attorney approval required",
    );
  });
  it("accepts a reviewed account", async () => {
    const db = fakeAdmin({
      user_roles: [{ user_id: "a", role: "attorney" }],
      attorney_access_applications: [{ user_id: "a", status: "approved" }],
    });
    await expect(assertApprovedAttorneyAccount(db, "a")).resolves.toBeUndefined();
  });
  it("cannot use another applicant’s approval", async () => {
    const db = fakeAdmin({ attorney_access_applications: [{ user_id: "b", status: "approved" }] });
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

describe("mixed-role admin accounts", () => {
  it("an unreviewed attorney role does not block an admin's account-level access", async () => {
    for (const roles of [
      ["survivor", "attorney", "admin"],
      ["attorney", "admin"],
    ]) {
      const db = fakeAdmin({
        user_roles: roles.map((role) => ({ user_id: "g", role })),
        attorney_access_applications: [],
      });
      await expect(assertApprovedAttorneyAccount(db, "g")).resolves.toBeUndefined();
    }
  });
  it("attorney-only endpoints still require approval for admins", async () => {
    const db = fakeAdmin({
      user_roles: [
        { user_id: "g", role: "attorney" },
        { user_id: "g", role: "admin" },
      ],
      attorney_access_applications: [],
    });
    await expect(assertApprovedAttorney(db, "g")).rejects.toThrow("Attorney approval required");
  });
  it("survivor+attorney+admin keeps the survivor space (admin pages render inside it)", () => {
    expect(
      resolvePortal({
        roles: ["survivor", "attorney", "admin"],
        is_survivor: true,
        is_org_partner: false,
        attorney_approved: false,
      }),
    ).toBe("survivor");
  });
  it("attorney+admin without approval is routed to /admin, not intake", () => {
    expect(
      resolvePortal({
        roles: ["attorney", "admin"],
        is_survivor: false,
        is_org_partner: false,
        attorney_approved: false,
      }),
    ).toBe("/admin");
  });
  it("a non-admin unreviewed attorney is still gated", async () => {
    const db = fakeAdmin({
      user_roles: [
        { user_id: "a", role: "attorney" },
        { user_id: "a", role: "survivor" },
      ],
      attorney_access_applications: [],
    });
    await expect(assertApprovedAttorneyAccount(db, "a")).rejects.toThrow(
      "Attorney approval required",
    );
  });
});
