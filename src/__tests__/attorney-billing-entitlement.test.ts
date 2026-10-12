import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: mocks.rpc } }));
import { isAttorneyEntitled } from "@/lib/payments.functions";
beforeEach(() => vi.clearAllMocks());
describe("attorney entitlement uses the shared database billing decision", () => {
  it("accepts the aggregate entitlement and binds the actor", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ entitled: true, firm_seats: 5 }], error: null });
    expect(await isAttorneyEntitled("actor-attorney", "client")).toEqual({
      entitled: true,
      reason: "subscribed",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("attorney_billing_state", {
      _attorney_id: "actor-attorney",
    });
  });
  it("denies access when no subscription or founding trial qualifies", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ entitled: false, firm_seats: 1 }], error: null });
    expect(await isAttorneyEntitled("actor-attorney", "client")).toEqual({
      entitled: false,
      reason: "paywall",
    });
  });
  it("fails closed when the billing read fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    await expect(isAttorneyEntitled("actor-attorney", "client")).rejects.toThrow(
      "Could not verify attorney billing entitlement",
    );
  });
});
