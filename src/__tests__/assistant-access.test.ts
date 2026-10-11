import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import {
  ASSISTANT_FLAG,
  RECENT_SIGN_IN_MS,
  acknowledgeConnections,
  disableAssistantAccess,
  enableAssistantAccess,
  isAssistantAccessOn,
  unseenConnections,
  type AccessAdmin,
} from "@/lib/assistant-access.server";

const U = "user-1";

function world(opts: { meta?: Record<string, unknown>; apps?: string[]; readFails?: boolean; revokeFails?: string[] } = {}) {
  const state = {
    meta: { ...(opts.meta ?? {}) } as Record<string, unknown>,
    apps: [...(opts.apps ?? [])],
    writes: 0,
  };
  const admin: AccessAdmin = {
    auth: {
      admin: {
        async getUserById() {
          if (opts.readFails) return { data: null, error: new Error("down") };
          return { data: { user: { app_metadata: { ...state.meta } } }, error: null };
        },
        async updateUserById(_id, attrs) {
          state.writes++;
          state.meta = { ...attrs.app_metadata };
          return { error: null };
        },
      },
    },
    async rpc(fn, args) {
      if (fn === "admin_list_oauth_consents") {
        return {
          data: state.apps.map((id) => ({ id, client_name: `app-${id}`, granted_at: "2026-10-01T00:00:00Z" })),
          error: null,
        };
      }
      if (fn === "admin_revoke_oauth_consent") {
        const id = String(args._consent_id);
        if (opts.revokeFails?.includes(id)) return { data: false, error: null };
        state.apps = state.apps.filter((a) => a !== id);
        return { data: true, error: null };
      }
      return { data: null, error: new Error("unknown rpc") };
    },
  };
  return { admin, state };
}

const withPassword = (ok: boolean) => ({
  hasPassword: true,
  lastSignInAt: null,
  checkPassword: async () => ok,
});

describe("assistant access is off unless she turns it on", () => {
  it("is off by default, and a failed read means off", async () => {
    expect(await isAssistantAccessOn(world().admin, U)).toBe(false);
    expect(await isAssistantAccessOn(world({ meta: { [ASSISTANT_FLAG]: true }, readFails: true }).admin, U)).toBe(false);
    // Only the exact value true counts.
    expect(await isAssistantAccessOn(world({ meta: { [ASSISTANT_FLAG]: "true" } }).admin, U)).toBe(false);
  });

  it("turning on needs her password", async () => {
    const w = world();
    expect(await enableAssistantAccess(w.admin, U, { check: withPassword(true) })).toEqual({
      ok: false,
      reason: "password_required",
    });
    expect(await enableAssistantAccess(w.admin, U, { password: "x", check: withPassword(false) })).toEqual({
      ok: false,
      reason: "wrong_password",
    });
    expect(w.state.writes).toBe(0);
    expect(await enableAssistantAccess(w.admin, U, { password: "right", check: withPassword(true) })).toEqual({ ok: true });
    expect(await isAssistantAccessOn(w.admin, U)).toBe(true);
  });

  it("with no password, a stale sign-in is not enough", async () => {
    const now = 10_000_000;
    const noPw = (age: number | null) => ({
      hasPassword: false,
      lastSignInAt: age === null ? null : now - age,
      checkPassword: async () => false,
    });
    for (const age of [null, RECENT_SIGN_IN_MS + 1]) {
      const w = world();
      expect(await enableAssistantAccess(w.admin, U, { check: noPw(age), now })).toEqual({ ok: false, reason: "sign_in_again" });
      expect(w.state.writes).toBe(0);
    }
    const w = world();
    expect(await enableAssistantAccess(w.admin, U, { check: noPw(60_000), now })).toEqual({ ok: true });
  });

  it("turning on keeps her other account settings", async () => {
    const w = world({ meta: { provider: "email", assistant_seen: ["a"] } });
    await enableAssistantAccess(w.admin, U, { password: "p", check: withPassword(true) });
    expect(w.state.meta).toMatchObject({ provider: "email", assistant_seen: ["a"], [ASSISTANT_FLAG]: true });
  });

  it("turning off needs nothing, switches off first, and disconnects every app", async () => {
    const w = world({ meta: { [ASSISTANT_FLAG]: true }, apps: ["a", "b", "c"] });
    const res = await disableAssistantAccess(w.admin, U);
    expect(res).toEqual({ revoked: 3, failed: 0 });
    expect(w.state.apps).toEqual([]);
    expect(await isAssistantAccessOn(w.admin, U)).toBe(false);
  });

  it("still switches off when an app can't be removed, and says so", async () => {
    const w = world({ meta: { [ASSISTANT_FLAG]: true }, apps: ["a", "b"], revokeFails: ["b"] });
    const res = await disableAssistantAccess(w.admin, U);
    expect(res).toEqual({ revoked: 1, failed: 1 });
    expect(await isAssistantAccessOn(w.admin, U)).toBe(false);
  });
});

describe("she is told about connections she hasn't seen", () => {
  it("lists new ones until she acknowledges", async () => {
    const w = world({ apps: ["a", "b"] });
    expect((await unseenConnections(w.admin, U)).map((a) => a.id)).toEqual(["a", "b"]);
    await acknowledgeConnections(w.admin, U);
    expect(await unseenConnections(w.admin, U)).toEqual([]);
    w.state.apps.push("c");
    expect((await unseenConnections(w.admin, U)).map((a) => a.id)).toEqual(["c"]);
  });
});

describe("the pieces are wired together", () => {
  const read = (p: string) => readFileSync(p, "utf8");

  it("every outside-assistant tool needs the switch, not just a sign-in", () => {
    for (const n of ["list-incidents", "list-evidence", "search", "create-incident"]) {
      const src = read(`src/lib/mcp/tools/${n}.ts`);
      expect(src).toMatch(/await requireAssistantAccess\(ctx\)/);
      expect(src).not.toMatch(/\brequireAuth\(ctx\)/);
    }
    expect(read("src/lib/mcp/supabase.ts")).toMatch(/isAssistantAccessOn/);
  });

  it("the consent screen blocks Approve until access is on and the password is entered", () => {
    const src = read("src/routes/[.]lovable.oauth.consent.tsx");
    expect(src).toMatch(/checkAssistantApproval/);
    expect(src).toMatch(/disabled=\{busy \|\| !access\?\.on/);
    expect(src).toMatch(/Enter your account password to approve/);
  });

  it("a password change switches assistants off and disconnects apps", () => {
    expect(read("src/components/ChangePasswordCard.tsx")).toMatch(/afterPasswordChange\(\)/);
    expect(read("src/routes/reset-password.tsx")).toMatch(/afterPasswordChange\(\)/);
  });

  it("she sees a notice for new connections on every signed-in screen", () => {
    expect(read("src/components/AppShell.tsx")).toMatch(/<NewConnectionNotice \/>/);
  });

  it("turning it off in Settings is one tap with no password", () => {
    const src = read("src/routes/_authenticated/settings.tsx");
    expect(src).toMatch(/Turn off and disconnect everything/);
    expect(src).toMatch(/turnOffAssistantAccess\(\)/);
  });
});
