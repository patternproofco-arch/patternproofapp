import { describe, expect, it } from "vitest";
import { fakeAdmin, type Tables } from "./helpers/fake-supabase";
import {
  assertApprovedCpsWorker,
  assertCpsLink,
  buildCpsScope,
  idInCpsScope,
  isLiveCpsLink,
  logCpsView,
} from "@/lib/cps-access.server";

const W = "qa-cps-worker";
const W2 = "qa-cps-worker-2";
const S = "qa-survivor";
const S2 = "qa-survivor-2";
const HOUR = 3600_000;
const past = new Date(Date.now() - HOUR).toISOString();
const future = new Date(Date.now() + HOUR).toISOString();

function world(over: Partial<Tables> = {}): Tables {
  return {
    user_roles: [
      { user_id: W, role: "cps_worker" },
      { user_id: W2, role: "cps_worker" },
    ],
    cps_access_applications: [
      { user_id: W, status: "approved", suspended_at: null, reverify_due_at: null },
      { user_id: W2, status: "pending_review", suspended_at: null, reverify_due_at: null },
    ],
    cps_client_links: [
      {
        id: "l1",
        worker_user_id: W,
        client_user_id: S,
        status: "active",
        scope_incidents: ["inc-1"],
        scope_evidence: ["ev-1"],
        expires_at: future,
        revoked_at: null,
      },
    ],
    ...over,
  };
}

const link = (over: Record<string, unknown>) => world({
  cps_client_links: [{ ...world().cps_client_links[0], ...over }],
});

describe("cps worker approval", () => {
  it("accepts an approved worker", async () => {
    await expect(assertApprovedCpsWorker(fakeAdmin(world()), W)).resolves.toBeUndefined();
  });
  it("refuses pending, suspended, role-less and overdue workers", async () => {
    await expect(assertApprovedCpsWorker(fakeAdmin(world()), W2)).rejects.toThrow();
    await expect(assertApprovedCpsWorker(fakeAdmin(world()), "nobody")).rejects.toThrow();
    const suspended = world({
      cps_access_applications: [{ user_id: W, status: "approved", suspended_at: past }],
    });
    await expect(assertApprovedCpsWorker(fakeAdmin(suspended), W)).rejects.toThrow();
    const overdue = world({
      cps_access_applications: [{ user_id: W, status: "approved", suspended_at: null, reverify_due_at: past }],
    });
    await expect(assertApprovedCpsWorker(fakeAdmin(overdue), W)).rejects.toThrow();
  });
  it("refuses an approved application without the role", async () => {
    const t = world({ user_roles: [] });
    await expect(assertApprovedCpsWorker(fakeAdmin(t), W)).rejects.toThrow();
  });
});

describe("cps link access", () => {
  it("opens an active, unexpired link for the right worker and survivor", async () => {
    const l = await assertCpsLink(fakeAdmin(world()), W, S);
    expect(l.id).toBe("l1");
    expect(l.scope_incidents).toEqual(["inc-1"]);
  });
  it("denies another survivor, another worker, expired, revoked and non-active links", async () => {
    await expect(assertCpsLink(fakeAdmin(world()), W, S2)).rejects.toThrow("No active access");
    await expect(assertCpsLink(fakeAdmin(world()), W2, S)).rejects.toThrow();
    await expect(assertCpsLink(fakeAdmin(link({ expires_at: past })), W, S)).rejects.toThrow("No active access");
    await expect(assertCpsLink(fakeAdmin(link({ revoked_at: past })), W, S)).rejects.toThrow("No active access");
    await expect(assertCpsLink(fakeAdmin(link({ status: "revoked" })), W, S)).rejects.toThrow("No active access");
  });
  it("fails closed on a missing or unreadable expiry", () => {
    expect(isLiveCpsLink({ status: "active", revoked_at: null, expires_at: null })).toBe(false);
    expect(isLiveCpsLink({ status: "active", revoked_at: null, expires_at: "garbage" })).toBe(false);
    expect(isLiveCpsLink(null)).toBe(false);
    expect(isLiveCpsLink({ status: "active", revoked_at: null, expires_at: future })).toBe(true);
  });
  it("denies a link whose worker lost approval", async () => {
    const t = world({ cps_access_applications: [{ user_id: W, status: "rejected" }] });
    await expect(assertCpsLink(fakeAdmin(t), W, S)).rejects.toThrow();
  });
});

describe("cps scope", () => {
  const link0 = { scope_incidents: ["inc-1"], scope_evidence: ["ev-1"] };
  it("allows only picked ids, with no shortcut", () => {
    expect(idInCpsScope(link0, "incident", "inc-1")).toBe(true);
    expect(idInCpsScope(link0, "incident", "inc-2")).toBe(false);
    expect(idInCpsScope(link0, "evidence", "inc-1")).toBe(false);
    expect(idInCpsScope({ scope_incidents: [], scope_evidence: [] }, "incident", "inc-1")).toBe(false);
  });
});

describe("building a scope from her picks", () => {
  const t = (): Tables => ({
    incidents: [
      { id: "ok", user_id: S, source: "survivor", confirmed_at: past, deleted_at: null },
      { id: "ai-unconfirmed", user_id: S, source: "ai_extracted", confirmed_at: null, deleted_at: null },
      { id: "ai-confirmed", user_id: S, source: "ai_extracted", confirmed_at: past, deleted_at: null },
      { id: "gone", user_id: S, source: "survivor", confirmed_at: past, deleted_at: past },
      { id: "theirs", user_id: S2, source: "survivor", confirmed_at: past, deleted_at: null },
    ],
    evidence: [
      { id: "ev-ok", user_id: S },
      { id: "ev-priv", user_id: S },
      { id: "ev-other", user_id: S2 },
    ],
    attorney_evidence_reviews: [
      { client_user_id: S, evidence_id: "ev-priv", status: "privileged" },
      { client_user_id: S, evidence_id: "ev-ok", status: "useful" },
    ],
  });
  it("keeps safe items and says why the rest were left out", async () => {
    const r = await buildCpsScope(fakeAdmin(t()), S, {
      incidents: ["ok", "ai-unconfirmed", "ai-confirmed", "gone", "theirs", "missing"],
      evidence: ["ev-ok", "ev-priv", "ev-other", "ev-missing"],
    });
    expect(r.scope.incidents.sort()).toEqual(["ai-confirmed", "ok"]);
    expect(r.scope.evidence).toEqual(["ev-ok"]);
    const why = Object.fromEntries(r.excluded.map((e) => [e.id, e.reason]));
    expect(why["ai-unconfirmed"]).toMatch(/not yet confirmed/);
    expect(why["ev-priv"]).toMatch(/privileged/);
    expect(Object.keys(why).sort()).toEqual(
      ["ai-unconfirmed", "ev-missing", "ev-other", "ev-priv", "gone", "missing", "theirs"].sort(),
    );
  });
  it("shares nothing when given nothing", async () => {
    const r = await buildCpsScope(fakeAdmin(t()), S, { incidents: [], evidence: [] });
    expect(r.scope).toEqual({ incidents: [], evidence: [] });
  });
});

describe("view log", () => {
  const l = { id: "l1", worker_user_id: W, client_user_id: S };
  it("writes the view, and refuses the view when the log cannot be written", async () => {
    const rows: unknown[] = [];
    const ok = { from: () => ({ insert: async (r: unknown) => (rows.push(r), { error: null }) }) };
    await logCpsView(ok, l, "incident", "inc-1");
    expect(rows).toHaveLength(1);
    const bad = { from: () => ({ insert: async () => ({ error: { message: "down" } }) }) };
    await expect(logCpsView(bad, l, "incident", "inc-1")).rejects.toThrow(/not shown/);
  });
});
