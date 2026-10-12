import { beforeEach, describe, expect, it, vi } from "vitest";

// Fictional accounts only. The profile tables hold a STALE / spoofed email; auth holds the truth.
const SURVIVOR = "5eed0000-0000-4000-8000-0000000000aa";
const ATTORNEY = "5eed0000-0000-4000-8000-0000000a7701";
const ADVOCATE = "5eed0000-0000-4000-8000-0000000ad001";
const UNCONFIRMED = "5eed0000-0000-4000-8000-0000000ad002";

const h = vi.hoisted(() => {
  const state = {
    userId: "",
    tables: {} as Record<string, any>,
    users: {} as Record<string, any>,
    upserts: [] as Array<{ table: string; row: any }>,
  };
  function builder(table: string) {
    let op = "select";
    const result = () => ({
      data: op === "upsert" ? null : (state.tables[table] ?? null),
      error: null,
    });
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
              state.upserts.push({ table, row: args[0] });
            }
            return b;
          };
        },
      },
    );
    return b;
  }
  const supabaseAdmin = {
    from: (t: string) => builder(t),
    rpc: async () => ({ data: null, error: null }),
    auth: {
      admin: {
        getUserById: async (id: string) => ({
          data: { user: state.users[id] ?? null },
          error: state.users[id] ? null : { message: "not found" },
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
        fn({ data: validate(opts?.data), context: { userId: h.state.userId } }),
    };
    return b;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: {},
  requireAccountAuth: {},
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: h.supabaseAdmin }));
vi.mock("@/lib/advocate-access.server", () => ({ advocateLinkIsAuthorized: () => true }));

import { listMyInvitations } from "@/lib/attorney-invitations.functions";
import { listMyAdvocateAccess, completeAdvocateOnboarding } from "@/lib/advocate.functions";

const confirmed = (email: string) => ({ email, email_confirmed_at: "2026-10-11T00:00:00Z" });

beforeEach(() => {
  h.state.upserts = [];
  h.state.users = {
    [ATTORNEY]: confirmed("Seed-Attorney-A@PatternProof.test"),
    [ADVOCATE]: confirmed("seed-advocate-a@patternproof.test"),
    [UNCONFIRMED]: { email: "unconfirmed@patternproof.test", email_confirmed_at: null },
  };
  h.state.tables = {
    attorney_invitations: [],
    advocate_invitations: [],
    cases: [],
    attorney_client_links: [
      {
        id: "l1",
        attorney_user_id: ATTORNEY,
        status: "active",
        created_at: "2026-10-01",
        case_id: null,
      },
    ],
    advocate_client_links: [
      {
        id: "a1",
        advocate_user_id: ADVOCATE,
        status: "active",
        created_at: "2026-10-01",
        case_id: null,
      },
      {
        id: "a2",
        advocate_user_id: UNCONFIRMED,
        status: "active",
        created_at: "2026-10-01",
        case_id: null,
      },
    ],
    attorney_profiles: [
      {
        user_id: ATTORNEY,
        full_name: "Attorney A",
        firm_name: "Harbor",
        email: "spoofed@example.invalid",
      },
    ],
    advocate_profiles: [
      {
        user_id: ADVOCATE,
        full_name: "Advocate A",
        org_name: "Shelter",
        email: "spoofed@example.invalid",
      },
      {
        user_id: UNCONFIRMED,
        full_name: "Advocate B",
        org_name: null,
        email: "typed@example.invalid",
      },
    ],
  };
});

describe("survivor share pages see the professional's VERIFIED email", () => {
  it("listMyInvitations returns the confirmed auth email, not the profile column", async () => {
    h.state.userId = SURVIVOR;
    const res: any = await listMyInvitations();
    const profile = res.links[0].profile;
    expect(profile.verified_email).toBe("seed-attorney-a@patternproof.test");
    expect(profile).not.toHaveProperty("email");
    expect(JSON.stringify(res)).not.toContain("spoofed@example.invalid");
  });

  it("listMyAdvocateAccess returns the confirmed auth email, and null when unconfirmed", async () => {
    h.state.userId = SURVIVOR;
    const res: any = await listMyAdvocateAccess();
    const byId = Object.fromEntries(res.links.map((l: any) => [l.id, l.profile]));
    expect(byId.a1.verified_email).toBe("seed-advocate-a@patternproof.test");
    expect(byId.a2.verified_email).toBeNull();
    expect(byId.a1).not.toHaveProperty("email");
    expect(JSON.stringify(res)).not.toContain("spoofed@example.invalid");
    expect(JSON.stringify(res)).not.toContain("typed@example.invalid");
  });
});

describe("advocate onboarding writes the verified email", () => {
  it("ignores the typed email and stores the confirmed auth email", async () => {
    h.state.userId = ADVOCATE;
    h.state.tables.user_roles = { role: "advocate" };
    await completeAdvocateOnboarding({
      data: {
        full_name: "Advocate A",
        email: "spoofed@example.invalid",
        confidentiality_accepted: true,
      },
    });
    const write = h.state.upserts.find((u) => u.table === "advocate_profiles");
    expect(write?.row.email).toBe("seed-advocate-a@patternproof.test");
  });

  it("refuses when the account email is unconfirmed", async () => {
    h.state.userId = UNCONFIRMED;
    h.state.tables.user_roles = { role: "advocate" };
    await expect(
      completeAdvocateOnboarding({ data: { full_name: "B", confidentiality_accepted: true } }),
    ).rejects.toThrow(/Confirm your account email/);
    expect(h.state.upserts).toHaveLength(0);
  });
});
