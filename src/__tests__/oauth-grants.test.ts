import { beforeEach, describe, expect, it, vi } from "vitest";
const oauth = vi.hoisted(() => ({ listGrants: vi.fn(), revokeGrant: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { oauth } } }));
import { listMyOauthConsents, revokeMyOauthConsent } from "@/lib/oauth-consents";
beforeEach(() => vi.clearAllMocks());
describe("session bound connected apps", () => {
  it("loads grants from Auth without taking a user ID", async () => {
    oauth.listGrants.mockResolvedValue({
      data: [
        {
          client: { id: "client-a", name: "Example" },
          scopes: ["openid"],
          granted_at: "2026-10-01",
        },
      ],
      error: null,
    });
    expect(await listMyOauthConsents()).toEqual([
      {
        client_id: "client-a",
        client_name: "Example",
        scopes: ["openid"],
        granted_at: "2026-10-01",
      },
    ]);
    expect(oauth.listGrants).toHaveBeenCalledWith();
  });
  it.each([
    { data: null, error: new Error("offline") },
    { data: null, error: null },
  ])("does not turn a load failure into an empty list", async (result) => {
    oauth.listGrants.mockResolvedValue(result);
    await expect(listMyOauthConsents()).rejects.toThrow("couldn't load");
  });
  it("revokes the client grant through Auth", async () => {
    oauth.revokeGrant.mockResolvedValue({ data: {}, error: null });
    await revokeMyOauthConsent("client-a");
    expect(oauth.revokeGrant).toHaveBeenCalledWith({ clientId: "client-a" });
  });
  it("propagates revocation failure", async () => {
    oauth.revokeGrant.mockResolvedValue({ data: null, error: new Error("offline") });
    await expect(revokeMyOauthConsent("client-a")).rejects.toThrow("couldn't turn off");
  });
});
