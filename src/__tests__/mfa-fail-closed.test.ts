import { beforeEach, describe, expect, it, vi } from "vitest";

const session = {
  access_token: "test-token",
};

const aal = {
  data: { currentLevel: "aal1", nextLevel: "aal1" } as {
    currentLevel: string;
    nextLevel: string;
  } | null,
  error: null as { message: string } | null,
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => aal,
        listFactors: async () => ({ data: { totp: [] }, error: null }),
        unenroll: async () => ({ data: null, error: null }),
      },
    },
  },
}));

describe("resolveMfaGate fail-closed (network factors probe)", () => {
  beforeEach(() => {
    vi.resetModules();
    aal.data = { currentLevel: "aal1", nextLevel: "aal1" };
    aal.error = null;
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "anon-key");
    vi.unstubAllGlobals();
  });

  it("denies when requireEnrollment and factors HTTP request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );
    const { resolveMfaGate } = await import("@/lib/mfa");
    await expect(resolveMfaGate({ requireEnrollment: true })).resolves.toBe("deny");
  });

  it("denies when requireEnrollment and factors fetch throws/aborts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const { resolveMfaGate } = await import("@/lib/mfa");
    await expect(resolveMfaGate({ requireEnrollment: true })).resolves.toBe("deny");
  });

  it("enrolls only when factors HTTP succeeds with no verified totp", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ totp: [], phone: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const { resolveMfaGate } = await import("@/lib/mfa");
    await expect(resolveMfaGate({ requireEnrollment: true })).resolves.toBe("enroll");
  });

  it("totpStatus returns unknown when factors HTTP fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("blocked");
      }),
    );
    const { totpStatus } = await import("@/lib/mfa");
    await expect(totpStatus()).resolves.toBe("unknown");
  });

  it("challenges when AAL says verified factor still pending", async () => {
    aal.data = { currentLevel: "aal1", nextLevel: "aal2" };
    const { resolveMfaGate } = await import("@/lib/mfa");
    await expect(resolveMfaGate({ requireEnrollment: true })).resolves.toBe("challenge");
  });
});
