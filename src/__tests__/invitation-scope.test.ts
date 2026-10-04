import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { snapshotShareScope } from "@/lib/grant-snapshot.server";
import { freezeInvitationScope, scopeForAcceptance } from "@/lib/invitation-scope.server";
import { makeRwAdmin } from "./helpers/fake-rw-supabase";

const CLIENT = "client-1";
const T0 = "2026-09-01T10:00:00Z"; // invitation created
const BEFORE = "2026-08-15T10:00:00Z";
const AFTER = "2026-09-05T10:00:00Z";

const inc = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  user_id: CLIENT,
  created_at: BEFORE,
  deleted_at: null,
  share_readiness: "ok_to_share",
  ...over,
});
const ev = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  user_id: CLIENT,
  created_at: BEFORE,
  deleted_at: null,
  share_readiness: "private", // files have no readiness control; the column default must not block them
  ...over,
});

function db() {
  return makeRwAdmin({
    incidents: [
      inc("a"),
      inc("b"),
      inc("secret", { share_readiness: "private" }),
      inc("maybe", { share_readiness: "undecided" }),
      { ...inc("theirs"), user_id: "someone-else" },
    ],
    evidence: [ev("f1"), ev("f2")],
  });
}

describe("scope is fixed when the survivor creates the invitation", () => {
  it("'share everything' becomes the exact ids that exist right now, minus private and undecided entries", async () => {
    const f = await freezeInvitationScope(db(), CLIENT, { include_all_incidents: true, include_all_evidence: true });
    expect(f.scope_incidents.sort()).toEqual(["a", "b"]);
    expect(f.scope_evidence.sort()).toEqual(["f1", "f2"]);
  });

  it("explicit picks win over the 'all' flag and never include another account's records", async () => {
    const f = await freezeInvitationScope(db(), CLIENT, {
      include_all_incidents: false,
      scope_incidents: ["a", "theirs", "secret"],
      include_all_evidence: false,
      scope_evidence: ["f1"],
    });
    expect(f.scope_incidents).toEqual(["a"]);
    expect(f.scope_evidence).toEqual(["f1"]);
    expect(f.excluded).toContainEqual({ kind: "incident", id: "theirs", reason: "not_available" });
    expect(f.excluded).toContainEqual({ kind: "incident", id: "secret", reason: "kept_private" });
  });
});

describe("records added between the invitation and its acceptance", () => {
  it("are not shared: acceptance only narrows the recorded ids", async () => {
    const admin = db();
    const frozen = await freezeInvitationScope(admin, CLIENT, { include_all_incidents: true, include_all_evidence: true });
    // Days later, before the attorney opens it, the survivor adds more and marks one OK to share.
    admin.tables.incidents!.push(inc("new1", { created_at: AFTER }), inc("new2", { created_at: AFTER }));
    admin.tables.evidence!.push(ev("fNew", { created_at: AFTER }));
    admin.tables.incidents!.find((i) => i.id === "secret")!.share_readiness = "ok_to_share";

    const accepted = await scopeForAcceptance(admin, {
      client_user_id: CLIENT,
      created_at: T0,
      include_all_incidents: false,
      include_all_evidence: false,
      scope_incidents: frozen.scope_incidents,
      scope_evidence: frozen.scope_evidence,
    });
    expect(accepted.scope_incidents.sort()).toEqual(["a", "b"]);
    expect(accepted.scope_evidence.sort()).toEqual(["f1", "f2"]);
  });

  it("(the old behavior, for contrast) resolving 'share all' at acceptance WOULD have shared them", async () => {
    const admin = db();
    admin.tables.incidents!.push(inc("new1", { created_at: AFTER }));
    const old = await snapshotShareScope(admin, CLIENT, { include_all_incidents: true, include_all_evidence: true });
    expect(old.scope_incidents).toContain("new1");
  });

  it("an entry she deleted, or marked private, after inviting drops out", async () => {
    const admin = db();
    const frozen = await freezeInvitationScope(admin, CLIENT, { include_all_incidents: true, include_all_evidence: true });
    admin.tables.incidents!.find((i) => i.id === "a")!.deleted_at = "2026-09-02T00:00:00Z";
    admin.tables.incidents!.find((i) => i.id === "b")!.share_readiness = "private";
    const accepted = await scopeForAcceptance(admin, {
      client_user_id: CLIENT,
      created_at: T0,
      include_all_incidents: false,
      include_all_evidence: false,
      scope_incidents: frozen.scope_incidents,
      scope_evidence: frozen.scope_evidence,
    });
    expect(accepted.scope_incidents).toEqual([]);
  });

  it("an invitation made before this rule (blanket flag, no ids) only reaches what existed when it was created", async () => {
    const admin = db();
    admin.tables.incidents!.push(inc("later", { created_at: AFTER }));
    admin.tables.evidence!.push(ev("fLater", { created_at: AFTER }));
    const accepted = await scopeForAcceptance(admin, {
      client_user_id: CLIENT,
      created_at: T0,
      include_all_incidents: true,
      include_all_evidence: true,
      scope_incidents: [],
      scope_evidence: [],
    });
    expect(accepted.scope_incidents.sort()).toEqual(["a", "b"]);
    expect(accepted.scope_evidence.sort()).toEqual(["f1", "f2"]);
  });

  it("a blanket invitation with no creation time can't be bounded, so it shares nothing", async () => {
    const accepted = await scopeForAcceptance(db(), {
      client_user_id: CLIENT,
      created_at: null,
      include_all_incidents: true,
      include_all_evidence: true,
    });
    expect(accepted.scope_incidents).toEqual([]);
    expect(accepted.scope_evidence).toEqual([]);
  });
});

describe("fails closed", () => {
  it("a failed read at acceptance stops the share instead of sharing more", async () => {
    const admin = db();
    const orig = admin.from;
    admin.from = ((n: string) =>
      n === "incidents"
        ? ({
            select: () => ({
              eq: () => ({
                is: () => ({
                  order: () => ({ range: async () => ({ data: null, error: { message: "connection reset" } }) }),
                }),
              }),
            }),
          } as never)
        : orig(n)) as typeof admin.from;
    await expect(
      scopeForAcceptance(admin, {
        client_user_id: CLIENT,
        created_at: T0,
        include_all_incidents: false,
        include_all_evidence: false,
        scope_incidents: ["a"],
        scope_evidence: [],
      }),
    ).rejects.toThrow(/couldn't load every/);
  });
});

describe("both invitation flows use it", () => {
  for (const file of ["src/lib/attorney-invitations.functions.ts", "src/lib/advocate.functions.ts"]) {
    const src = readFileSync(file, "utf8");
    it(`${file}: freezes at creation, narrows at acceptance, never stores a blanket flag`, () => {
      expect(src).toContain("freezeInvitationScope");
      expect(src).toContain("scopeForAcceptance");
      expect(src).not.toMatch(/snapshotShareScope\(supabaseAdmin, inv\.client_user_id/);
      const create = src.slice(src.indexOf("Invitation = createServerFn"), src.indexOf("export const listMy"));
      expect(create).toMatch(/include_all_incidents: false,\s*\n\s*include_all_evidence: false,/);
    });
  }
});
