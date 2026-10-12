import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  insert: vi.fn(),
  send: vi.fn(),
  render: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
  complete: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: { admin: { getUserById: mocks.getUserById } },
    rpc: mocks.rpc,
    from: () => ({
      insert: mocks.insert,
      update: (patch: unknown) => {
        mocks.update(patch);
        return { eq: () => ({ eq: mocks.complete }) };
      },
    }),
  },
}));
vi.mock("@/lib/email/managed-send.server", () => ({ sendRenderedEmail: mocks.send }));
vi.mock("@react-email/render", () => ({ render: mocks.render }));
import { notifyNewSignup } from "@/lib/signup-notify.server";
describe("founder signup alert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.getUserById.mockResolvedValue({
      data: {
        user: {
          email: "qa@example.invalid",
          email_confirmed_at: "2026-10-11",
          created_at: "2026-10-10",
        },
      },
      error: null,
    });
    mocks.render.mockResolvedValue("rendered");
    mocks.send.mockResolvedValue({ sent: true });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.complete.mockResolvedValue({ error: null });
  });
  it("sends operational metadata with a stable per-account role key", async () => {
    expect(await notifyNewSignup({ userId: "qa-user", role: "survivor" })).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("claim_signup_alert", {
      _user_id: "qa-user",
      _role: "survivor",
      _enqueue: true,
    });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ outcome: "sent" }));
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "patternproofco@gmail.com",
        subject: "New survivor signup",
        idempotencyKey: "new-user-signup-qa-user-survivor",
      }),
    );
  });
  it("records a rendering failure without failing account creation", async () => {
    mocks.render.mockRejectedValue(new Error("private error detail"));
    expect(await notifyNewSignup({ userId: "qa-user", role: "survivor" })).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        error_message: "Signup notification failed during render_template.",
      }),
    );
  });
  it("does not send an unknown account alert after a failed lookup", async () => {
    mocks.getUserById.mockResolvedValue({ data: {}, error: { message: "lookup failed" } });
    expect(await notifyNewSignup({ userId: "qa-user", role: "survivor" })).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ error_message: "Signup notification failed during load_account." }),
    );
  });
  it("does not send an alert for an unconfirmed account", async () => {
    mocks.getUserById.mockResolvedValue({
      data: { user: { email: "qa@example.invalid", email_confirmed_at: null } },
      error: null,
    });
    expect(await notifyNewSignup({ userId: "qa-user", role: "survivor" })).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("records claim and completion failures without treating the alert as delivered", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "offline" } });
    expect(await notifyNewSignup({ userId: "qa-user", role: "survivor" })).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        error_message: "Signup notification failed during claim_alert.",
      }),
    );
    mocks.complete.mockResolvedValue({ error: { message: "offline" } });
    expect(await notifyNewSignup({ userId: "qa-user", role: "survivor" })).toBe(false);
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        error_message: "Signup notification failed during complete_alert.",
      }),
    );
  });
  it("does not submit an alert already delivered or currently leased", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect(await notifyNewSignup({ userId: "qa-user", role: "survivor", retryOnly: true })).toBe(
      false,
    );
    expect(mocks.rpc).toHaveBeenCalledWith("claim_signup_alert", {
      _user_id: "qa-user",
      _role: "survivor",
      _enqueue: false,
    });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });
  it("keeps a failed provider attempt pending and honors suppression", async () => {
    mocks.send.mockResolvedValueOnce({
      sent: false,
      reason: "failed",
      error: "Provider unavailable",
    });
    expect(await notifyNewSignup({ userId: "qa-user", role: "survivor" })).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
    mocks.send.mockResolvedValueOnce({ sent: false, reason: "recipient_suppressed" });
    expect(await notifyNewSignup({ userId: "qa-user", role: "survivor" })).toBe(false);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ outcome: "suppressed" }));
  });
});
