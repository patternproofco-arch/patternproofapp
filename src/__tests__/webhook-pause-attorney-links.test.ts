/** Transport tests for the real signed webhook handler. Database mutation,
 * notification rollback, grant lifetime and duplicate/multiple-subscription
 * behavior are exercised by atomic_attorney_billing.test.sql on PostgreSQL. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeRwAdmin } from "./helpers/fake-rw-supabase";
const state = {
  db: makeRwAdmin({}),
  failRead: false,
  failWrite: false,
  rpc: vi.fn(),
  retrieve: vi.fn(),
  event: { created: 1700000000, type: "", data: { object: {} as unknown } },
};
function failedQuery() {
  const failure = { data: null, error: { message: "connection failed" } };
  const chain = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then")
          return (f: (v: typeof failure) => unknown) => Promise.resolve(failure).then(f);
        return () => chain;
      },
    },
  );
  return chain;
}
const client = {
  rpc: (...args: unknown[]) => state.rpc(...args),
  from(table: string) {
    // The webhook must never directly mutate client grants or notifications.
    if (table !== "subscriptions" && table !== "entitlements")
      throw new Error(`Unexpected direct write: ${table}`);
    const query = state.db.from(table);
    return new Proxy(query, {
      get(target, prop, recv) {
        if (prop === "select" && state.failRead) return () => failedQuery();
        if ((prop === "update" || prop === "upsert") && state.failWrite) return () => failedQuery();
        return Reflect.get(target, prop, recv);
      },
    });
  },
};
vi.mock("@supabase/supabase-js", () => ({ createClient: () => client }));
vi.mock("@/lib/stripe.server", () => ({
  verifyWebhook: async () => state.event,
  createStripeClient: () => ({ subscriptions: { retrieve: state.retrieve } }),
}));
const { Route } = await import("@/routes/api/public/payments/webhook");
type Handler = (ctx: { request: Request }) => Promise<Response>;
const post = (Route as unknown as { options: { server: { handlers: { POST: Handler } } } }).options
  .server.handlers.POST;
const ATTORNEY = "attorney-1";
const subscription = (status: string) => ({
  id: "sub_1",
  status,
  metadata: { userId: ATTORNEY },
  customer: "cus_fixture",
  items: {
    data: [
      {
        price: {
          id: "price_fixture",
          lookup_key: "attorney_solo_monthly",
          product: "prod_fixture",
        },
      },
    ],
  },
});
async function deliver(
  type: string,
  status = "canceled",
  metadata = { userId: ATTORNEY },
  env = "sandbox",
) {
  state.event = {
    created: 1700000000,
    type,
    data: { object: { ...subscription(status), metadata } },
  };
  return post({
    request: new Request(`https://example.test/api/public/payments/webhook?env=${env}`, {
      method: "POST",
      body: "{}",
    }),
  });
}
beforeEach(() => {
  state.db = makeRwAdmin({
    subscriptions: [{ stripe_subscription_id: "sub_1", environment: "sandbox", user_id: ATTORNEY }],
  });
  state.failRead = false;
  state.failWrite = false;
  state.retrieve.mockReset().mockImplementation(async () => state.event.data.object);
  state.rpc.mockReset().mockResolvedValue({ data: 0, error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());
describe("webhook transactional billing recovery", () => {
  it("a duplicate one-time payment cannot extend the paid year", async () => {
    state.event = {
      created: 1700000000,
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_fictional",
          mode: "payment",
          payment_status: "paid",
          amount_total: 100,
          currency: "usd",
          customer: "cus_fictional",
          metadata: { tier: "court_ready_pwyc", userId: "survivor-fixture" },
        },
      },
    };
    const request = () =>
      new Request("https://example.test/api/public/payments/webhook?env=sandbox", {
        method: "POST",
        body: "{}",
      });
    expect((await post({ request: request() })).status).toBe(200);
    const first = {
      ...state.db.tables.subscriptions!.find(
        (row) => row.stripe_subscription_id === "pwyc_cs_fictional",
      )!,
    };
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2030-01-01"));
    expect((await post({ request: request() })).status).toBe(200);
    const repeated = state.db.tables.subscriptions!.find(
      (row) => row.stripe_subscription_id === "pwyc_cs_fictional",
    )!;
    expect(repeated.current_period_start).toBe(new Date(1700000000 * 1000).toISOString());
    expect(repeated.current_period_end).toBe(first.current_period_end);
    expect(state.db.tables.entitlements![0].paid_at).toBe(first.current_period_start);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it.each([
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ])("%s persists status before reconciling billing", async (type) => {
    state.rpc.mockImplementation(async () => {
      expect(state.db.tables.subscriptions![0].status).toBe("canceled");
      return { data: 1, error: null };
    });
    expect((await deliver(type)).status).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith("sync_attorney_billing_access", {
      _attorney_id: ATTORNEY,
      _environment: "sandbox",
    });
  });
  it.each(["customer.subscription.updated", "customer.subscription.deleted"])(
    "%s resolves a missing metadata owner from storage",
    async (type) => {
      expect((await deliver(type, "canceled", {} as { userId: string })).status).toBe(200);
      expect(state.rpc).toHaveBeenCalledWith(
        "sync_attorney_billing_access",
        expect.objectContaining({ _attorney_id: ATTORNEY }),
      );
    },
  );
  it.each([
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ])("%s write failure requests retry without changing access", async (type) => {
    state.failWrite = true;
    expect((await deliver(type)).status).toBe(400);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("lookup failure requests retry rather than acknowledging a lost cancellation", async () => {
    state.failRead = true;
    expect((await deliver("customer.subscription.deleted")).status).toBe(400);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("failed atomic access/notification transaction requests provider retry", async () => {
    state.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "notification write failed" },
    });
    expect((await deliver("customer.subscription.updated", "active")).status).toBe(400);
    expect((await deliver("customer.subscription.updated", "active")).status).toBe(200);
    expect(state.rpc).toHaveBeenCalledTimes(2);
  });
  it("uses current provider state when an older canceled event arrives late", async () => {
    state.retrieve.mockResolvedValue(subscription("active"));
    expect((await deliver("customer.subscription.deleted", "canceled")).status).toBe(200);
    expect(state.db.tables.subscriptions![0].status).toBe("active");
    expect(state.retrieve).toHaveBeenCalledWith("sub_1");
  });
  it("upserts an update that arrives before the creation event", async () => {
    state.db.tables.subscriptions = [];
    expect((await deliver("customer.subscription.updated", "active")).status).toBe(200);
    expect(state.db.tables.subscriptions![0].status).toBe("active");
    expect(state.rpc).toHaveBeenCalled();
  });
  it("provider lookup failure requests retry without persisting a stale snapshot", async () => {
    state.retrieve.mockRejectedValue(new Error("provider unavailable"));
    expect((await deliver("customer.subscription.deleted")).status).toBe(400);
    expect(state.db.tables.subscriptions![0].status).toBeUndefined();
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("does not reassign an already bound subscription to conflicting metadata", async () => {
    expect(
      (await deliver("customer.subscription.updated", "active", { userId: "another-account" }))
        .status,
    ).toBe(400);
    expect(state.db.tables.subscriptions![0].user_id).toBe(ATTORNEY);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("passes the verified live environment to the transaction", async () => {
    expect(
      (await deliver("customer.subscription.created", "active", { userId: ATTORNEY }, "live"))
        .status,
    ).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith("sync_attorney_billing_access", {
      _attorney_id: ATTORNEY,
      _environment: "live",
    });
  });
  it("invalid environment cannot reconcile billing", async () => {
    expect(
      (await deliver("customer.subscription.deleted", "canceled", { userId: ATTORNEY }, "invalid"))
        .status,
    ).toBe(200);
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
