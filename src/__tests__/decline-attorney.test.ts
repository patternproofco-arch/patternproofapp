import { describe, expect, it, vi } from "vitest";
import { declineAttorneyApplication, type DeclineDb } from "@/lib/decline-attorney";

const ID = "11111111-1111-4111-8111-111111111111";
const ADMIN = "22222222-2222-4222-8222-222222222222";

function fakeDb(
  opts: {
    app?: unknown;
    lookupError?: unknown;
    rpcError?: Record<string, unknown>;
    stampError?: unknown;
    stampThrows?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const updates: unknown[] = [];
  const db: DeclineDb = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: "app" in opts ? opts.app : { id: ID, email: "a@firm.test", full_name: "Ann" },
            error: opts.lookupError ?? null,
          }),
        }),
      }),
      update: (patch: unknown) => {
        updates.push(patch);
        return {
          eq: async () => {
            if (opts.stampThrows) throw new Error("Timestamp write interrupted");
            return { error: opts.stampError ?? null };
          },
        };
      },
    }),
    rpc: async (fn: string) => {
      calls.push(fn);
      return { error: opts.rpcError?.[fn] ?? null };
    },
  };
  return { db, calls, updates };
}

const base = { id: ID, reviewer: ADMIN };

describe("declineAttorneyApplication", () => {
  it("saves decline and reason in ONE atomic call, with no separate reason update", async () => {
    const { db, calls, updates } = fakeDb();
    const r = await declineAttorneyApplication({
      ...base,
      db,
      reason: " Bar number not found ",
      sendEmail: false,
      sendEmailFn: vi.fn(),
    });
    expect(calls).toEqual(["decline_attorney_application"]);
    expect(updates).toEqual([]);
    expect(r).toEqual({ ok: true, emailed: false, emailProblem: false });
  });

  it("if the atomic call fails, nothing is changed and the error says so", async () => {
    const { db, calls, updates } = fakeDb({
      rpcError: { decline_attorney_application: { message: "boom" } },
    });
    const send = vi.fn();
    await expect(
      declineAttorneyApplication({ ...base, db, reason: "x", sendEmail: true, sendEmailFn: send }),
    ).rejects.toThrow(/Nothing was changed/);
    expect(calls).toEqual(["decline_attorney_application"]);
    expect(updates).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });

  it("never falls back to a plain decline when the reason function is missing", async () => {
    const { db, calls } = fakeDb({
      rpcError: { decline_attorney_application: { code: "PGRST202" } },
    });
    await expect(
      declineAttorneyApplication({
        ...base,
        db,
        reason: "x",
        sendEmail: false,
        sendEmailFn: vi.fn(),
      }),
    ).rejects.toThrow();
    expect(calls).not.toContain("review_attorney_application");
  });

  it("a decline with no reason uses the existing function and needs no new columns", async () => {
    const { db, calls } = fakeDb();
    await declineAttorneyApplication({
      ...base,
      db,
      reason: "  ",
      sendEmail: false,
      sendEmailFn: vi.fn(),
    });
    expect(calls).toEqual(["review_attorney_application"]);
  });

  it("refuses to email without a reason, before changing anything", async () => {
    const { db, calls } = fakeDb();
    await expect(
      declineAttorneyApplication({
        ...base,
        db,
        reason: "",
        sendEmail: true,
        sendEmailFn: vi.fn(),
      }),
    ).rejects.toThrow(/reason before/);
    expect(calls).toEqual([]);
  });

  it("an unknown application changes nothing", async () => {
    const { db, calls } = fakeDb({ app: null });
    await expect(
      declineAttorneyApplication({
        ...base,
        db,
        reason: "x",
        sendEmail: false,
        sendEmailFn: vi.fn(),
      }),
    ).rejects.toThrow(/Could not find/);
    expect(calls).toEqual([]);
  });

  it("emails only after the decline is saved, and records that it was sent", async () => {
    const { db, calls, updates } = fakeDb();
    const send = vi.fn(async () => {
      expect(calls).toEqual(["decline_attorney_application"]);
      return { sent: true };
    });
    const r = await declineAttorneyApplication({
      ...base,
      db,
      reason: "Please resubmit",
      sendEmail: true,
      sendEmailFn: send,
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(r.emailed).toBe(true);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toHaveProperty("decline_reason_emailed_at");
  });

  it("an email failure keeps the decline and is reported, not thrown", async () => {
    const { db, updates } = fakeDb();
    const r = await declineAttorneyApplication({
      ...base,
      db,
      reason: "x",
      sendEmail: true,
      sendEmailFn: async () => {
        throw new Error("smtp down");
      },
    });
    expect(r).toEqual({ ok: true, emailed: false, emailProblem: true });
    expect(updates).toEqual([]);
  });

  it("an email that was not sent is reported and not recorded as sent", async () => {
    const { db, updates } = fakeDb();
    const r = await declineAttorneyApplication({
      ...base,
      db,
      reason: "x",
      sendEmail: true,
      sendEmailFn: async () => ({ sent: false }),
    });
    expect(r.emailed).toBe(false);
    expect(r.emailProblem).toBe(true);
    expect(updates).toEqual([]);
  });

  it.each([{ stampError: { message: "Timestamp write failed" } }, { stampThrows: true }])(
    "keeps the sent result when its timestamp cannot be saved: %j",
    async (failure) => {
      const { db, calls, updates } = fakeDb(failure);
      const send = vi.fn(async () => ({ sent: true }));
      const result = await declineAttorneyApplication({
        ...base,
        db,
        reason: "Fictional review reason",
        sendEmail: true,
        sendEmailFn: send,
      });
      expect(result).toEqual({ ok: true, emailed: true, emailProblem: true });
      expect(calls).toEqual(["decline_attorney_application"]);
      expect(send).toHaveBeenCalledTimes(1);
      expect(updates).toHaveLength(1);
    },
  );
});
