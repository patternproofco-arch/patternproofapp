import { describe, expect, it } from "vitest";
import { memDb, type MemTables } from "./helpers/mem-db";
import {
  approveWorker,
  reviewCpsApplication,
  submitCpsApplication,
  type SubmitInput,
} from "@/lib/cps-applications.server";
import { assertApprovedCpsWorker } from "@/lib/cps-access.server";

const CFG = {
  defaults: { cps_access_applications: () => ({ status: "pending_review", suspended_at: null, reverify_due_at: null }) },
  unique: { cps_access_applications: ["user_id"], user_roles: ["user_id", "role"] },
};
const world = (): MemTables => ({
  cps_allowed_domains: [{ domain: "dcs.example.gov", active: true }, { domain: "old.example.gov", active: false }],
  cps_denied_senders: [{ value: "bad.example.gov" }],
  user_roles: [],
  cps_access_applications: [],
});
const input = (over: Partial<SubmitInput> = {}): SubmitInput => ({
  userId: "u1",
  accountEmail: "pat@dcs.example.gov",
  accountEmailConfirmed: true,
  fullName: "Pat Worker",
  agencyName: "Example DCS",
  jurisdiction: "Example County",
  professionalType: "agency_caseworker",
  ...over,
});
const app = (db: ReturnType<typeof memDb>, id = "u1") =>
  db.tables.cps_access_applications.find((r) => r.user_id === id);

describe("applying", () => {
  it("auto-approves a confirmed caseworker on an accepted domain, with the role and a 90-day recheck", async () => {
    const db = memDb(world(), CFG);
    const r = await submitCpsApplication(db, input());
    expect(r.status).toBe("approved");
    expect(app(db)).toMatchObject({ status: "approved", verification_tier: 1 });
    expect(db.tables.user_roles).toHaveLength(1);
    expect(db.tables.user_roles[0]).toMatchObject({ user_id: "u1", role: "cps_worker" });
    expect(Date.parse(String(app(db)?.reverify_due_at))).toBeGreaterThan(Date.now() + 80 * 86_400_000);
    await expect(assertApprovedCpsWorker(db, "u1")).resolves.toBeUndefined();
  });
  it("refuses an unconfirmed or missing account email", async () => {
    const db = memDb(world(), CFG);
    await expect(submitCpsApplication(db, input({ accountEmailConfirmed: false }))).rejects.toThrow(/Confirm your work email/);
    await expect(submitCpsApplication(db, input({ accountEmail: null }))).rejects.toThrow();
    expect(db.tables.cps_access_applications).toHaveLength(0);
  });
  it("keeps social workers and court staff pending for a person, even on an accepted domain", async () => {
    const db = memDb(world(), CFG);
    const r = await submitCpsApplication(db, input({ professionalType: "licensed_social_worker" }));
    expect(r.status).toBe("pending_review");
    expect(app(db)?.verification_tier).toBe(2);
    expect(db.tables.user_roles).toHaveLength(0);
  });
  it("keeps non-government email pending as tier 3", async () => {
    const db = memDb(world(), CFG);
    await submitCpsApplication(db, input({ accountEmail: "pat@gmail.com" }));
    expect(app(db)).toMatchObject({ status: "pending_review", verification_tier: 3 });
  });
  it("does not use an inactive domain", async () => {
    const db = memDb(world(), CFG);
    await submitCpsApplication(db, input({ accountEmail: "pat@old.example.gov" }));
    expect(app(db)?.status).not.toBe("approved");
  });
  it("rejects blocked and lookalike domains", async () => {
    const db = memDb(world(), CFG);
    await submitCpsApplication(db, input({ userId: "u2", accountEmail: "x@bad.example.gov" }));
    await submitCpsApplication(db, input({ userId: "u3", accountEmail: "x@dcs-example.gov" }));
    expect(app(db, "u2")?.status).toBe("rejected");
    expect(app(db, "u3")?.status).toBe("rejected");
    expect(db.tables.user_roles).toHaveLength(0);
  });
  it("sends everything to a person when the lists cannot be read", async () => {
    const t = world();
    const db = memDb(t, CFG);
    const broken = { ...db, from: (n: string) => (n === "cps_allowed_domains" ? ({ select: () => ({ eq: async () => ({ data: null, error: { message: "down" } }) }) } as never) : db.from(n)) };
    const r = await submitCpsApplication(broken, input());
    expect(r.decision?.action).toBe("manual");
    expect(app(db)?.status).toBe("pending_review");
    expect(db.tables.user_roles).toHaveLength(0);
  });
  it("a repeat submit never overwrites or re-decides", async () => {
    const db = memDb(world(), CFG);
    await submitCpsApplication(db, input({ accountEmail: "pat@gmail.com" }));
    const again = await submitCpsApplication(db, input());
    expect(again.existing).toBe(true);
    expect(app(db)?.status).toBe("pending_review");
    expect(db.tables.cps_access_applications).toHaveLength(1);
  });
  it("puts the application back when the role cannot be written", async () => {
    const db = memDb(world(), { ...CFG, failWrites: { user_roles: { message: "down" } } });
    await expect(submitCpsApplication(db, input())).rejects.toThrow();
    expect(app(db)?.status).toBe("pending_review");
  });
});

describe("founder review", () => {
  const pending = () => {
    const db = memDb(world(), CFG);
    return submitCpsApplication(db, input({ accountEmail: "pat@gmail.com" })).then(() => db);
  };
  it("approves, which gives the role and access", async () => {
    const db = await pending();
    const id = String(app(db)?.id);
    await reviewCpsApplication(db, { applicationId: id, reviewerId: "founder", decision: "approve" });
    expect(app(db)).toMatchObject({ status: "approved", reviewed_by: "founder", verification_tier: 3 });
    await expect(assertApprovedCpsWorker(db, "u1")).resolves.toBeUndefined();
  });
  it("suspension cuts access immediately, and reinstating clears it", async () => {
    const db = await pending();
    const id = String(app(db)?.id);
    await reviewCpsApplication(db, { applicationId: id, reviewerId: "f", decision: "approve" });
    await reviewCpsApplication(db, { applicationId: id, reviewerId: "f", decision: "suspend", reason: "reported" });
    await expect(assertApprovedCpsWorker(db, "u1")).rejects.toThrow();
    await reviewCpsApplication(db, { applicationId: id, reviewerId: "f", decision: "approve" });
    await expect(assertApprovedCpsWorker(db, "u1")).resolves.toBeUndefined();
    expect(app(db)?.suspended_at).toBeNull();
  });
  it("rejects, and refuses to approve something already approved", async () => {
    const db = await pending();
    const id = String(app(db)?.id);
    await reviewCpsApplication(db, { applicationId: id, reviewerId: "f", decision: "reject" });
    expect(app(db)?.status).toBe("rejected");
    await approveWorker(db, "u1", { tier: 2, reviewerId: "f" });
    await expect(approveWorker(db, "u1", { tier: 2, reviewerId: "f" })).rejects.toThrow(/cannot be approved/);
  });
  it("reports an unknown application", async () => {
    const db = await pending();
    await expect(reviewCpsApplication(db, { applicationId: "nope", reviewerId: "f", decision: "approve" })).rejects.toThrow();
  });
});
