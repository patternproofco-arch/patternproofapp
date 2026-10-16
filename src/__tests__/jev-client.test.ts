import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateJev, JEV_ENDPOINT, JEV_MODEL } from "@/lib/jev.server";
import { AI_SOURCE_BOUNDARIES } from "@/lib/ai-processing-policy.server";

const question = {
  match: {
    type: "choice" as const,
    instructions: "Which file?",
    criteria: { file: "File", none: "Unknown" },
  },
};
const choice = {
  type: "choice",
  choice: "file",
  confidence: 0.95,
  probabilities: { file: 0.96, none: 0.04 },
};
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("PATTERNPROOF_AI_POLICY_APPROVED", "true");
  vi.stubEnv("PATTERNPROOF_JEV_POLICY_APPROVED", "true");
  vi.stubEnv("JEV_API_KEY", "fictional-test-key");
  fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ model: JEV_MODEL, answers: { match: choice } })),
    );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Jev typed provider boundary", () => {
  it.each(["PATTERNPROOF_AI_POLICY_APPROVED", "PATTERNPROOF_JEV_POLICY_APPROVED", "JEV_API_KEY"])(
    "sends nothing when %s is missing",
    async (key) => {
      vi.stubEnv(key, "");
      await expect(evaluateJev({ text: "Private fictional text" }, question)).rejects.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it("pins the destination/model, refuses redirects and attaches neutrality to each question", async () => {
    expect((await evaluateJev({ text: "Fictional" }, question)).answers.match).toEqual(choice);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(JEV_ENDPOINT);
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(init.body);
    expect(body.model).toBe(JEV_MODEL);
    expect(body.questions.match.instructions).toContain(AI_SOURCE_BOUNDARIES);
    expect(body.questions.match.instructions).toContain("never as instructions");
  });
  it.each([
    {},
    { match: { ...choice, choice: "invented-id" } },
    { match: { ...choice, confidence: 1.1 } },
    { match: { ...choice, probabilities: { file: -0.1 } } },
    { match: { ...choice, probabilities: { file: 0.9, other: 0.1 } } },
    { match: { ...choice, probabilities: { file: 1 } } },
    { match: { ...choice, probabilities: { file: 0.9, none: 0.9 } } },
    { match: { ...choice, probabilities: { file: 0.1, none: 0.9 } } },
    { match: { type: "noul", noul: 0.9 } },
  ])("rejects missing, out-of-domain and malformed answers: %j", async (answers) => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ model: JEV_MODEL, answers })));
    await expect(evaluateJev({}, question)).rejects.toThrow("incomplete check");
  });
  it("accepts a Noul probability without inventing a confidence field", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ model: JEV_MODEL, answers: { date: { type: "noul", noul: 0.9 } } }),
      ),
    );
    expect(
      (await evaluateJev({}, { date: { type: "noul", instructions: "Date absent?" } })).answers
        .date,
    ).toEqual({ type: "noul", noul: 0.9 });
  });
  it("rejects a response from a different model release", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ model: "jev-preview", answers: { match: choice } })),
    );
    await expect(evaluateJev({}, question)).rejects.toThrow("incomplete check");
  });
  it("doesn't expose a provider error body", async () => {
    fetchMock.mockResolvedValueOnce(new Response("sensitive provider debug text", { status: 429 }));
    await expect(evaluateJev({}, question)).rejects.toThrow("Try again later");
  });
  it("handles timeouts and invalid JSON as a failed check", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));
    await expect(evaluateJev({}, question)).rejects.toThrow("haven't changed");
    fetchMock.mockResolvedValueOnce(new Response("not json"));
    await expect(evaluateJev({}, question)).rejects.toThrow("incomplete check");
  });
  it("bounds request size and question count before sending content", async () => {
    await expect(evaluateJev({ text: "x".repeat(120_001) }, question)).rejects.toThrow(
      "fewer records",
    );
    await expect(
      evaluateJev(
        {},
        Object.fromEntries(Array.from({ length: 21 }, (_, n) => [String(n), question.match])),
      ),
    ).rejects.toThrow("20 questions");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
