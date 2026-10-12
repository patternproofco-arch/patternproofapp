import { describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn().mockResolvedValue({ sent: true }));
vi.mock("@/lib/email/managed-send.server", () => ({ sendRenderedEmail: send }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: async () => ({ data: true, error: null }),
    auth: {
      admin: {
        getUserById: async () => ({
          data: {
            user: {
              email: "fictional@example.invalid",
              email_confirmed_at: "2026-10-11",
              created_at: "2026-10-11T00:00:00Z",
            },
          },
          error: null,
        }),
      },
    },
    from: () => ({
      insert: async () => ({ error: null }),
      update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    }),
  },
}));
import { notifyNewSignup } from "@/lib/signup-notify.server";

describe("signup notification with the real email renderer", () => {
  it("renders HTML and text before submitting the alert", async () => {
    expect(await notifyNewSignup({ userId: "fictional-user", role: "survivor" })).toBe(true);
    const message = send.mock.calls[0][0];
    expect(message.html).toContain("Someone just joined");
    expect(message.text).toContain("survivor");
    expect(message.html).not.toContain("fictional@example.invalid");
    expect(message.text).not.toContain("fictional@example.invalid");
  });
});
