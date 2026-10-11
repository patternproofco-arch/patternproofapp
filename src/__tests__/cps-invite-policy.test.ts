import { describe, expect, it } from "vitest";
import {
  allowCpsInvites,
  blockCpsInvites,
  getCpsInvitePolicy,
  shouldDeliverCpsInvite,
} from "@/lib/cps-invite-policy.server";
import type { AccessAdmin } from "@/lib/assistant-access.server";

function admin(meta: Record<string, unknown> | null, opts: { failRead?: boolean } = {}) {
  const state = { meta: meta ? { ...meta } : null };
  const a: AccessAdmin = {
    auth: {
      admin: {
        async getUserById() {
          if (opts.failRead) return { data: null, error: { message: "down" } };
          return { data: state.meta ? { user: { app_metadata: state.meta } } : { user: null }, error: null };
        },
        async updateUserById(_id, attrs) {
          state.meta = attrs.app_metadata;
          return { error: null };
        },
      },
    },
    async rpc() {
      return { data: null, error: null };
    },
  };
  return { a, state };
}
const pw = (ok: boolean) => ({ hasPassword: true, lastSignInAt: null, checkPassword: async () => ok });

describe("cps invitation switch", () => {
  it("defaults to ask, blocks on 'block', and fails closed on any read problem", async () => {
    expect(await getCpsInvitePolicy(admin({}).a, "u")).toBe("ask");
    expect(await getCpsInvitePolicy(admin({ cps_invites: "block" }).a, "u")).toBe("block");
    expect(await getCpsInvitePolicy(admin({ cps_invites: "weird" }).a, "u")).toBe("block");
    expect(await getCpsInvitePolicy(admin(null).a, "u")).toBe("block");
    expect(await getCpsInvitePolicy(admin({}, { failRead: true }).a, "u")).toBe("block");
  });
  it("blocking is one tap; unblocking needs her password or a very recent sign-in", async () => {
    const { a, state } = admin({});
    await blockCpsInvites(a, "u");
    expect(state.meta?.cps_invites).toBe("block");
    expect(await allowCpsInvites(a, "u", { check: pw(true) })).toEqual({ ok: false, reason: "password_required" });
    expect(await allowCpsInvites(a, "u", { password: "x", check: pw(false) })).toEqual({
      ok: false,
      reason: "wrong_password",
    });
    expect(state.meta?.cps_invites).toBe("block");
    expect(await allowCpsInvites(a, "u", { password: "x", check: pw(true) })).toEqual({ ok: true });
    expect(state.meta?.cps_invites).toBe("ask");
  });
  it("without a password, only a very recent sign-in can unblock", async () => {
    const { a } = admin({ cps_invites: "block" });
    const now = Date.now();
    const stale = { hasPassword: false, lastSignInAt: now - 3_600_000, checkPassword: async () => false };
    const fresh = { hasPassword: false, lastSignInAt: now - 60_000, checkPassword: async () => false };
    expect(await allowCpsInvites(a, "u", { check: stale, now })).toEqual({ ok: false, reason: "sign_in_again" });
    expect(await allowCpsInvites(a, "u", { check: fresh, now })).toEqual({ ok: true });
  });
});

describe("whether the invitation email goes out", () => {
  it("sends to an address with no account, and to an account that asks", async () => {
    expect(await shouldDeliverCpsInvite(admin({}).a, "New@x.org", async () => null)).toBe(true);
    expect(await shouldDeliverCpsInvite(admin({}).a, "a@x.org", async () => "u")).toBe(true);
  });
  it("suppresses for a blocked account, an unreadable setting, or a failed lookup", async () => {
    expect(await shouldDeliverCpsInvite(admin({ cps_invites: "block" }).a, "a@x.org", async () => "u")).toBe(false);
    expect(await shouldDeliverCpsInvite(admin({}, { failRead: true }).a, "a@x.org", async () => "u")).toBe(false);
    expect(
      await shouldDeliverCpsInvite(admin({}).a, "a@x.org", async () => {
        throw new Error("down");
      }),
    ).toBe(false);
  });
  it("looks the address up lowercased", async () => {
    let seen = "";
    await shouldDeliverCpsInvite(admin({}).a, "  MiXed@X.org ", async (e) => ((seen = e), null));
    expect(seen).toBe("mixed@x.org");
  });
});
