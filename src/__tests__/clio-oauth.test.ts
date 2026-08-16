import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { checkClioState } from "@/lib/clio-state";

const FUTURE = () => new Date(Date.now() + 60_000).toISOString();
const PAST = () => new Date(Date.now() - 60_000).toISOString();

describe("clio oauth state validation", () => {
  it("accepts a fresh state owned by a user", () => {
    const r = checkClioState({ state: "abc", user_id: "u1", expires_at: FUTURE() }, "abc");
    expect(r).toEqual({ ok: true, userId: "u1" });
  });

  it("rejects a replayed (already consumed) state — the row is gone", () => {
    expect(checkClioState(null, "abc")).toEqual({ ok: false, reason: "missing" });
  });

  it("rejects an expired state", () => {
    const r = checkClioState({ state: "abc", user_id: "u1", expires_at: PAST() }, "abc");
    expect(r).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a state value that does not match the stored row", () => {
    const r = checkClioState({ state: "abc", user_id: "u1", expires_at: FUTURE() }, "other");
    expect(r).toEqual({ ok: false, reason: "mismatch" });
  });
});

describe("clio token encryption", () => {
  beforeEach(() => {
    process.env.CLIO_TOKEN_ENC_KEY = "test-key-for-unit-tests-only";
  });

  it("round-trips a token and never stores it in the clear", async () => {
    const { encryptToken, decryptToken } = await import("@/lib/clio-crypto.server");
    const stored = encryptToken("clio-access-token-123");
    expect(stored).not.toContain("clio-access-token-123");
    expect(stored.startsWith("v1:")).toBe(true);
    expect(decryptToken(stored)).toBe("clio-access-token-123");
  });

  it("produces different ciphertext for the same token (random IV)", async () => {
    const { encryptToken } = await import("@/lib/clio-crypto.server");
    expect(encryptToken("same")).not.toBe(encryptToken("same"));
  });

  it("refuses tampered ciphertext", async () => {
    const { encryptToken, decryptToken } = await import("@/lib/clio-crypto.server");
    const stored = encryptToken("token");
    const tampered = "v1:" + Buffer.from(
      Buffer.from(stored.slice(3), "base64").map((b, i) => (i === 30 ? b ^ 0xff : b)),
    ).toString("base64");
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("cannot decrypt with a different key (token storage is key-isolated)", async () => {
    const { encryptToken } = await import("@/lib/clio-crypto.server");
    const stored = encryptToken("token");
    vi.resetModules();
    process.env.CLIO_TOKEN_ENC_KEY = "a-completely-different-key";
    const fresh = await import("@/lib/clio-crypto.server");
    expect(() => fresh.decryptToken(stored)).toThrow();
  });
});

describe("clio availability gating", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    vi.resetModules();
  });

  async function availability() {
    vi.resetModules();
    const m = await import("@/lib/clio.server");
    return m.clioAvailability();
  }

  it("is unavailable without credentials", async () => {
    delete process.env.CLIO_CLIENT_ID;
    delete process.env.CLIO_CLIENT_SECRET;
    expect(await availability()).toEqual({ available: false, reason: "missing_credentials" });
  });

  it("is unavailable without the token encryption key", async () => {
    process.env.CLIO_CLIENT_ID = "id";
    process.env.CLIO_CLIENT_SECRET = "secret";
    delete process.env.CLIO_TOKEN_ENC_KEY;
    expect(await availability()).toEqual({ available: false, reason: "missing_encryption_key" });
  });

  it("stays off until explicitly enabled, even with credentials present", async () => {
    process.env.CLIO_CLIENT_ID = "id";
    process.env.CLIO_CLIENT_SECRET = "secret";
    process.env.CLIO_TOKEN_ENC_KEY = "key";
    delete process.env.CLIO_INTEGRATION_ENABLED;
    expect(await availability()).toEqual({ available: false, reason: "not_enabled" });
  });

  it("becomes available only with everything configured", async () => {
    process.env.CLIO_CLIENT_ID = "id";
    process.env.CLIO_CLIENT_SECRET = "secret";
    process.env.CLIO_TOKEN_ENC_KEY = "key";
    process.env.CLIO_INTEGRATION_ENABLED = "true";
    expect(await availability()).toEqual({ available: true, reason: "ok" });
  });

  it.each(["true", "True", "TRUE", "  true  ", "\ttrue\n"])(
    "treats %j as enabled",
    async (flag) => {
      process.env.CLIO_CLIENT_ID = "id";
      process.env.CLIO_CLIENT_SECRET = "secret";
      process.env.CLIO_TOKEN_ENC_KEY = "key";
      process.env.CLIO_INTEGRATION_ENABLED = flag;
      expect(await availability()).toEqual({ available: true, reason: "ok" });
    },
  );

  it.each(["false", "False", "", "   ", "1", "yes", "truthy", "no"])(
    "treats %j as not enabled",
    async (flag) => {
      process.env.CLIO_CLIENT_ID = "id";
      process.env.CLIO_CLIENT_SECRET = "secret";
      process.env.CLIO_TOKEN_ENC_KEY = "key";
      process.env.CLIO_INTEGRATION_ENABLED = flag;
      expect(await availability()).toEqual({ available: false, reason: "not_enabled" });
    },
  );

  it("normalizer accepts only a normalized 'true'", async () => {
    const { clioIntegrationFlagEnabled } = await import("@/lib/clio.server");
    expect(clioIntegrationFlagEnabled("TRUE")).toBe(true);
    expect(clioIntegrationFlagEnabled(" True ")).toBe(true);
    expect(clioIntegrationFlagEnabled(undefined)).toBe(false);
    expect(clioIntegrationFlagEnabled(null)).toBe(false);
    expect(clioIntegrationFlagEnabled("true false")).toBe(false);
  });

  it("assertClioAvailable throws the user-facing gate message when off", async () => {
    delete process.env.CLIO_CLIENT_ID;
    vi.resetModules();
    const m = await import("@/lib/clio.server");
    expect(() => m.assertClioAvailable()).toThrow("Clio connection is not available yet.");
  });
});

describe("clio server surface", () => {
  const fns = readFileSync("src/lib/clio.functions.ts", "utf8");
  const callback = readFileSync("src/routes/integrations.clio.callback.ts", "utf8");
  const server = readFileSync("src/lib/clio.server.ts", "utf8");

  it("requires authentication on every Clio server function that touches a connection", () => {
    for (const name of ["startClioConnect", "getClioStatus", "disconnectClio", "listMyClioMatters"]) {
      const block = fns.slice(fns.indexOf(`export const ${name}`), fns.indexOf(`export const ${name}`) + 260);
      expect(block).toContain("requireSupabaseAuth");
    }
  });

  it("gates OAuth start and matter reads behind the availability check", () => {
    expect(fns).toContain("assertClioAvailable");
    expect(callback).toContain("clioAvailability().available");
  });

  it("consumes the state row before exchanging the code (single use)", () => {
    const deleteIdx = callback.indexOf('.delete().eq("state", state)');
    const exchangeIdx = callback.indexOf("exchangeCodeForTokens");
    expect(deleteIdx).toBeGreaterThan(-1);
    expect(deleteIdx).toBeLessThan(exchangeIdx);
  });

  it("returns an error redirect when Clio reports an OAuth error", () => {
    expect(callback).toContain('url.searchParams.get("error")');
  });

  it("never logs a code, token, or provider response body", () => {
    for (const src of [callback, server]) {
      for (const line of src.split("\n").filter((l) => l.includes("console."))) {
        expect(line).not.toMatch(/\bcode\b|access_token|refresh_token|res\.text|await res/);
      }
    }
  });

  it("marks a connection revoked when a token refresh is rejected", () => {
    const refreshBlock = server.slice(server.indexOf("getValidClioAccessToken"));
    expect(refreshBlock).toContain("revoked_at");
    expect(refreshBlock).toContain("return null");
  });

  it("disconnect revokes at Clio and then deletes the local row for that user only", () => {
    const block = fns.slice(fns.indexOf("export const disconnectClio"));
    const revokeIdx = block.indexOf("revokeClioToken");
    const deleteIdx = block.indexOf(".delete()");
    expect(revokeIdx).toBeGreaterThan(-1);
    expect(revokeIdx).toBeLessThan(deleteIdx);
    expect(block).toContain('.eq("user_id", context.userId)');
  });

  it("stores tokens encrypted, never in plaintext", () => {
    const block = server.slice(server.indexOf("export async function storeClioTokens"));
    expect(block).toContain("encryptToken(tokens.access_token)");
    expect(block).toContain("encryptToken(tokens.refresh_token as string)");
  });

  it("keeps Clio credentials out of any VITE_ (browser) variable", () => {
    expect(server).not.toMatch(/VITE_CLIO/);
    expect(readFileSync(".env.example", "utf8")).not.toMatch(/VITE_CLIO/);
  });
});

describe("clio document export surface", () => {
  const fns = readFileSync("src/lib/clio.functions.ts", "utf8");
  const docs = readFileSync("src/lib/clio-documents.server.ts", "utf8");
  const block = fns.slice(fns.indexOf("export const exportPacketToClioMatter"));

  it("requires auth, an attorney role, and the availability gate", () => {
    expect(block).toContain("requireSupabaseAuth");
    expect(block).toContain("assertClioAvailable");
    expect(block).toContain("resolveCallerRole");
  });

  it("requires the survivor's Clio sharing consent and an explicit matter link", () => {
    expect(block).toContain("clio_share_consent");
    expect(block).toContain("clio_matter_links");
    expect(block).toContain("matterLink.clio_matter_id !== data.matterId");
  });

  it("only reads export objects under the caller's own storage prefix", () => {
    expect(block).toContain("data.objectPath.startsWith(`${context.userId}/`)");
  });

  it("records the export attempt and only confirms after Clio confirms", () => {
    expect(block).toContain('status: "pending"');
    expect(block).toContain('status: "confirmed"');
    expect(block).toContain('status: "failed"');
  });

  it("finalizes the Clio upload before reporting success", async () => {
    const createIdx = docs.indexOf("/documents.json?fields=id");
    const putIdx = docs.indexOf("version.put_url, {");
    const patchIdx = docs.indexOf('method: "PATCH"');
    expect(createIdx).toBeLessThan(putIdx);
    expect(putIdx).toBeLessThan(patchIdx);
    expect(docs.indexOf("return { clioDocumentId")).toBeGreaterThan(patchIdx);
  });

  it("never logs provider bodies from the document path", () => {
    for (const line of docs.split("\n").filter((l) => l.includes("console."))) {
      expect(line).not.toMatch(/access_token|res\.text|await res|bytes/);
    }
  });

  it("maps Clio failures to plain, non-leaking messages", async () => {
    const { uploadMessage } = await import("@/lib/clio-documents.server");
    expect(uploadMessage(401)).toMatch(/Reconnect Clio/);
    expect(uploadMessage(403)).toMatch(/Documents \(write\)/);
    expect(uploadMessage(404)).toMatch(/couldn't find that matter/);
    expect(uploadMessage(429)).toMatch(/rate-limiting/);
    expect(uploadMessage(500)).toMatch(/Nothing was filed/);
  });

  it("does not claim a disconnect Clio didn't confirm", () => {
    const dc = fns.slice(fns.indexOf("export const disconnectClio"));
    expect(dc).toContain("still in place");
  });
});
