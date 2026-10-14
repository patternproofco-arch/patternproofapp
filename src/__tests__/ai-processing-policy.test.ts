import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_SOURCE_BOUNDARIES, fetchReviewedAi } from "@/lib/ai-processing-policy.server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("external AI processing policy", () => {
  it.each([undefined, "", "false", "1", "TRUE"])(
    "sends no material when approval is %s",
    async (value) => {
      vi.stubEnv("PATTERNPROOF_AI_POLICY_APPROVED", value);
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      await expect(
        fetchReviewedAi("https://ai.gateway.lovable.dev/v1/chat/completions", {
          body: JSON.stringify({
            messages: [{ role: "user", content: "Fictional private account" }],
          }),
        }),
      ).rejects.toThrow(/manually/);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("enforces source boundaries on an explicitly enabled gateway request", async () => {
    vi.stubEnv("PATTERNPROOF_AI_POLICY_APPROVED", "true");
    const fetch = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    await fetchReviewedAi("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: "Fictional text" }] }),
    });
    const sent = JSON.parse(fetch.mock.calls[0][1].body);
    expect(sent.messages[0]).toEqual({ role: "system", content: AI_SOURCE_BOUNDARIES });
    expect(sent.messages[1].content).toBe("Fictional text");
  });

  it("refuses other destinations even when the host approved processing", async () => {
    vi.stubEnv("PATTERNPROOF_AI_POLICY_APPROVED", "true");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(fetchReviewedAi("https://example.invalid/collect")).rejects.toThrow(/destination/);
    expect(fetch).not.toHaveBeenCalled();
  });
});
