import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
// @ts-expect-error Shared JavaScript browser fixture has no declaration file.
import { fakeSession, fakeUser } from "../../scripts/qa/mock-session.mjs";

describe("fictional browser sessions satisfy the real Supabase MFA parser", () => {
  it.each(["aal1", "aal2"])("models %s without changing application gates", async (aal) => {
    const user = fakeUser({
      factors: [{ id: "fixture-factor", factor_type: "totp", status: "verified" }],
    });
    const session = fakeSession(user, { aal });
    const client = createClient("https://example.invalid", "fictional-publishable-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async () => Response.json(user) },
    });
    const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel(
      session.access_token,
    );
    expect(error).toBeNull();
    expect(data).toMatchObject({ currentLevel: aal, nextLevel: "aal2" });
  });
});
