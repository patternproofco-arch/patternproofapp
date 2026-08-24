import { describe, expect, it } from "vitest";
import { canChangeMemberRole, canInviteRole, canRemoveMember } from "@/lib/team-permissions";

describe("team role enforcement", () => {
  it("reserves administrator invitations for owners", () => {
    expect(canInviteRole("owner", "admin")).toBe(true);
    expect(canInviteRole("admin", "admin")).toBe(false);
    expect(canInviteRole("admin", "member")).toBe(true);
  });

  it("never removes or demotes the owner through generic controls", () => {
    expect(canRemoveMember("owner", "owner")).toBe(false);
    expect(canChangeMemberRole("owner", "owner", "member")).toBe(false);
  });

  it("prevents administrators from managing peer administrators", () => {
    expect(canRemoveMember("admin", "admin")).toBe(false);
    expect(canChangeMemberRole("admin", "admin", "member")).toBe(false);
  });
});
