import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeRwAdmin } from "./helpers/fake-rw-supabase";
import { consentKey, JEV_CONSENT_VERSION, jevScopeHash } from "@/lib/jev-consent.server";
import { jevFingerprint, rankJevSource, requestTerms } from "@/lib/jev-retrieval.server";
const state = vi.hoisted(() => ({
  db: null as any,
  actor: "attorney",
  evaluate: vi.fn(),
  available: vi.fn(),
  metadata: {} as Record<string, any>,
  failAuth: false,
  claims: {} as any,
  passwordCheck: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return state.db;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: {},
  requireAccountAuth: {},
}));
vi.mock("@/lib/attorney-portal-auth", () => ({ requireAttorneyPortalAuth: {} }));
vi.mock("@/lib/jev.server", () => ({
  evaluateJev: state.evaluate,
  assertJevAvailable: state.available,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { signInWithPassword: state.passwordCheck } }),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (input: any) => input;
    const builder = {
      middleware: () => builder,
      inputValidator: (fn: any) => {
        validate = fn;
        return builder;
      },
      handler:
        (fn: any) =>
        async (args: any = {}) =>
          fn({
            data: validate(args.data),
            context: { userId: state.actor, supabase: state.db, claims: state.claims },
          }),
    };
    return builder;
  },
}));
import { suggestRequestMatches } from "@/lib/jev-proposals.functions";
import { getMyJevSharePermissions, setMyJevSharePermission } from "@/lib/jev-consent.functions";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const clientId = id(1),
  fileId = id(2),
  linkId = id(3);
const input = {
  clientId,
  title: "electric utility payment",
  details: "",
  aiConsent: true as const,
};
const choice = (label = "file_0", confidence = 0.95) => ({
  model: "jev-1.13.0",
  answers: {
    match: { type: "choice", choice: label, confidence, probabilities: { [label]: confidence } },
  },
});
function file(n = 2) {
  return {
    id: id(n),
    user_id: clientId,
    title: "Saved document",
    description: null,
    mime: "text/plain",
    file_type: "document",
    ai_permission: "organize",
    is_sealed: false,
    deleted_at: null,
    transcript_status: "pending",
    transcript: "DO NOT SEND UNREADY",
    extracted_text: "Electric utility payment for August",
    file_url: "PRIVATE STORAGE",
    gps_lat: 40,
  };
}
async function allow() {
  state.metadata[consentKey(linkId)] = {
    version: JEV_CONSENT_VERSION,
    clientId,
    attorneyId: "attorney",
    scopeHash: await jevScopeHash(state.db.tables.attorney_client_links[0]),
    nonce: "consent-one",
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  };
}
beforeEach(async () => {
  vi.unstubAllEnvs();
  state.actor = "attorney";
  state.passwordCheck.mockReset().mockResolvedValue({ error: null });
  state.failAuth = false;
  state.claims = { amr: [{ method: "oauth", timestamp: Math.floor(Date.now() / 1000) }] };
  state.metadata = {};
  state.available.mockReset();
  state.evaluate.mockReset().mockResolvedValue(choice());
  state.db = makeRwAdmin(
    {
      user_roles: [{ user_id: "attorney", role: "attorney" }],
      attorney_client_links: [
        {
          id: linkId,
          attorney_user_id: "attorney",
          client_user_id: clientId,
          status: "active",
          revoked_at: null,
          expires_at: null,
          case_id: null,
          include_all_incidents: false,
          include_all_evidence: false,
          scope_incidents: [],
          scope_evidence: [fileId],
        },
      ],
      evidence: [file()],
      attorney_profiles: [{ user_id: "attorney", full_name: "Fictional Attorney" }],
    },
    { maxInIds: 100 },
  );
  state.db.auth = {
    admin: {
      getUserById: vi.fn(async () => ({
        data: {
          user: state.failAuth
            ? null
            : {
                app_metadata: state.metadata,
                identities: [],
                last_sign_in_at: new Date().toISOString(),
              },
        },
        error: state.failAuth ? new Error("unavailable") : null,
      })),
      updateUserById: vi.fn(async (_id: string, input: any) => {
        Object.assign(state.metadata, input.app_metadata);
        return { error: null };
      }),
    },
  };
  await allow();
});

describe("request matching follows source and consent boundaries", () => {
  it("searches beyond 40 IDs and finds request-relevant text past character 1200", async () => {
    state.db.tables.evidence = Array.from({ length: 150 }, (_, n) => ({
      ...file(n + 20),
      extracted_text: "Unrelated material",
    }));
    state.db.tables.evidence[149].extracted_text =
      "Unrelated material. ".repeat(500) + "Electric utility payment from August";
    state.db.tables.attorney_client_links[0].scope_evidence = state.db.tables.evidence.map(
      (r: any) => r.id,
    );
    await allow();
    const result = await suggestRequestMatches({ data: input });
    expect(result.searchedCount).toBe(150);
    expect(result.checkedCount).toBe(1);
    expect(result.suggestion?.evidenceId).toBe(id(169));
    expect(result.suggestion?.excerptStart).toBeGreaterThan(1200);
    expect(result.suggestion?.excerpt).toContain("Electric utility payment");
  });
  it("sends relevant excerpts with aliases, not private metadata or the full documents", async () => {
    state.db.tables.evidence[0].extracted_text =
      "PRIVATE PREFIX ".repeat(1000) + "Electric utility payment";
    const result = await suggestRequestMatches({ data: input });
    const sent = JSON.stringify(state.evaluate.mock.calls[0]);
    expect(result.suggestion?.sourceRevision).toMatch(/^[a-f0-9]{64}$/);
    expect(result.instructionVersion).toBe("request-match-v2");
    expect(sent).not.toMatch(/PRIVATE STORAGE|gps_lat|DO NOT SEND UNREADY/);
    expect(sent).not.toContain(fileId);
    expect(sent.length).toBeLessThan(4000);
    expect(state.db.audits[0].p_meta).toMatchObject({
      action: "suggestion_only",
      instruction_version: "request-match-v2",
    });
    expect(JSON.stringify(state.db.audits)).not.toContain("Electric utility payment");
  });
  it("never sends or considers unshared or other people's files", async () => {
    state.db.tables.evidence.push({ ...file(99), title: "HIDDEN FILE" });
    state.db.tables.evidence[0].user_id = "someone else";
    const result = await suggestRequestMatches({ data: input });
    expect(result.searchedCount).toBe(0);
    expect(result.suggestion).toBeNull();
    expect(state.evaluate).not.toHaveBeenCalled();
  });
  it.each(["none", "denied", "unknown", null])("excludes AI permission %s", async (permission) => {
    state.db.tables.evidence[0].ai_permission = permission;
    expect((await suggestRequestMatches({ data: input })).searchedCount).toBe(0);
    expect(state.evaluate).not.toHaveBeenCalled();
  });
  it.each(["sealed", "deleted"])("excludes %s records", async (kind) => {
    if (kind === "sealed") state.db.tables.evidence[0].is_sealed = true;
    else state.db.tables.evidence[0].deleted_at = "2026-01-01";
    expect((await suggestRequestMatches({ data: input })).suggestion).toBeNull();
    expect(state.evaluate).not.toHaveBeenCalled();
  });
  it.each([
    "missing",
    "expired",
    "wrong attorney",
    "wrong provider version",
    "scope changed",
    "auth unavailable",
  ])("requires current survivor authorization: %s", async (kind) => {
    const permission = state.metadata[consentKey(linkId)];
    if (kind === "missing") delete state.metadata[consentKey(linkId)];
    if (kind === "expired") permission.expiresAt = "2000-01-01T00:00:00.000Z";
    if (kind === "wrong attorney") permission.attorneyId = "other";
    if (kind === "wrong provider version") permission.version = "some-other-purpose";
    if (kind === "scope changed")
      state.db.tables.attorney_client_links[0].scope_evidence.push(id(99));
    if (kind === "auth unavailable") state.failAuth = true;
    await expect(suggestRequestMatches({ data: input })).rejects.toThrow("hasn't authorized");
    expect(state.evaluate).not.toHaveBeenCalled();
    expect(state.db.selects.some((s: any) => s.table === "evidence")).toBe(false);
  });
  it.each(["revoked", "expired", "role removed"])("denies %s attorney access", async (kind) => {
    if (kind === "revoked") state.db.tables.attorney_client_links[0].revoked_at = "2026-01-01";
    if (kind === "expired") state.db.tables.attorney_client_links[0].expires_at = "2000-01-01";
    if (kind === "role removed") state.db.tables.user_roles = [];
    await expect(suggestRequestMatches({ data: input })).rejects.toThrow();
    expect(state.evaluate).not.toHaveBeenCalled();
  });
  it("requires fresh survivor authorization after case scope changes", async () => {
    const grant = state.db.tables.attorney_client_links[0];
    grant.case_id = "case";
    state.db.tables.cases = [
      { id: "case", user_id: clientId, attached_evidence_ids: [], highlighted_incident_ids: [] },
    ];
    await expect(suggestRequestMatches({ data: input })).rejects.toThrow("hasn't authorized");
    expect(state.evaluate).not.toHaveBeenCalled();
  });
  it.each(["source edit", "permission withdrawn", "new consent", "share revoked"])(
    "rejects results after %s during inference",
    async (kind) => {
      state.evaluate.mockImplementationOnce(async () => {
        if (kind === "source edit") state.db.tables.evidence[0].extracted_text = "Changed content";
        if (kind === "permission withdrawn")
          state.metadata[consentKey(linkId)] = { enabled: false };
        if (kind === "new consent") state.metadata[consentKey(linkId)].nonce = "consent-two";
        if (kind === "share revoked")
          state.db.tables.attorney_client_links[0].revoked_at = "2026-01-01";
        return choice();
      });
      await expect(suggestRequestMatches({ data: input })).rejects.toThrow();
      expect(state.db.audits).toHaveLength(0);
    },
  );
  it.each([choice("none"), choice("file_0", 0.2)])(
    "abstains without inferring missing items",
    async (response) => {
      state.evaluate.mockResolvedValueOnce(response);
      expect((await suggestRequestMatches({ data: input })).suggestion).toBeNull();
    },
  );
  it("does not call Jev for generic or unrelated requests", async () => {
    for (const title of ["Please send the files", "Medical appointment invoice"]) {
      const result = await suggestRequestMatches({ data: { ...input, title } });
      expect(result.model).toBeNull();
      expect(result.suggestion).toBeNull();
    }
    expect(state.evaluate).not.toHaveBeenCalled();
  });
  it("bounds external candidates, and never mutates evidence, reviews, or requests", async () => {
    state.db.tables.evidence = Array.from({ length: 30 }, (_, n) => file(n + 20));
    state.db.tables.attorney_client_links[0].scope_evidence = state.db.tables.evidence.map(
      (r: any) => r.id,
    );
    await allow();
    const before = structuredClone(state.db.tables);
    const result = await suggestRequestMatches({ data: input });
    expect(result.checkedCount).toBe(12);
    expect(state.db.tables).toEqual(before);
  });
  it("requires explicit attorney processing confirmation", async () => {
    await expect(
      suggestRequestMatches({ data: { ...input, aiConsent: false as any } }),
    ).rejects.toThrow();
    expect(state.evaluate).not.toHaveBeenCalled();
  });
});

describe("survivor manages a named share's permission", () => {
  beforeEach(() => {
    state.actor = clientId;
  });
  it("starts off, shows named share, and enables only for its owner", async () => {
    state.metadata = { unrelated_setting: true };
    expect((await getMyJevSharePermissions()).shares[0]).toMatchObject({
      attorneyName: "Fictional Attorney",
      enabled: false,
    });
    await setMyJevSharePermission({
      data: {
        linkId,
        enabled: true,
        scopeFingerprint: await jevScopeHash(state.db.tables.attorney_client_links[0]),
      },
    });
    expect(state.metadata[consentKey(linkId)]).toMatchObject({
      clientId,
      attorneyId: "attorney",
      version: JEV_CONSENT_VERSION,
    });
    expect(state.metadata.unrelated_setting).toBe(true);
    expect((await getMyJevSharePermissions()).shares[0].enabled).toBe(true);
  });
  it("rejects a changed scope instead of authorizing files not reviewed", async () => {
    const reviewed = await jevScopeHash(state.db.tables.attorney_client_links[0]);
    state.db.tables.attorney_client_links[0].scope_evidence.push(id(99));
    await expect(
      setMyJevSharePermission({ data: { linkId, enabled: true, scopeFingerprint: reviewed } }),
    ).rejects.toThrow("changed since you reviewed");
    expect(state.db.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
  it("does not accept token issue time as a fresh sign-in", async () => {
    state.claims = { iat: Math.floor(Date.now() / 1000) };
    await expect(
      setMyJevSharePermission({
        data: {
          linkId,
          enabled: true,
          scopeFingerprint: await jevScopeHash(state.db.tables.attorney_client_links[0]),
        },
      }),
    ).rejects.toThrow("Sign out");
    expect(state.db.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
  it("an attorney cannot grant permission on the survivor's behalf", async () => {
    state.actor = "attorney";
    await expect(
      setMyJevSharePermission({
        data: {
          linkId,
          enabled: true,
          scopeFingerprint: await jevScopeHash(state.db.tables.attorney_client_links[0]),
        },
      }),
    ).rejects.toThrow("isn't available");
    expect(state.db.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
  it("turning off requires neither an active share nor a configured provider", async () => {
    state.db.tables.attorney_client_links[0].revoked_at = "2026-01-01";
    state.available.mockImplementation(() => {
      throw new Error("off");
    });
    await setMyJevSharePermission({ data: { linkId, enabled: false } });
    expect(state.metadata[consentKey(linkId)]).toEqual({ enabled: false });
  });
  it("requires a fresh requesting session even if the account signed in elsewhere recently", async () => {
    state.claims = { amr: [{ method: "oauth", timestamp: Math.floor(Date.now() / 1000) - 3600 }] };
    state.db.auth.admin.getUserById.mockResolvedValueOnce({
      data: { user: { identities: [], last_sign_in_at: new Date().toISOString() } },
      error: null,
    });
    await expect(
      setMyJevSharePermission({
        data: {
          linkId,
          enabled: true,
          scopeFingerprint: await jevScopeHash(state.db.tables.attorney_client_links[0]),
        },
      }),
    ).rejects.toThrow("Sign out");
    expect(state.db.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
  it("requires password confirmation on a stale email session", async () => {
    state.claims = {};
    state.db.auth.admin.getUserById.mockResolvedValueOnce({
      data: { user: { email: "fictional@example.invalid", identities: [{ provider: "email" }] } },
      error: null,
    });
    await expect(
      setMyJevSharePermission({
        data: {
          linkId,
          enabled: true,
          scopeFingerprint: await jevScopeHash(state.db.tables.attorney_client_links[0]),
        },
      }),
    ).rejects.toThrow("password");
    expect(state.db.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
  it.each([true, false])("verifies the supplied account password (valid: %s)", async (valid) => {
    state.claims = {};
    vi.stubEnv("SUPABASE_URL", "https://example.invalid");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "fictional-publishable-key");
    state.db.auth.admin.getUserById.mockResolvedValueOnce({
      data: { user: { email: "fictional@example.invalid", identities: [{ provider: "email" }] } },
      error: null,
    });
    state.passwordCheck.mockResolvedValueOnce({ error: valid ? null : new Error("invalid") });
    const call = setMyJevSharePermission({
      data: {
        linkId,
        enabled: true,
        password: "fictional-password",
        scopeFingerprint: await jevScopeHash(state.db.tables.attorney_client_links[0]),
      },
    });
    if (valid) await expect(call).resolves.toMatchObject({ ok: true });
    else {
      await expect(call).rejects.toThrow("isn't right");
      expect(state.db.auth.admin.updateUserById).not.toHaveBeenCalled();
    }
    expect(state.passwordCheck).toHaveBeenCalledWith({
      email: "fictional@example.invalid",
      password: "fictional-password",
    });
  });
  it("permits a fresh verified email OTP session without assuming an email identity has a password", async () => {
    state.claims = { amr: [{ method: "otp", timestamp: Math.floor(Date.now() / 1000) }] };
    state.db.auth.admin.getUserById.mockResolvedValueOnce({
      data: { user: { email: "fictional@example.invalid", identities: [{ provider: "email" }] } },
      error: null,
    });
    await expect(
      setMyJevSharePermission({
        data: {
          linkId,
          enabled: true,
          scopeFingerprint: await jevScopeHash(state.db.tables.attorney_client_links[0]),
        },
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(state.passwordCheck).not.toHaveBeenCalled();
  });
  it("never enables after a failed authorization lookup", async () => {
    state.failAuth = true;
    await expect(
      setMyJevSharePermission({
        data: {
          linkId,
          enabled: true,
          scopeFingerprint: await jevScopeHash(state.db.tables.attorney_client_links[0]),
        },
      }),
    ).rejects.toThrow("check your account");
    expect(state.db.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
});

describe("local retrieval", () => {
  it("doesn't match substrings inside unrelated words", async () => {
    expect(
      await rankJevSource(
        { ...file(), extracted_text: "A different document" },
        requestTerms("rent"),
      ),
    ).toBeNull();
  });
  it("fingerprints change when analyzed text changes", async () => {
    expect(await jevFingerprint(file())).not.toBe(
      await jevFingerprint({ ...file(), extracted_text: "changed" }),
    );
  });
});
