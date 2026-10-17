import { describe, expect, it } from "vitest";
import { supersedePendingInvitations } from "@/lib/supersede-invitations.server";

function fakeDb(error: unknown = null) {
  const calls: Array<[string, ...unknown[]]> = [];
  const chain: any = {
    from: (t: string) => (calls.push(["from", t]), chain),
    update: (v: unknown) => (calls.push(["update", v]), chain),
    eq: (c: string, v: unknown) => (calls.push(["eq", c, v]), chain),
    neq: (c: string, v: unknown) => (calls.push(["neq", c, v]), chain),
    is: (c: string, v: unknown) => (calls.push(["is", c, v]), chain),
    then: (resolve: (r: { error: unknown }) => void) => resolve({ error }),
  };
  return { db: chain, calls };
}

const base = { clientId: "c1", attorneyEmail: " Lawyer@Firm.test ", caseId: null, keepId: "new" };

describe("supersedePendingInvitations", () => {
  it("revokes only this survivor's other pending invitations to the same attorney", async () => {
    const { db, calls } = fakeDb();
    await supersedePendingInvitations(db, base);
    expect(calls).toContainEqual(["update", { status: "revoked" }]);
    expect(calls).toContainEqual(["eq", "client_user_id", "c1"]);
    expect(calls).toContainEqual(["eq", "attorney_email", "lawyer@firm.test"]);
    expect(calls).toContainEqual(["eq", "status", "pending"]);
    expect(calls).toContainEqual(["neq", "id", "new"]);
  });

  it("never touches a different case's invitation to the same attorney", async () => {
    const withCase = fakeDb();
    await supersedePendingInvitations(withCase.db, { ...base, caseId: "case-1" });
    expect(withCase.calls).toContainEqual(["eq", "case_id", "case-1"]);
    const noCase = fakeDb();
    await supersedePendingInvitations(noCase.db, base);
    expect(noCase.calls).toContainEqual(["is", "case_id", null]);
  });

  it("fails loudly so an earlier wider invitation is not silently left live", async () => {
    const { db } = fakeDb({ message: "boom" });
    await expect(supersedePendingInvitations(db, base)).rejects.toThrow(/earlier invitation/);
  });
});
