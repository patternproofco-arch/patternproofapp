import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUserById: vi.fn(), insert: vi.fn(), send: vi.fn(), render: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { auth: { admin: { getUserById: mocks.getUserById } }, from: () => ({ insert: mocks.insert }) } }));
vi.mock("@/lib/email/managed-send.server", () => ({ sendRenderedEmail: mocks.send }));
vi.mock("@react-email/render", () => ({ render: mocks.render }));
import { notifyNewSignup } from "@/lib/signup-notify.server";
describe("founder signup alert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserById.mockResolvedValue({ data: { user: { email: "qa@example.invalid", created_at: "2026-10-10" } }, error: null });
    mocks.render.mockResolvedValue("rendered"); mocks.send.mockResolvedValue({ sent: true }); mocks.insert.mockResolvedValue({ error: null });
  });
  it("sends operational metadata with a stable per-account role key", async () => {
    expect(await notifyNewSignup({ userId: "qa-user", role: "survivor" })).toBe(true);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: "patternproofco@gmail.com", subject: "New survivor signup", idempotencyKey: "new-user-signup-qa-user-survivor" }));
  });
  it("records a rendering failure without failing account creation", async () => {
    mocks.render.mockRejectedValue(new Error("private error detail"));
    expect(await notifyNewSignup({ userId: "qa-user", role: "survivor" })).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", error_message: "Signup notification failed during render_template." }));
  });
  it("does not send an unknown account alert after a failed lookup", async () => {
    mocks.getUserById.mockResolvedValue({ data: {}, error: { message: "lookup failed" } });
    expect(await notifyNewSignup({ userId: "qa-user", role: "survivor" })).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ error_message: "Signup notification failed during load_account." }));
  });
});
