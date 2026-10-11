import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeRwAdmin } from "./helpers/fake-rw-supabase";

const state = vi.hoisted(() => ({ admin: null as any, actor: "founder", notify: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return state.admin;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireAccountAuth: {} }));
vi.mock("@/lib/signup-notify.server", () => ({ notifyNewSignup: state.notify }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (fn: any) => () => fn({ context: { userId: state.actor } }),
    };
    return builder;
  },
}));
import { retrySignupAlerts } from "@/lib/founder-operations.functions";

beforeEach(() => {
  state.actor = "founder";
  state.notify.mockReset().mockResolvedValue(true);
  state.admin = makeRwAdmin({
    user_roles: [
      { user_id: "founder", role: "admin" },
      { user_id: "survivor", role: "survivor" },
    ],
    signup_alert_outbox: [
      { user_id: "signup", role: "survivor", completed_at: null, next_attempt_at: "2020-01-01" },
      {
        user_id: "delivered",
        role: "attorney",
        completed_at: "2026-01-01",
        next_attempt_at: "2020-01-01",
      },
      { user_id: "leased", role: "attorney", completed_at: null, next_attempt_at: "2099-01-01" },
    ],
  });
});
describe("founder signup alert retry", () => {
  it("denies a survivor before querying or submitting alerts", async () => {
    state.actor = "survivor";
    await expect(retrySignupAlerts()).rejects.toThrow("Not authorized");
    expect(state.notify).not.toHaveBeenCalled();
    expect(state.admin.selects.some((s: any) => s.table === "signup_alert_outbox")).toBe(false);
  });
  it("submits only pending eligible alerts and never queues old accounts", async () => {
    expect(await retrySignupAlerts()).toEqual({ attempted: 1, submitted: 1 });
    expect(state.notify).toHaveBeenCalledExactlyOnceWith({
      userId: "signup",
      role: "survivor",
      retryOnly: true,
    });
  });
  it("reports submission failures accurately", async () => {
    state.notify.mockResolvedValue(false);
    expect(await retrySignupAlerts()).toEqual({ attempted: 1, submitted: 0 });
  });
});
