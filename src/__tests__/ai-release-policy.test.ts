import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAiGateway, isAiFeatureReleased } from "@/lib/ai-release-policy.server";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
beforeEach(() => {
  vi.stubEnv("PATTERNPROOF_AI_PROVIDER_REVIEWED", "false");
  vi.stubEnv("PATTERNPROOF_AI_ENABLED_FEATURES", "");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}")),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("AI runtime release boundary", () => {
  it("default configuration cannot send content", async () => {
    expect(
      (
        await fetchAiGateway("document-text", "chat/completions", {
          method: "POST",
          body: "private synthetic text",
        })
      ).status,
    ).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("a provider review alone does not release a feature", () => {
    vi.stubEnv("PATTERNPROOF_AI_PROVIDER_REVIEWED", "true");
    expect(isAiFeatureReleased("document-text")).toBe(false);
  });
  it.each(["*", "unreviewed-sdk", "propose-timeline", "transcribe-evidence", "ai-chat"])(
    "cannot enable unreviewed scope %s through configuration",
    async (feature) => {
      vi.stubEnv("PATTERNPROOF_AI_PROVIDER_REVIEWED", "true");
      vi.stubEnv("PATTERNPROOF_AI_ENABLED_FEATURES", feature);
      expect(isAiFeatureReleased(feature)).toBe(false);
      expect(
        (await fetchAiGateway(feature, "chat/completions", { body: "synthetic text" })).status,
      ).toBe(503);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it("a reviewed and explicitly released scope uses the fixed host with redirects blocked", async () => {
    vi.stubEnv("PATTERNPROOF_AI_PROVIDER_REVIEWED", "true");
    vi.stubEnv("PATTERNPROOF_AI_ENABLED_FEATURES", " document-text ");
    await fetchAiGateway("document-text", "chat/completions", {
      method: "POST",
      body: "synthetic text",
      redirect: "follow",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      expect.objectContaining({ redirect: "error" }),
    );
  });
  it("the SDK route cannot bypass the release boundary", () => {
    vi.stubEnv("PATTERNPROOF_AI_PROVIDER_REVIEWED", "true");
    vi.stubEnv("PATTERNPROOF_AI_ENABLED_FEATURES", "unreviewed-sdk");
    expect(() => createLovableAiGatewayProvider("synthetic-key")).toThrow(
      "AI processing is paused",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
