import { describe, expect, it } from "vitest";
import { INTAKE_ATTEMPTS, safeName, uploadAndPreserve, type IntakeDeps, type IngestItem } from "@/lib/evidence-intake";
import { findExistingIngest, ownsIncident } from "@/lib/evidence-ingest.helpers";
import { makeRwAdmin } from "./helpers/fake-rw-supabase";

const USER = "user-1";
const file = { name: "photo (1).jpg", type: "image/jpeg", size: 3, blob: new Blob([new Uint8Array([1, 2, 3])]) };

/** A stand-in for storage + the server's ingest, with the same idempotency the server has. */
function world(over: {
  uploadErrors?: Array<{ message: string; statusCode?: string } | "throw">;
  ingestPlan?: Array<"throw" | { evidence_id: null; status: "failed"; message: string } | "ok">;
  removeFails?: boolean;
} = {}) {
  const stored = new Set<string>();
  const records = new Map<string, string>(); // key -> evidence id
  const calls = { uploads: 0, ingests: 0, removes: [] as string[][], keys: [] as string[] };
  let u = 0;
  let g = 0;
  const deps: IntakeDeps = {
    async upload(key) {
      calls.uploads++;
      const planned = over.uploadErrors?.[u++];
      if (planned === "throw") throw new Error("network down");
      if (planned) return { error: planned };
      if (stored.has(key)) return { error: { message: "The resource already exists", statusCode: "409" } };
      stored.add(key);
      return { error: null };
    },
    async remove(keys) {
      calls.removes.push(keys);
      if (over.removeFails) throw new Error("cannot delete");
      keys.forEach((k) => stored.delete(k));
    },
    async ingest(f) {
      calls.ingests++;
      const step = over.ingestPlan?.[g++] ?? "ok";
      // The server may record the file, then fail to answer.
      if (step === "throw") {
        if (!records.has(f.storage_key)) records.set(f.storage_key, `ev-${records.size + 1}`);
        throw new Error("timeout");
      }
      if (step !== "ok") return { items: [step as IngestItem] };
      const existing = records.get(f.storage_key);
      if (existing) return { items: [{ evidence_id: existing, status: "preserved", message: "Already saved. Nothing was duplicated." }] };
      const id = `ev-${records.size + 1}`;
      records.set(f.storage_key, id);
      return { items: [{ evidence_id: id, status: "preserved" }] };
    },
    async sleep() {},
    newKey: (userId, name) => {
      const k = `${userId}/${calls.keys.length}-${name}`;
      calls.keys.push(k);
      return k;
    },
  };
  return { deps, stored, records, calls };
}

describe("a normal upload", () => {
  it("returns success only with a server-confirmed record, and names the file safely", async () => {
    const w = world();
    const r = await uploadAndPreserve(w.deps, { userId: USER, file });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.evidenceId).toBe("ev-1");
      expect(r.storageKey).toMatch(/^user-1\//);
      expect(r.storageKey).not.toMatch(/[ ()]/);
    }
    expect(w.records.size).toBe(1);
    expect(safeName("a b/c?.png")).toBe("a_b_c_.png");
  });
});

describe("upload failures", () => {
  it("retries a flaky upload, then succeeds with one record", async () => {
    const w = world({ uploadErrors: [{ message: "fetch failed" }, "throw"] });
    const r = await uploadAndPreserve(w.deps, { userId: USER, file });
    expect(r.ok).toBe(true);
    expect(w.calls.uploads).toBe(3);
    expect(w.records.size).toBe(1);
  });

  it("says nothing was saved when the upload never works, and makes no record", async () => {
    const w = world({ uploadErrors: Array(INTAKE_ATTEMPTS).fill({ message: "fetch failed" }) });
    const r = await uploadAndPreserve(w.deps, { userId: USER, file });
    expect(r).toMatchObject({ ok: false, stage: "upload", cleanedUp: false });
    if (!r.ok) expect(r.message).toMatch(/Nothing was saved/);
    expect(w.records.size).toBe(0);
    expect(w.calls.ingests).toBe(0);
  });

  it("treats 'already exists' on a retry as success: the earlier attempt landed", async () => {
    const w = world();
    const first = await uploadAndPreserve(w.deps, { userId: USER, file });
    if (!first.ok) throw new Error("setup");
    const again = await uploadAndPreserve(w.deps, { userId: USER, file, resumeKey: first.storageKey });
    expect(again.ok).toBe(true);
    expect(w.records.size).toBe(1);
  });
});

describe("the server's answer is lost", () => {
  it("a retry reuses the same file name and never makes a second record", async () => {
    const w = world({ ingestPlan: ["throw", "ok"] });
    const r = await uploadAndPreserve(w.deps, { userId: USER, file });
    expect(r.ok).toBe(true);
    expect(w.records.size).toBe(1);
    expect(w.calls.keys).toHaveLength(1);
    if (r.ok) expect(r.alreadySaved).toBe(true);
  });

  it("if it never answers, the upload is kept (the record may exist) and the outcome is called unconfirmed", async () => {
    const w = world({ ingestPlan: Array(INTAKE_ATTEMPTS).fill("throw") });
    const r = await uploadAndPreserve(w.deps, { userId: USER, file });
    expect(r).toMatchObject({ ok: false, stage: "unconfirmed", cleanedUp: false });
    expect(w.calls.removes).toEqual([]);
    expect(w.stored.size).toBe(1);
    if (!r.ok) {
      expect(r.message).toMatch(/couldn't confirm/);
      expect(r.message).toMatch(/won't be duplicated|it won't be duplicated/);
      // Trying again with the same key is safe and completes.
      w.deps.ingest = (async (f) => ({ items: [{ evidence_id: w.records.get(f.storage_key) ?? "ev-x", status: "preserved" }] })) as IntakeDeps["ingest"];
      const retry = await uploadAndPreserve(w.deps, { userId: USER, file, resumeKey: r.storageKey });
      expect(retry.ok).toBe(true);
      expect(w.records.size).toBe(1);
    }
  });
});

describe("when the server says it could not record the file", () => {
  const refuse = { evidence_id: null, status: "failed" as const, message: "Preserved the file, but could not record it." };

  it("removes the orphaned upload and says nothing was saved", async () => {
    const w = world({ ingestPlan: Array(INTAKE_ATTEMPTS).fill(refuse) });
    const r = await uploadAndPreserve(w.deps, { userId: USER, file });
    expect(r).toMatchObject({ ok: false, stage: "record", cleanedUp: true });
    expect(w.stored.size).toBe(0);
    expect(w.records.size).toBe(0);
    if (!r.ok) expect(r.message).toMatch(/Nothing was saved\./);
  });

  it("admits it when the orphan could not be removed", async () => {
    const w = world({ ingestPlan: Array(INTAKE_ATTEMPTS).fill(refuse), removeFails: true });
    const r = await uploadAndPreserve(w.deps, { userId: USER, file });
    expect(r).toMatchObject({ ok: false, stage: "record", cleanedUp: false });
    if (!r.ok) expect(r.message).toMatch(/couldn't be cleaned up/);
  });

  it("does not retry a refusal that can't change (an entry that isn't hers)", async () => {
    const w = world({ ingestPlan: [{ evidence_id: null, status: "failed", message: "That entry isn't on your account, so the file was not attached." }] });
    const r = await uploadAndPreserve(w.deps, { userId: USER, file, linkedIncidentId: "not-mine" });
    expect(w.calls.ingests).toBe(1);
    expect(r).toMatchObject({ ok: false, stage: "record", cleanedUp: true });
  });
});

describe("the server's idempotency and ownership checks", () => {
  it("hands back the record that already exists for a stored file instead of making another", async () => {
    const admin = makeRwAdmin({
      evidence: [
        { id: "e1", user_id: USER, file_url: "user-1/a.jpg", deleted_at: null, sha256: "h", bytes: 3, mime: "image/jpeg", preservation_status: "preserved", family_id: null },
        { id: "e2", user_id: "other", file_url: "user-1/b.jpg", deleted_at: null },
        { id: "e3", user_id: USER, file_url: "user-1/c.jpg", deleted_at: "2026-01-01" },
      ],
    });
    expect((await findExistingIngest(admin, USER, "user-1/a.jpg"))?.id).toBe("e1");
    expect(await findExistingIngest(admin, USER, "user-1/b.jpg")).toBeNull(); // not hers
    expect(await findExistingIngest(admin, USER, "user-1/c.jpg")).toBeNull(); // deleted
    expect(await findExistingIngest(admin, USER, "user-1/none.jpg")).toBeNull();
  });

  it("a failed read is an error, not 'no record yet' (which would make a duplicate)", async () => {
    const admin = makeRwAdmin({});
    admin.from = (() => ({
      select: () => ({ eq: () => ({ eq: () => ({ is: () => ({ maybeSingle: async () => ({ data: null, error: { message: "down" } }) }) }) }) }),
    })) as never;
    await expect(findExistingIngest(admin, USER, "k")).rejects.toThrow(/Could not check/);
  });

  it("only her own live entries can be attached to", async () => {
    const admin = makeRwAdmin({
      incidents: [
        { id: "i1", user_id: USER, deleted_at: null },
        { id: "i2", user_id: "other", deleted_at: null },
        { id: "i3", user_id: USER, deleted_at: "2026-01-01" },
      ],
    });
    expect(await ownsIncident(admin, USER, "i1")).toBe(true);
    expect(await ownsIncident(admin, USER, "i2")).toBe(false);
    expect(await ownsIncident(admin, USER, "i3")).toBe(false);
  });
});
