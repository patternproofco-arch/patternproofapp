/**
 * Runs the real Stripe webhook route handler against an in-memory Supabase
 * fake to prove pauseAttorneyAccessIfApplicable():
 *  - writes only `status: "paused"` (attorney_client_links has no updated_at);
 *  - throws before notifying anyone when the pause fails, so the route
 *    answers 400 and Stripe retries;
 *  - notifies each affected survivor only after the pause succeeded.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeRwAdmin, type Tables } from "./helpers/fake-rw-supabase";

type Row = Record<string, unknown>;

/** Real column list for attorney_client_links, from the generated DB types. */
function linkColumns(): Set<string> {
  const types = readFileSync("src/integrations/supabase/types.ts", "utf8");
  const start = types.indexOf("attorney_client_links: {");
  const row = types.slice(types.indexOf("Row: {", start), types.indexOf("Insert: {", start));
  return new Set([...row.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]).filter((c) => c !== "Row"));
}
const LINK_COLUMNS = linkColumns();

const state: {
  db: ReturnType<typeof makeRwAdmin>;
  linkPatches: Row[];
  failLinkUpdate: string | null;
  event: { type: string; data: { object: unknown } };
} = {
  db: makeRwAdmin({}),
  linkPatches: [],
  failLinkUpdate: null,
  event: { type: "", data: { object: {} } },
};

/**
 * Stable client (the route caches it at module level) that delegates to the
 * current fake. Like PostgREST, an update naming a column the table does not
 * have is rejected; a test can also force the link update to fail.
 */
const client = {
  from(name: string) {
    const q = state.db.from(name);
    if (name === "notifications") {
      // supabase-js accepts an array insert; the shared fake stores one row per call.
      return {
        insert: async (rows: Row | Row[]) => {
          for (const r of Array.isArray(rows) ? rows : [rows]) {
            const { error } = await state.db.from(name).insert(r);
            if (error) return { data: null, error };
          }
          return { data: null, error: null };
        },
      };
    }
    if (name !== "attorney_client_links") return q;
    return new Proxy(q, {
      get(target, prop, recv) {
        if (prop !== "update") return Reflect.get(target, prop, recv);
        return (patch: Row) => {
          state.linkPatches.push(patch);
          const unknown = Object.keys(patch).find((k) => !LINK_COLUMNS.has(k));
          const message = unknown
            ? `Could not find the '${unknown}' column of 'attorney_client_links' in the schema cache`
            : state.failLinkUpdate;
          if (message) {
            const failed = Promise.resolve({ data: null, error: { message } });
            const chain = { in: () => failed, eq: () => failed };
            return chain;
          }
          return target.update(patch);
        };
      },
    });
  },
};

vi.mock("@supabase/supabase-js", () => ({ createClient: () => client }));
vi.mock("@/lib/stripe.server", () => ({ verifyWebhook: async () => state.event }));

const { Route } = await import("@/routes/api/public/payments/webhook");
type Handler = (ctx: { request: Request }) => Promise<Response>;
const post = (Route as unknown as { options: { server: { handlers: { POST: Handler } } } }).options
  .server.handlers.POST;

const ATTORNEY = "attorney-1";
const SURVIVOR_A = "survivor-a";
const SURVIVOR_B = "survivor-b";

function seed(): Tables {
  return {
    user_roles: [{ user_id: ATTORNEY, role: "attorney" }],
    subscriptions: [{ stripe_subscription_id: "sub_1", environment: "sandbox", user_id: ATTORNEY }],
    firms: [],
    notifications: [],
    attorney_client_links: [
      { id: "link-a", attorney_user_id: ATTORNEY, client_user_id: SURVIVOR_A, status: "active" },
      { id: "link-b", attorney_user_id: ATTORNEY, client_user_id: SURVIVOR_B, status: "active" },
      {
        id: "link-old",
        attorney_user_id: ATTORNEY,
        client_user_id: "survivor-c",
        status: "revoked",
      },
      {
        id: "link-other",
        attorney_user_id: "attorney-2",
        client_user_id: SURVIVOR_A,
        status: "active",
      },
    ],
  };
}

function subscription(status: string) {
  return { id: "sub_1", status, metadata: { userId: ATTORNEY }, items: { data: [] } };
}

async function deliver(type: string, status = "canceled") {
  state.event = { type, data: { object: subscription(status) } };
  const req = new Request("https://example.test/api/public/payments/webhook?env=sandbox", {
    method: "POST",
    body: "{}",
  });
  return post({ request: req });
}

const statusOf = (id: string) =>
  state.db.tables.attorney_client_links!.find((r) => r.id === id)?.status;

beforeEach(() => {
  state.db = makeRwAdmin(seed());
  state.linkPatches = [];
  state.failLinkUpdate = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("Stripe webhook pauses attorney client links", () => {
  it("subscription deleted: pauses only that attorney's active links, writes only status, then notifies", async () => {
    const res = await deliver("customer.subscription.deleted");
    expect(res.status).toBe(200);

    expect(state.linkPatches).toEqual([{ status: "paused" }]);
    for (const p of state.linkPatches) expect(p).not.toHaveProperty("updated_at");

    expect(statusOf("link-a")).toBe("paused");
    expect(statusOf("link-b")).toBe("paused");
    expect(statusOf("link-old")).toBe("revoked");
    expect(statusOf("link-other")).toBe("active");

    const notes = state.db.tables.notifications!;
    expect(notes.map((n) => n.user_id).sort()).toEqual([SURVIVOR_A, SURVIVOR_B]);
    for (const n of notes) expect(n.kind).toBe("attorney_access_paused");
  });

  it("subscription updated to unpaid also pauses and notifies", async () => {
    const res = await deliver("customer.subscription.updated", "unpaid");
    expect(res.status).toBe(200);
    expect(statusOf("link-a")).toBe("paused");
    expect(state.db.tables.notifications).toHaveLength(2);
  });

  it("subscription updated but still active: no pause, no notifications", async () => {
    const res = await deliver("customer.subscription.updated", "active");
    expect(res.status).toBe(200);
    expect(state.linkPatches).toEqual([]);
    expect(state.db.tables.notifications).toHaveLength(0);
  });

  it("pause failure: no notifications, links untouched, route answers 400 so Stripe retries", async () => {
    state.failLinkUpdate = "connection reset";
    const res = await deliver("customer.subscription.deleted");
    expect(res.status).toBe(400);
    expect(state.db.tables.notifications).toHaveLength(0);
    expect(statusOf("link-a")).toBe("active");
    expect(statusOf("link-b")).toBe("active");
  });

  it("Stripe retry after a failed pause succeeds and notifies exactly once", async () => {
    state.failLinkUpdate = "timeout";
    expect((await deliver("customer.subscription.deleted")).status).toBe(400);
    state.failLinkUpdate = null;
    expect((await deliver("customer.subscription.deleted")).status).toBe(200);
    expect(statusOf("link-a")).toBe("paused");
    expect(state.db.tables.notifications).toHaveLength(2);
  });

  it("the schema-aware fake rejects updated_at, the column the old code wrote", () => {
    expect(LINK_COLUMNS.has("status")).toBe(true);
    expect(LINK_COLUMNS.has("updated_at")).toBe(false);
    const src = readFileSync("src/routes/api/public/payments/webhook.ts", "utf8");
    const fn = src.slice(src.indexOf("async function pauseAttorneyAccessIfApplicable"));
    expect(fn).toContain('.update({ status: "paused" })');
    expect(fn.indexOf("if (pauseErr)")).toBeLessThan(fn.indexOf('from("notifications")'));
  });

  it("non-attorney subscription: nothing paused, nothing sent", async () => {
    state.db.tables.user_roles = [];
    const res = await deliver("customer.subscription.deleted");
    expect(res.status).toBe(200);
    expect(state.linkPatches).toEqual([]);
    expect(state.db.tables.notifications).toHaveLength(0);
  });
});
