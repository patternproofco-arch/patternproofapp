import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: { from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (x: any) => x;
    const b = {
      middleware: () => b,
      inputValidator: (fn: any) => {
        validate = fn;
        return b;
      },
      handler: (fn: any) => async (args: any) =>
        fn({ data: validate(args.data), context: { userId: "alice", supabase: state.db } }),
    };
    return b;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
import {
  stitchScreenshotThread,
  parseCallLogPhotos,
  transcribeRecordedThread,
  ingestRecordedThread,
} from "@/lib/message-threads.functions";
const cases = [
  [stitchScreenshotThread, { screenshotPaths: ["alice/a.png"] }],
  [parseCallLogPhotos, { photoPaths: ["alice/a.png"] }],
  [transcribeRecordedThread, { threadId: "12345678-1234-4234-8234-123456789012" }],
] as const;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
  vi.stubEnv("PATTERNPROOF_AI_PROVIDER_REVIEWED", "true");
  vi.stubEnv(
    "PATTERNPROOF_AI_ENABLED_FEATURES",
    "thread-screenshots,thread-call-photos,thread-recording",
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("thread endpoints enforce consent before I/O", () => {
  for (const [fn, data] of cases) {
    it.each([undefined, false, "true"])(
      "rejects missing or forged request consent",
      async (consent) => {
        await expect(
          (fn as any)({ data: { ...data, allowThirdPartyAi: consent } }),
        ).rejects.toThrow();
        expect(state.db.from).not.toHaveBeenCalled();
        expect(state.db.storage.from).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
      },
    );
    it("release pause precedes every database and provider operation", async () => {
      vi.stubEnv("PATTERNPROOF_AI_PROVIDER_REVIEWED", "false");
      await expect((fn as any)({ data: { ...data, allowThirdPartyAi: true } })).rejects.toThrow(
        "AI processing is paused",
      );
      expect(state.db.from).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });
  }
  it("another account's paths are rejected even with consent", async () => {
    await expect(
      stitchScreenshotThread({ data: { screenshotPaths: ["bob/a.png"], allowThirdPartyAi: true } }),
    ).rejects.toThrow("not owned");
    await expect(
      parseCallLogPhotos({
        data: { photoPaths: ["bob/a.png"], allowThirdPartyAi: true, platform: "unknown" },
      }),
    ).rejects.toThrow("not owned");
    await expect(
      ingestRecordedThread({ data: { videoPath: "bob/a.mp4", filename: "a.mp4" } }),
    ).rejects.toThrow("not owned");
    expect(state.db.from).not.toHaveBeenCalled();
    expect(state.db.storage.from).not.toHaveBeenCalled();
  });
});
