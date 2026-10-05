import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { effectiveCaseScope } from "@/lib/case-scope.server";
import { freezeInvitationScope } from "@/lib/invitation-scope.server";
import { makeRwAdmin } from "./helpers/fake-rw-supabase";

const CLIENT = "client-1";
const GRANT = "2026-09-01T10:00:00Z";
const BEFORE = "2026-08-15T10:00:00Z";
const AFTER = "2026-09-05T10:00:00Z";

const inc = (id: string, created_at = BEFORE) => ({
  id,
  user_id: CLIENT,
  created_at,
  deleted_at: null,
  share_readiness: "ok_to_share",
});
const file = (id: string, created_at = BEFORE) => ({
  id,
  user_id: CLIENT,
  created_at,
  deleted_at: null,
  share_readiness: "ok_to_share",
});
const theCase = (over: Record<string, unknown> = {}) => ({
  id: "case-1",
  user_id: CLIENT,
  highlighted_incident_ids: ["a", "b"],
  attached_evidence_ids: ["f1"],
  legal_document_ids: [],
  attached_thread_ids: [],
  ...over,
});
const world = (c = theCase()) =>
  makeRwAdmin({
    cases: [c],
    incidents: [inc("a"), inc("b"), inc("late", AFTER), inc("old-unattached")],
    evidence: [file("f1"), file("f2"), file("f-late", AFTER)],
  });

describe("a case-scoped grant is the grant's own ids narrowed by the case", () => {
  it("something attached to the case AFTER consent does not reach the recipient", async () => {
    const admin = world(theCase({ highlighted_incident_ids: ["a", "b", "late"], attached_evidence_ids: ["f1", "f-late"] }));
    const eff = await effectiveCaseScope(
      admin,
      { case_id: "case-1", created_at: GRANT, scope_incidents: ["a", "b"], scope_evidence: ["f1"] },
      CLIENT,
    );
    expect(eff.incidents).toEqual(["a", "b"]);
    expect(eff.evidence).toEqual(["f1"]);
  });

  it("taking something out of the case takes it away from the recipient", async () => {
    const admin = world(theCase({ highlighted_incident_ids: ["a"] }));
    const eff = await effectiveCaseScope(
      admin,
      { case_id: "case-1", created_at: GRANT, scope_incidents: ["a", "b"], scope_evidence: ["f1"] },
      CLIENT,
    );
    expect(eff.incidents).toEqual(["a"]);
  });

  it("is never wider than the grant, even if the case holds more", async () => {
    const admin = world(theCase({ highlighted_incident_ids: ["a", "b", "old-unattached"] }));
    const eff = await effectiveCaseScope(
      admin,
      { case_id: "case-1", created_at: GRANT, scope_incidents: ["a"], scope_evidence: ["f1"] },
      CLIENT,
    );
    expect(eff.incidents).toEqual(["a"]);
  });

  it("an older grant with no recorded ids gets only what existed when it began", async () => {
    const admin = world(theCase({ highlighted_incident_ids: ["a", "late"], attached_evidence_ids: ["f1", "f-late"] }));
    const eff = await effectiveCaseScope(admin, { case_id: "case-1", created_at: GRANT, scope_incidents: [], scope_evidence: [] }, CLIENT);
    expect(eff.incidents).toEqual(["a"]);
    expect(eff.evidence).toEqual(["f1"]);
  });

  it("fails closed: no case, an unreadable case, or no start time share nothing", async () => {
    expect((await effectiveCaseScope(world(), { case_id: null, scope_incidents: ["a"] }, CLIENT)).incidents).toEqual([]);
    expect(
      (await effectiveCaseScope(world(), { case_id: "missing", created_at: GRANT, scope_incidents: ["a"], scope_evidence: [] }, CLIENT)).incidents,
    ).toEqual([]);
    expect(
      (await effectiveCaseScope(world(), { case_id: "case-1", created_at: null, scope_incidents: [], scope_evidence: [] }, CLIENT)).incidents,
    ).toEqual([]);
    const broken = world();
    const orig = broken.from;
    broken.from = ((n: string) =>
      n === "cases"
        ? ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: "down" } }) }) }) }) } as never)
        : orig(n)) as typeof broken.from;
    expect((await effectiveCaseScope(broken, { case_id: "case-1", created_at: GRANT, scope_incidents: ["a"], scope_evidence: [] }, CLIENT)).incidents).toEqual([]);
  });

  it("another account's case is never read", async () => {
    const admin = world(theCase({ user_id: "someone-else" }));
    const eff = await effectiveCaseScope(admin, { case_id: "case-1", created_at: GRANT, scope_incidents: ["a"], scope_evidence: [] }, CLIENT);
    expect(eff.incidents).toEqual([]);
  });
});

describe("sharing a case records the case's records at that moment", () => {
  it("the invitation's ids are the case's records, minus private ones", async () => {
    const admin = makeRwAdmin({
      cases: [theCase({ highlighted_incident_ids: ["a", "secret"], attached_evidence_ids: ["f1"] })],
      incidents: [inc("a"), { ...inc("secret"), share_readiness: "private" }, inc("b")],
      evidence: [file("f1"), file("f2")],
    });
    const f = await freezeInvitationScope(admin, CLIENT, { case_id: "case-1" });
    expect(f.scope_incidents).toEqual(["a"]);
    expect(f.scope_evidence).toEqual(["f1"]);
    expect(f.excluded).toContainEqual({ kind: "incident", id: "secret", reason: "kept_private" });
  });

  it("if the case can't be read, nothing is shared and she is told", async () => {
    const admin = makeRwAdmin({ cases: [], incidents: [inc("a")], evidence: [] });
    await expect(freezeInvitationScope(admin, CLIENT, { case_id: "case-1" })).rejects.toThrow(/nothing was shared/);
  });
});

describe("every sharing path uses the one rule (source contract)", () => {
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  for (const file of [
    "src/lib/attorney-access.server.ts",
    "src/lib/advocate-packet.server.ts",
    "src/lib/advocate.functions.ts",
    "src/lib/cross-references.functions.ts",
  ]) {
    it(`${file} no longer follows the live case lists on its own`, () => {
      const src = read(file);
      expect(src).toMatch(/effectiveCaseScope/);
      expect(src).not.toMatch(/scopedIncidents = \(c\?\.highlighted_incident_ids/);
      expect(src).not.toMatch(/scopeIncIds = \(c\?\.highlighted_incident_ids/);
    });
  }
});
