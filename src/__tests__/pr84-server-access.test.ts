import { exportAdvocateCasePackage } from "@/lib/advocate-packet.functions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAdmin } from "./helpers/fake-supabase";
const state = vi.hoisted(() => ({ admin: null as any }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler:
        (fn: any) =>
        (args: any = {}) =>
          fn({ ...args, context: { userId: "advocate-a" } }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return state.admin;
  },
}));
import { listAdvocateClients, getAdvocateCase } from "@/lib/advocate.functions";
import { ensureSurvivorRole } from "@/lib/roles.functions";
import { getPinLockState } from "@/lib/pin-lock.functions";
import { resolveAdvocateGrant } from "@/lib/advocate-packet.server";
const base = {
  id: "link",
  advocate_user_id: "advocate-a",
  client_user_id: "survivor-a",
  case_id: "case-a",
  status: "active",
  revoked_at: null,
  expires_at: null,
};
beforeEach(() => {
  state.admin = fakeAdmin({});
});
describe("real handlers fail closed", () => {
  it.each([
    { status: "revoked" },
    { revoked_at: new Date().toISOString() },
    { expires_at: "2000-01-01" },
    { expires_at: "invalid" },
  ])("withholds labels and content for %j", async (overrides) => {
    state.admin = fakeAdmin({
      advocate_client_links: [{ ...base, ...overrides }],
      cases: [
        {
          id: "case-a",
          user_id: "survivor-a",
          case_name: "Private title",
          other_party: "Private person",
        },
      ],
    });
    const list = await listAdvocateClients();
    expect(JSON.stringify(list)).not.toMatch(/Private title|Private person/);
    expect(list.clients[0].case_label).toBeNull();
    expect(state.admin.queries.some((q: any) => q.table === "cases")).toBe(false);
    await expect(getAdvocateCase({ data: { clientId: "survivor-a" } })).rejects.toThrow(
      "No active access",
    );
    await expect(
      exportAdvocateCasePackage({ data: { client_user_id: "survivor-a" } }),
    ).rejects.toThrow("no longer shared");
    expect(
      await resolveAdvocateGrant(state.admin, {
        advocateUserId: "advocate-a",
        clientUserId: "survivor-a",
      }),
    ).toBeNull();
  });
  it("returns only the specifically shared case label", async () => {
    state.admin = fakeAdmin({
      advocate_client_links: [base],
      cases: [
        { id: "case-a", user_id: "survivor-a", case_name: "Shared" },
        { id: "case-b", user_id: "survivor-a", case_name: "Secret" },
      ],
    });
    expect((await listAdvocateClients()).clients[0].case_label).toBe("Shared");
  });
  it("does not infer unrelated case titles from an account-wide content grant", async () => {
    state.admin = fakeAdmin({
      advocate_client_links: [{ ...base, case_id: null }],
      cases: [{ id: "case-b", user_id: "survivor-a", case_name: "Secret" }],
    });
    expect((await listAdvocateClients()).clients[0].case_label).toBeNull();
    expect(state.admin.queries.some((q: any) => q.table === "cases")).toBe(false);
  });
  it.each(["advocate_invitations", "advocate_survivor_invites"])(
    "denies a partially revoked %s before case reads and exports",
    async (table) => {
      const key = table === "advocate_invitations" ? "invitation_id" : "survivor_invite_id";
      state.admin = fakeAdmin({
        advocate_client_links: [{ ...base, [key]: "invite" }],
        [table]: [{ id: "invite", status: "revoked" }],
      });
      await expect(getAdvocateCase({ data: { clientId: "survivor-a" } })).rejects.toThrow(
        "No active access",
      );
      expect(
        await resolveAdvocateGrant(state.admin, {
          advocateUserId: "advocate-a",
          clientUserId: "survivor-a",
        }),
      ).toBeNull();
    },
  );
  it("does not create a survivor role when the database read fails", async () => {
    const upsert = vi.fn();
    state.admin = {
      from: () => ({
        select: () => ({ eq: async () => ({ data: null, error: new Error("offline") }) }),
        upsert,
      }),
    };
    await expect(ensureSurvivorRole()).rejects.toThrow("verify account roles");
    expect(upsert).not.toHaveBeenCalled();
  });
  it("does not misroute an organization when referral lookup fails", async () => {
    state.admin = {
      from: (table: string) => ({
        select: () => ({
          eq: async () =>
            table === "user_roles"
              ? { data: [{ role: "advocate" }], error: null }
              : { count: null, error: new Error("offline") },
        }),
      }),
    };
    await expect(ensureSurvivorRole()).rejects.toThrow("verify organization access");
  });
  it("does not interpret failed PIN lookup as no PIN", async () => {
    state.admin = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: new Error("offline") }) }),
        }),
      }),
    };
    await expect(getPinLockState()).rejects.toThrow("verify app lock settings");
  });
});
