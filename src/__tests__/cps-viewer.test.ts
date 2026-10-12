import { describe, expect, it } from "vitest";
import { memDb, type MemTables } from "./helpers/mem-db";
import { listCpsCases, openCpsCase } from "@/lib/cps-viewer.server";

const W = "w1";
const S = "s1";
const NOW = Date.parse("2026-10-12T12:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const ok = { user_id: S, source: "survivor", confirmed_at: iso(NOW), deleted_at: null, share_readiness: "ok_to_share" };

function world(): MemTables {
  return {
    user_roles: [{ user_id: W, role: "cps_worker" }],
    cps_access_applications: [{ user_id: W, status: "approved", suspended_at: null, reverify_due_at: null, full_name: "Pat Worker", agency_name: "Example DCS" }],
    cps_invitations: [{ id: "inv1", survivor_email: "her@x.org" }],
    cps_client_links: [
      { id: "l1", worker_user_id: W, client_user_id: S, invitation_id: "inv1", status: "active", revoked_at: null, expires_at: iso(NOW + 86_400_000), case_ref: "C1", scope_incidents: ["i1", "i2"], scope_evidence: ["e1"] },
      { id: "l2", worker_user_id: W, client_user_id: S, invitation_id: null, status: "active", revoked_at: null, expires_at: iso(NOW - 1000), case_ref: null, scope_incidents: ["i1"], scope_evidence: [] },
    ],
    incidents: [
      { id: "i1", ...ok, date: "2026-09-01", description: "First", abuse_types: ["verbal"] },
      { id: "i2", ...ok, date: "2026-09-02", description: "Second", abuse_types: [] },
    ],
    evidence: [{ id: "e1", user_id: S, share_readiness: "ok_to_share", deleted_at: null, title: "Photo", date: "2026-09-03", file_type: "image" }],
    attorney_evidence_reviews: [],
    cps_access_log: [],
  };
}
const cfg = { defaults: {} };

describe("worker case list", () => {
  it("lists only live grants, with the survivor's email from the invitation", async () => {
    const db = memDb(world(), cfg);
    const cases = await listCpsCases(db, W);
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({ linkId: "l1", email: "her@x.org", caseRef: "C1" });
  });
  it("refuses an unapproved worker", async () => {
    const t = world();
    t.cps_access_applications[0].status = "pending_review";
    await expect(listCpsCases(memDb(t, cfg), W)).rejects.toThrow();
  });
});

describe("opening a case", () => {
  it("shows exactly the picked items, logs each view, and carries a watermark", async () => {
    const db = memDb(world(), cfg);
    const v = await openCpsCase(db, W, "l1", NOW);
    expect(v.incidents.map((i) => i.id).sort()).toEqual(["i1", "i2"]);
    expect(v.files.map((f) => f.id)).toEqual(["e1"]);
    expect(v.watermark).toContain("Pat Worker");
    expect(v.watermark).toContain("Example DCS");
    expect(db.tables.cps_access_log).toHaveLength(4);
    expect(db.tables.cps_access_log.map((r) => r.item_kind).sort()).toEqual(["evidence", "incident", "incident", "packet"]);
  });
  it("drops an item the moment she marks it private, deletes it, or her attorney marks a file privileged", async () => {
    const t = world();
    t.incidents[0].share_readiness = "private";
    t.incidents[1].deleted_at = iso(NOW);
    t.attorney_evidence_reviews.push({ client_user_id: S, evidence_id: "e1", status: "privileged" });
    const v = await openCpsCase(memDb(t, cfg), W, "l1", NOW);
    expect(v.incidents).toEqual([]);
    expect(v.files).toEqual([]);
  });
  it("refuses an expired, revoked or someone else's grant", async () => {
    const db = memDb(world(), cfg);
    await expect(openCpsCase(db, W, "l2", NOW)).rejects.toThrow("No active access");
    await expect(openCpsCase(db, "other", "l1", NOW)).rejects.toThrow();
    db.tables.cps_client_links[0].revoked_at = iso(NOW);
    await expect(openCpsCase(db, W, "l1", NOW)).rejects.toThrow("No active access");
  });
  it("shows nothing when the view cannot be logged", async () => {
    const db = memDb(world(), { failWrites: { cps_access_log: { message: "down" } } });
    await expect(openCpsCase(db, W, "l1", NOW)).rejects.toThrow(/not shown/);
  });
});
