import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  insert: vi.fn(),
  receipt: vi.fn(),
  save: vi.fn(),
  send: vi.fn(),
  render: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: { admin: { getUserById: mocks.getUserById } },
    from: (table: string) =>
      table === "signup_alert_receipts"
        ? {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.receipt }) }) }),
            upsert: mocks.save,
          }
        : { insert: mocks.insert },
  },
}));
vi.mock("@/lib/email/managed-send.server", () => ({ sendRenderedEmail: mocks.send }));
vi.mock("@react-email/render", () => ({ render: mocks.render }));
import { notifyNewSignup } from "@/lib/signup-notify.server";
const input = { userId: "qa-user", role: "survivor" };
describe("founder signup alert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.receipt.mockResolvedValue({ data: null, error: null });
    mocks.save.mockResolvedValue({ error: null });
    mocks.getUserById.mockResolvedValue({
      data: {
        user: {
          email: "qa@example.invalid",
          email_confirmed_at: "2026-10-10",
          created_at: "2026-10-10",
        },
      },
      error: null,
    });
    mocks.render.mockResolvedValue("rendered");
    mocks.send.mockResolvedValue({ sent: true });
    mocks.insert.mockResolvedValue({ error: null });
  });
  it("sends operational metadata with a stable key and saves a receipt", async () => {
    expect(await notifyNewSignup(input)).toBe(true);
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "patternproofco@gmail.com",
        subject: "New survivor signup",
        idempotencyKey: "new-user-signup-qa-user-survivor",
      }),
    );
    expect(mocks.save).toHaveBeenCalledWith(
      { user_id: "qa-user", role: "survivor", status: "sent" },
      expect.anything(),
    );
  });
  it.each(["sent", "suppressed", "skipped"])(
    "does not resend a %s receipt on later logins",
    async (status) => {
      mocks.receipt.mockResolvedValue({ data: { status }, error: null });
      expect(await notifyNewSignup(input)).toBe(status === "sent");
      expect(mocks.getUserById).not.toHaveBeenCalled();
      expect(mocks.send).not.toHaveBeenCalled();
    },
  );
  it("retries a provider failure without recording it as delivered", async () => {
    mocks.send.mockResolvedValueOnce({ sent: false, reason: "failed", error: "offline" });
    expect(await notifyNewSignup(input)).toBe(false);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(await notifyNewSignup(input)).toBe(true);
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(mocks.send.mock.calls[0][0].idempotencyKey).toBe(
      mocks.send.mock.calls[1][0].idempotencyKey,
    );
  });
  it("records suppression so it is not repeatedly attempted", async () => {
    mocks.send.mockResolvedValue({ sent: false, reason: "recipient_suppressed" });
    expect(await notifyNewSignup(input)).toBe(false);
    expect(mocks.save).toHaveBeenCalledWith(
      { user_id: "qa-user", role: "survivor", status: "suppressed" },
      { onConflict: "user_id,role" },
    );
  });
  it("records a rendering failure without failing account creation", async () => {
    mocks.render.mockRejectedValue(new Error("private error detail"));
    expect(await notifyNewSignup(input)).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        error_message: "Signup notification failed during render_template.",
      }),
    );
  });
  it("does not send an unknown or unconfirmed account alert", async () => {
    mocks.getUserById.mockResolvedValue({ data: {}, error: { message: "lookup failed" } });
    expect(await notifyNewSignup(input)).toBe(false);
    mocks.getUserById.mockResolvedValue({
      data: { user: { email: "qa@example.invalid" } },
      error: null,
    });
    expect(await notifyNewSignup(input)).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ error_message: "Signup notification failed during load_account." }),
    );
  });
  it("fails safely if receipt lookup or persistence is unavailable", async () => {
    mocks.receipt.mockResolvedValueOnce({ data: null, error: { message: "offline" } });
    expect(await notifyNewSignup(input)).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
    mocks.save.mockResolvedValue({ error: { message: "offline" } });
    expect(await notifyNewSignup(input)).toBe(false);
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ error_message: "Signup notification failed during save_receipt." }),
    );
  });
});
