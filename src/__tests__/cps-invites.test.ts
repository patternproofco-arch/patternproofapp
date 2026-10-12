import { describe, expect, it } from "vitest";
import { memDb, type MemTables } from "./helpers/mem-db";
import {
  acceptCpsInvite,
  createCpsInvite,
  declineCpsInvite,
  padToMinimum,
  peekCpsInvite,
  revokeCpsGrant,
  type InviteDeps,
} from "@/lib/cps-invites.server";
import { assertCpsLink } from "@/lib/cps-access.server";
import type { AccessAdmin } from "@/lib/assistant-access.server";

const W = "worker-1";
const S = "survivor-1";
const NOW = Date.parse("2026-10-12T12:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

const CFG = {
  defaults: {
    cps_invitations: () => ({ status: "sent" }),
    cps_client_links: () => ({ status: "active", revoked_at: null }),
  },
};

function world(over: Partial<MemTables> = {}): MemTables {
  return {
    user_roles: [{ user_id: W, role: "cps_worker" }],
    cps_access_applications: [
      {
        user_id: W,
        status: "approved",
        suspended_at: null,
        reverify_due_at: null,
        approved_at: iso(NOW - 30 * 86_400_000),
        full_name: "Pat Worker",
        agency_name: "Example DCS",
        verification_tier: 1,
        email_domain: "dcs.example.gov",
      },
    ],
    cps_invitations: [],
    cps_client_links: [],
    incidents: [
      { id: "i1", user_id: S, source: "survivor", confirmed_at: iso(NOW), deleted_at: null, share_readiness: "ok_to_share" },
      { id: "i2", user_id: S, source: "survivor", confirmed_at: iso(NOW), deleted_at: null, share_readiness: "private" },
    ],
    evidence: [],
    attorney_evidence_reviews: [],
    ...over,
  };
}

function authAdmin(meta: Record<string, unknown> | null): AccessAdmin {
  return {
    auth: {
      admin: {
        async getUserById() {
          return meta ? { data: { user: { app_metadata: meta } }, error: null } : { data: { user: null }, error: null };
        },
        async updateUserById() {
          return { error: null };
        },
      },
    },
    async rpc() {
      return { data: null, error: null };
    },
  };
}

type Sent = { to: string; acceptUrl: string; expiresLabel: string };
function deps(db: ReturnType<typeof memDb>, opts: { accounts?: Record<string, { id: string; meta: Record<string, unknown> | null }>; sent?: Sent[]; deliverOk?: boolean } = {}): InviteDeps & { sent: Sent[] } {
  const sent: Sent[] = opts.sent ?? [];
  const accounts = opts.accounts ?? {};
  let n = 0;
  return {
    db,
    authAdmin: authAdmin({}),
    findUserIdByEmail: async (e) => accounts[e]?.id ?? null,
    deliver: async (a) => (sent.push(a), opts.deliverOk !== false),
    newToken: () => `tok${(n++).toString().padStart(8, "0")}`,
    hash: async (t) => `h:${t}`,
    origin: "https://example.test",
    now: NOW,
    sent,
  };
}
// authAdmin that reads the survivor's setting per user id.
function withPolicy(d: ReturnType<typeof deps>, byId: Record<string, Record<string, unknown> | null>) {
  d.authAdmin = {
    ...authAdmin({}),
    auth: { admin: { async getUserById(id: string) { const m = byId[id]; return m ? { data: { user: { app_metadata: m } }, error: null } : { data: { user: null }, error: null }; }, async updateUserById() { return { error: null }; } } },
  } as AccessAdmin;
  return d;
}

describe("creating an invitation", () => {
  it("sends a fixed-template email with a link, and stores only a hash", async () => {
    const db = memDb(world(), CFG);
    const d = deps(db);
    const r = await createCpsInvite(d, W, { email: " Her@Example.org ", caseRef: "CASE-9" });
    expect(r.ok).toBe(true);
    expect(d.sent).toHaveLength(1);
    expect(d.sent[0].to).toBe("her@example.org");
    expect(d.sent[0].acceptUrl).toBe("https://example.test/cps-invite/tok00000000");
    const row = db.tables.cps_invitations[0];
    expect(row.token_hash).toBe("h:tok00000000");
    expect(Object.keys(row)).not.toContain("token");
    expect(Object.values(row)).not.toContain("tok00000000");
    expect(row.case_ref).toBe("CASE-9");
  });
  it("gives the worker the same reply whether the address exists, blocks, or is flooded", async () => {
    const replies: string[] = [];
    // no account
    replies.push((await createCpsInvite(deps(memDb(world(), CFG)), W, { email: "a@x.org" })).message);
    // account that blocks: no email, same reply
    const dBlock = withPolicy(deps(memDb(world(), CFG), { accounts: { "b@x.org": { id: "ub", meta: {} } } }), { ub: { cps_invites: "block" } });
    replies.push((await createCpsInvite(dBlock, W, { email: "b@x.org" })).message);
    expect(dBlock.sent).toHaveLength(0);
    expect(dBlock.db.tables.cps_invitations[0].status).toBe("suppressed");
    expect(new Set(replies).size).toBe(1);
  });
  it("refuses workers who are not approved", async () => {
    const t = world({ cps_access_applications: [{ user_id: W, status: "pending_review" }] });
    await expect(createCpsInvite(deps(memDb(t, CFG)), W, { email: "a@x.org" })).rejects.toThrow();
  });
  it("rejects a bad address and over-long case reference is cut to 60", async () => {
    const db = memDb(world(), CFG);
    await expect(createCpsInvite(deps(db), W, { email: "nope" })).rejects.toThrow(/valid email/);
    await createCpsInvite(deps(db), W, { email: "a@x.org", caseRef: "x".repeat(200) });
    expect(String(db.tables.cps_invitations[0].case_ref)).toHaveLength(60);
  });
  it("holds a new worker to 3 a day, then 10 once established", async () => {
    const fresh = world();
    (fresh.cps_access_applications[0] as Record<string, unknown>).approved_at = iso(NOW - 2 * 86_400_000);
    const db = memDb(fresh, CFG);
    const d = deps(db);
    for (const e of ["a@x.org", "b@x.org", "c@x.org"]) await createCpsInvite(d, W, { email: e });
    await expect(createCpsInvite(d, W, { email: "d@x.org" })).rejects.toThrow(/limit of 3/);
    const old = memDb(world(), CFG);
    const d2 = deps(old);
    for (let i = 0; i < 10; i++) await createCpsInvite(d2, W, { email: `p${i}@x.org` });
    await expect(createCpsInvite(d2, W, { email: "z@x.org" })).rejects.toThrow(/limit of 10/);
  });
  it("does not send a second open invitation to the same address", async () => {
    const db = memDb(world(), CFG);
    const d = deps(db);
    await createCpsInvite(d, W, { email: "a@x.org" });
    await createCpsInvite(d, W, { email: "a@x.org" });
    expect(d.sent).toHaveLength(1);
    expect(db.tables.cps_invitations).toHaveLength(1);
  });
  it("stops delivering to one person after 3 in a day from any workers", async () => {
    const t = world();
    t.cps_invitations = ["w2", "w3", "w4"].map((w, i) => ({ id: `o${i}`, worker_user_id: w, survivor_email: "her@x.org", status: "sent", created_at: iso(NOW - 3600_000), expires_at: iso(NOW + 86_400_000) }));
    const db = memDb(t, CFG);
    const d = deps(db);
    const r = await createCpsInvite(d, W, { email: "her@x.org" });
    expect(r.ok).toBe(true);
    expect(d.sent).toHaveLength(0);
    expect(db.tables.cps_invitations.at(-1)?.status).toBe("suppressed");
  });
  it("suppresses when the recipient lookup fails", async () => {
    const db = memDb(world(), CFG);
    const d = deps(db);
    d.findUserIdByEmail = async () => { throw new Error("down"); };
    await createCpsInvite(d, W, { email: "a@x.org" });
    expect(d.sent).toHaveLength(0);
  });
});

async function invited(over: Partial<MemTables> = {}) {
  const db = memDb(world(over), CFG);
  const d = withPolicy(deps(db), { [S]: {} });
  await createCpsInvite(d, W, { email: "her@x.org", caseRef: "C1" });
  return { db, d, token: "tok00000000" };
}
const accept = (d: ReturnType<typeof deps>, token: string, over: Record<string, unknown> = {}) =>
  acceptCpsInvite(d, { token, survivorId: S, survivorEmail: "her@x.org", incidents: ["i1"], evidence: [], reauth: async () => true, ...over } as never);

describe("what she sees first", () => {
  it("shows who is asking and what was verified, without marking it opened", async () => {
    const { db, token } = await invited();
    const p = await peekCpsInvite(db, token, async (t) => `h:${t}`, NOW);
    expect(p).toMatchObject({ status: "ok", worker: { name: "Pat Worker", agency: "Example DCS" }, caseRef: "C1" });
    if (p.status === "ok") expect(p.worker.verification).toContain("dcs.example.gov");
    expect(JSON.stringify(db.tables.cps_invitations[0])).not.toContain("opened");
  });
  it("says nothing for a wrong, expired, declined or suppressed token, or a worker who lost approval", async () => {
    const h = async (t: string) => `h:${t}`;
    const { db, token } = await invited();
    expect((await peekCpsInvite(db, "nope", h, NOW)).status).toBe("not-found");
    expect((await peekCpsInvite(db, token, h, NOW + 20 * 86_400_000)).status).toBe("not-found");
    (db.tables.cps_access_applications[0] as Record<string, unknown>).suspended_at = iso(NOW);
    expect((await peekCpsInvite(db, token, h, NOW)).status).toBe("not-found");
    (db.tables.cps_access_applications[0] as Record<string, unknown>).suspended_at = null;
    db.tables.cps_invitations[0].status = "declined";
    expect((await peekCpsInvite(db, token, h, NOW)).status).toBe("not-found");
  });
});

describe("accepting", () => {
  it("creates an exact-scope grant with a default 30 day expiry that the worker can then use", async () => {
    const { db, d, token } = await invited();
    const r = await accept(d, token);
    expect(r.shared).toEqual({ incidents: 1, files: 0 });
    expect(Date.parse(r.expiresAt) - NOW).toBe(30 * 86_400_000);
    expect(db.tables.cps_invitations[0].status).toBe("accepted");
    const link = await assertCpsLink(db, W, S);
    expect(link.scope_incidents).toEqual(["i1"]);
  });
  it("clamps a long expiry to 90 days", async () => {
    const { d, token } = await invited();
    const r = await accept(d, token, { days: 999 });
    expect(Date.parse(r.expiresAt) - NOW).toBe(90 * 86_400_000);
  });
  it("needs her password, a pick, and the same email she was invited at", async () => {
    const { db, d, token } = await invited();
    await expect(accept(d, token, { reauth: async () => false })).rejects.toThrow(/password/);
    await expect(accept(d, token, { incidents: [], evidence: [] })).rejects.toThrow(/at least one/);
    await expect(accept(d, token, { survivorEmail: "other@x.org" })).rejects.toThrow(/different email/);
    expect(db.tables.cps_client_links).toHaveLength(0);
    expect(db.tables.cps_invitations[0].status).toBe("sent");
  });
  it("shares nothing if every pick was left out, and says why for the ones that were", async () => {
    const { db, d, token } = await invited();
    await expect(accept(d, token, { incidents: ["i2"] })).rejects.toThrow(/Nothing was shared/);
    expect(db.tables.cps_client_links).toHaveLength(0);
    const ok = await accept(d, token, { incidents: ["i1", "i2"] });
    expect(ok.excluded).toEqual([{ kind: "incident", id: "i2", reason: "marked private or still deciding" }]);
  });
  it("refuses when she has turned these requests off", async () => {
    const { db, d, token } = await invited();
    withPolicy(d, { [S]: { cps_invites: "block" } });
    await expect(accept(d, token)).rejects.toThrow(/turned off/);
    expect(db.tables.cps_client_links).toHaveLength(0);
  });
  it("refuses a worker who lost approval after inviting", async () => {
    const { db, d, token } = await invited();
    (db.tables.cps_access_applications[0] as Record<string, unknown>).status = "rejected";
    await expect(accept(d, token)).rejects.toThrow();
  });
  it("cannot be accepted twice", async () => {
    const { db, d, token } = await invited();
    await accept(d, token);
    await expect(accept(d, token)).rejects.toThrow(/no longer valid/);
    expect(db.tables.cps_client_links).toHaveLength(1);
  });
  it("puts the invitation back if the grant cannot be saved", async () => {
    const { db, d, token } = await invited();
    const broken = memDb(db.tables, { ...CFG, failWrites: { cps_client_links: { message: "down" } } });
    const d2 = { ...d, db: broken };
    await expect(accept(d2, token)).rejects.toThrow(/Nothing was shared/);
    expect(db.tables.cps_invitations[0].status).toBe("sent");
  });
});

describe("declining and ending access", () => {
  it("decline marks it declined and nothing else", async () => {
    const { db, token } = await invited();
    await declineCpsInvite(db, { token, survivorEmail: "her@x.org" }, async (t) => `h:${t}`);
    expect(db.tables.cps_invitations[0].status).toBe("declined");
    expect(db.tables.cps_client_links).toHaveLength(0);
  });
  it("only the right address can decline", async () => {
    const { db, token } = await invited();
    await declineCpsInvite(db, { token, survivorEmail: "other@x.org" }, async (t) => `h:${t}`);
    expect(db.tables.cps_invitations[0].status).toBe("sent");
  });
  it("revoking ends worker access at once, only for her own grant, and cannot be repeated", async () => {
    const { db, d, token } = await invited();
    const { linkId } = await accept(d, token);
    expect(await revokeCpsGrant(db, "someone-else", linkId, NOW)).toBe(false);
    await assertCpsLink(db, W, S);
    expect(await revokeCpsGrant(db, S, linkId, NOW)).toBe(true);
    await expect(assertCpsLink(db, W, S)).rejects.toThrow("No active access");
    expect(await revokeCpsGrant(db, S, linkId, NOW)).toBe(false);
  });
});

describe("reply timing", () => {
  it("holds a fast reply to the minimum and does not delay a slow one", async () => {
    const t0 = Date.now();
    await padToMinimum(t0, 120, 0);
    expect(Date.now() - t0 >= 110).toBe(true);
    const t1 = Date.now();
    await padToMinimum(t1 - 5000, 120, 0);
    expect(Date.now() - t1 < 50).toBe(true);
  });
});
