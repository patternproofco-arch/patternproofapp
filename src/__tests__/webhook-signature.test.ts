import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyWebhook } from "@/lib/stripe.server";
const key = "test-only";
function request(created: unknown = 1700000000, valid = true) {
  const body = JSON.stringify({
    type: "checkout.session.completed",
    created,
    data: { object: { id: "cs_fictional" } },
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", key).update(`${timestamp}.${body}`).digest("hex");
  return new Request("https://example.test/api/public/payments/webhook?env=sandbox", {
    method: "POST",
    body,
    headers: { "stripe-signature": `t=${timestamp},v1=${valid ? signature : "00"}` },
  });
}
beforeEach(() => vi.stubEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET", key));
afterEach(() => vi.unstubAllEnvs());
describe("verified payment event timestamp", () => {
  it("retains the original event date after signature verification", async () => {
    expect((await verifyWebhook(request(), "sandbox")).created).toBe(1700000000);
  });
  it("cannot trust an event with a bad signature", async () => {
    await expect(verifyWebhook(request(1700000000, false), "sandbox")).rejects.toThrow(
      "Invalid webhook signature",
    );
  });
  it("rejects a signed malformed purchase timestamp", async () => {
    await expect(verifyWebhook(request("invalid"), "sandbox")).rejects.toThrow(
      "Invalid webhook event",
    );
  });
});
