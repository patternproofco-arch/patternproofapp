import { beforeEach, describe, expect, it, vi } from "vitest";

// Fictional accounts only.
const h = vi.hoisted(() => {
  const state = {
    authUser: null as any,
    profile: null as any, // existing attorney_profiles row (trial lookup)
    nonCompedTrials: 0,
    updates: [] as Array<{ payload: any; filters: Record<string, unknown> }>,
    upserts: [] as any[],
    rpcs: [] as Array<{ fn: string; args: any }>,
    updateRows: [{ user_id: "u" }] as any[],
  };
  function builder(table: string) {
    let op = "select";
    let payload: any = null;
    let head = false;
    const filters: Record<string, unknown> = {};
    const result = () => {
      if (table === "user_roles") return { data: { role: "attorney" }, error: null };
      if (op === "upsert") return { data: null, error: null };
      if (op === "update") {
        state.updates.push({ payload, filters: { ...filters } });
        return { data: state.updateRows, error: null };
      }
      if (head) return { data: null, count: state.nonCompedTrials, error: null };
      return { data: state.profile, error: null };
    };
    const b: any = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then")
            return (res: any, rej: any) => Promise.resolve(result()).then(res, rej);
          if (prop === "maybeSingle" || prop === "single") return async () => result();
          return (...args: any[]) => {
            if (prop === "upsert") {
              op = "upsert";
              state.upserts.push(args[0]);
            }
            if (prop === "update") {
              op = "update";
              payload = args[0];
            }
            if (prop === "select" && args[1]?.head) head = true;
            if (prop === "eq" || prop === "is") filters[`${String(prop)}:${args[0]}`] = args[1];
            return b;
          };
        },
      },
    );
    return b;
  }
  const supabaseAdmin = {
    from: (t: string) => builder(t),
    rpc: async (fn: string, args: any) => {
      state.rpcs.push({ fn, args });
      return { data: null, error: null };
    },
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: state.authUser },
          error: state.authUser ? null : { message: "not found" },
        }),
      },
    },
  };
  return { state, supabaseAdmin };
});

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate: (x: any) => any = (x) => x;
    const b: any = {
      middleware: () => b,
      inputValidator: (fn: any) => ((validate = fn), b),
      handler: (fn: any) => (opts?: { data?: any }) =>
        fn({ data: validate(opts?.data), context: { userId: "attorney-1" } }),
    };
    return b;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: {},
  requireAccountAuth: {},
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: h.supabaseAdmin }));
vi.mock("@/lib/payments.functions", () => ({ isAttorneyEntitled: vi.fn() }));
vi.mock("@/lib/professional-links.server", () => ({ PROFESSIONAL_LINK_TTL_SECONDS: 60 }));
vi.mock("@/lib/attorney-access.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/attorney-access.server")>()),
  assertAttorney: async () => undefined,
}));

import { completeAttorneyOnboarding, upsertAttorneyProfile } from "@/lib/attorney-portal.functions";

const form = (email: string) => ({
  data: {
    full_name: "Fictional Attorney",
    email,
    role: "solo" as const,
    confidentiality_accepted: true as const,
  },
});
const trialWrites = () => h.state.updates.filter((u) => "trial_ends_at" in u.payload);

beforeEach(() => {
  h.state.authUser = null;
  h.state.profile = null;
  h.state.nonCompedTrials = 9; // founding nine already taken
  h.state.updates = [];
  h.state.upserts = [];
  h.state.rpcs = [];
  h.state.updateRows = [{ user_id: "attorney-1" }];
});

describe("attorney onboarding comp uses the verified auth email", () => {
  it("does NOT comp when only the typed form email is @patternproof.test", async () => {
    h.state.authUser = {
      email: "real-person@example.invalid",
      email_confirmed_at: "2026-10-11T00:00:00Z",
    };
    const res = await completeAttorneyOnboarding(form("anything@patternproof.test"));
    expect(trialWrites()).toHaveLength(0);
    expect(res.trial_ends_at).toBeNull();
    expect(h.state.rpcs).toHaveLength(0);
  });

  it("refuses onboarding (no profile, no trial) for an unconfirmed auth email", async () => {
    h.state.authUser = { email: "seed-attorney-a@patternproof.test", email_confirmed_at: null };
    await expect(
      completeAttorneyOnboarding(form("seed-attorney-a@patternproof.test")),
    ).rejects.toThrow(/Confirm your account email/);
    expect(h.state.upserts).toHaveLength(0);
    expect(trialWrites()).toHaveLength(0);
  });

  it("refuses onboarding when the auth lookup fails", async () => {
    h.state.authUser = null;
    await expect(
      completeAttorneyOnboarding(form("seed-attorney-a@patternproof.test")),
    ).rejects.toThrow(/Confirm your account email/);
    expect(h.state.upserts).toHaveLength(0);
    expect(trialWrites()).toHaveLength(0);
  });

  it("writes the confirmed auth email to the profile, never the typed one", async () => {
    h.state.authUser = {
      email: "Real-Person@Example.invalid",
      email_confirmed_at: "2026-10-11T00:00:00Z",
    };
    await completeAttorneyOnboarding(form("someone-else@example.invalid"));
    expect(h.state.upserts).toHaveLength(1);
    expect(h.state.upserts[0].email).toBe("real-person@example.invalid");
  });

  it("comps a confirmed @patternproof.test auth email even if the form says otherwise, server-side, once, with an audit event", async () => {
    h.state.authUser = {
      email: "Seed-Attorney-A@PatternProof.test",
      email_confirmed_at: "2026-10-11T00:00:00Z",
    };
    const res = await completeAttorneyOnboarding(form("typed@example.invalid"));
    const writes = trialWrites();
    expect(writes).toHaveLength(1);
    expect(writes[0].payload.trial_comped).toBe(true);
    expect(writes[0].filters).toMatchObject({
      "eq:user_id": "attorney-1",
      "is:trial_ends_at": null,
    });
    expect(res.trial_ends_at).toBe(writes[0].payload.trial_ends_at);
    expect(h.state.rpcs).toEqual([
      expect.objectContaining({
        fn: "record_audit_event",
        args: expect.objectContaining({
          p_user_id: "attorney-1",
          p_event_type: "attorney_trial_started",
          p_actor_kind: "system",
          p_meta: expect.objectContaining({ source: "onboarding", comped: true }),
        }),
      }),
    ]);
  });

  it("founding-nine trial (not comped) still works for a real attorney while spots remain", async () => {
    h.state.authUser = {
      email: "real-person@example.invalid",
      email_confirmed_at: "2026-10-11T00:00:00Z",
    };
    h.state.nonCompedTrials = 3;
    await completeAttorneyOnboarding(form("real-person@example.invalid"));
    expect(trialWrites()).toHaveLength(1);
    expect(trialWrites()[0].payload.trial_comped).toBe(false);
  });

  it("never re-grants when a trial already exists", async () => {
    h.state.authUser = {
      email: "seed-attorney-a@patternproof.test",
      email_confirmed_at: "2026-10-11T00:00:00Z",
    };
    h.state.profile = { trial_ends_at: "2026-12-01T00:00:00Z" };
    const res = await completeAttorneyOnboarding(form("seed-attorney-a@patternproof.test"));
    expect(trialWrites()).toHaveLength(0);
    expect(res.trial_ends_at).toBe("2026-12-01T00:00:00Z");
  });

  it("a concurrent call that loses the race writes no audit event", async () => {
    h.state.authUser = {
      email: "seed-attorney-a@patternproof.test",
      email_confirmed_at: "2026-10-11T00:00:00Z",
    };
    h.state.updateRows = []; // conditional update matched nothing
    await completeAttorneyOnboarding(form("seed-attorney-a@patternproof.test"));
    expect(h.state.rpcs).toHaveLength(0);
  });
});

describe("attorney profile edit uses the verified auth email", () => {
  it("ignores the form email and writes the confirmed auth email", async () => {
    h.state.authUser = {
      email: "seed-attorney-a@patternproof.test",
      email_confirmed_at: "2026-10-11T00:00:00Z",
    };
    await upsertAttorneyProfile({
      data: { full_name: "Fictional Attorney", email: "spoofed@example.invalid" },
    });
    expect(h.state.upserts).toHaveLength(1);
    expect(h.state.upserts[0]).toMatchObject({
      user_id: "attorney-1",
      email: "seed-attorney-a@patternproof.test",
    });
    expect(JSON.stringify(h.state.upserts[0])).not.toContain("spoofed");
    expect(h.state.upserts[0]).not.toHaveProperty("trial_ends_at");
  });

  it("works without any email in the payload (form no longer sends one)", async () => {
    h.state.authUser = {
      email: "seed-attorney-a@patternproof.test",
      email_confirmed_at: "2026-10-11T00:00:00Z",
    };
    await upsertAttorneyProfile({ data: { full_name: "Fictional Attorney" } });
    expect(h.state.upserts[0].email).toBe("seed-attorney-a@patternproof.test");
  });

  it("refuses when the account email is unconfirmed", async () => {
    h.state.authUser = { email: "seed-attorney-a@patternproof.test", email_confirmed_at: null };
    await expect(upsertAttorneyProfile({ data: { full_name: "X" } })).rejects.toThrow(
      /Confirm your account email/,
    );
    expect(h.state.upserts).toHaveLength(0);
  });
});
