import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ roles: [] as string[], notify: vi.fn(), upsert: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      handler: (fn: any) => () => fn({ context: { userId: "qa-user" } }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireAccountAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: () => ({
        eq: () =>
          table === "user_roles"
            ? Promise.resolve({ data: mocks.roles.map((role) => ({ role })), error: null })
            : { maybeSingle: async () => ({ data: { status: "approved" }, error: null }) },
      }),
      upsert: mocks.upsert,
    }),
  },
}));
vi.mock("@/lib/signup-notify.server", () => ({ notifyNewSignup: mocks.notify }));
import { ensureSurvivorRole } from "@/lib/roles.functions";
describe("signup alert retries during authenticated role checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.roles = [];
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.notify.mockResolvedValue(true);
  });
  it("retries a failed alert after the survivor role has been saved", async () => {
    mocks.notify.mockResolvedValueOnce(false);
    expect((await ensureSurvivorRole()).created).toBe(true);
    mocks.roles = ["survivor"];
    expect((await ensureSurvivorRole()).created).toBe(false);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.notify).toHaveBeenCalledTimes(2);
    expect(mocks.notify).toHaveBeenLastCalledWith({
      userId: "qa-user",
      role: "survivor",
      retryOnly: true,
    });
  });
  it("checks an existing attorney's alert without adding a survivor role", async () => {
    mocks.roles = ["attorney"];
    expect((await ensureSurvivorRole()).roles).toEqual(["attorney"]);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenCalledWith({
      userId: "qa-user",
      role: "attorney",
      retryOnly: true,
    });
  });
  it("does not generate administrative role signup alerts", async () => {
    mocks.roles = ["admin"];
    await ensureSurvivorRole();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});
