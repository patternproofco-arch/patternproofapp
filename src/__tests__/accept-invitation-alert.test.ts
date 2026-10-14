import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeRwAdmin } from "./helpers/fake-rw-supabase";

const state = vi.hoisted(() => ({
  admin: null as any,
  accept: null as any,
  notify: null as any,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return state.admin;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: {},
  requireAccountAuth: {},
}));
vi.mock("@/lib/attorney-portal-auth", () => ({ requireAttorneyPortalAuth: {} }));
vi.mock("@/lib/attorney-approval.server", () => ({
  assertApprovedAttorney: vi.fn(async () => undefined),
}));
vi.mock("@/lib/invitation-scope.server", () => ({
  scopeForAcceptance: vi.fn(async () => ({ scope_incidents: [], scope_evidence: [] })),
}));
vi.mock("@/lib/attorney-share.server", () => ({
  acceptAttorneyShare: (...a: unknown[]) => state.accept(...a),
}));
vi.mock("@/lib/signup-notify.server", () => ({
  notifyNewSignup: (...a: unknown[]) => state.notify(...a),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (fn: any) => (args: any) => fn({ ...args, context: { userId: "atty" } }),
    };
    return builder;
  },
}));
import { acceptInvitation } from "@/lib/attorney-invitations.functions";

function setup(roles: string[]) {
  state.admin = makeRwAdmin({
    attorney_invitations: [
      {
        id: "inv",
        invite_token: "token-123456",
        status: "pending",
        expires_at: null,
        attorney_email: "atty@example.invalid",
        client_user_id: "surv",
      },
    ],
    user_roles: roles.map((role) => ({ user_id: "atty", role })),
  });
  state.admin.auth = {
    admin: {
      getUserById: async () => ({
        data: { user: { email: "atty@example.invalid", email_confirmed_at: "2026-01-01" } },
        error: null,
      }),
    },
  };
  state.notify = vi.fn(async () => true);
}
const run = () => (acceptInvitation as any)({ data: { token: "token-123456" } });

describe("acceptInvitation founder signup alert", () => {
  beforeEach(() => setup([]));
  it("a failed accept sends no alert and adds no attorney role", async () => {
    state.accept = vi.fn(async () => {
      throw new Error("permission denied for table users");
    });
    await expect(run()).rejects.toThrow("permission denied");
    expect(state.notify).not.toHaveBeenCalled();
    const { data } = await state.admin.from("user_roles").select("role").eq("user_id", "atty");
    expect(data ?? []).toEqual([]);
  });
  it("a successful accept by a new attorney sends exactly one alert", async () => {
    state.accept = vi.fn(async () => ({ id: "link", client_user_id: "surv" }));
    await expect(run()).resolves.toMatchObject({ ok: true });
    expect(state.notify).toHaveBeenCalledTimes(1);
    expect(state.notify).toHaveBeenCalledWith({ userId: "atty", role: "attorney" });
  });
  it("an existing attorney accepting sends no new-signup alert", async () => {
    setup(["attorney"]);
    state.accept = vi.fn(async () => ({ id: "link", client_user_id: "surv" }));
    await expect(run()).resolves.toMatchObject({ ok: true });
    expect(state.notify).not.toHaveBeenCalled();
  });
});
