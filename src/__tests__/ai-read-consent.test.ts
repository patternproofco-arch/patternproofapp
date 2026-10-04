import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Three "Message threads" screens send a survivor's media to a third-party AI
 * service. Each must say so, offer the on-device alternative, and refuse to
 * upload until the survivor agrees. The privacy page must name the practice.
 */
const read = (p: string) => readFileSync(p, "utf8");
const notice = read("src/components/threads/AiReadNotice.tsx");
const screens: Array<[string, string]> = [
  ["ScreenshotStitcher", read("src/components/threads/ScreenshotStitcher.tsx")],
  ["CallLogPhotos", read("src/components/threads/CallLogPhotos.tsx")],
  ["ScreenRecordingUpload", read("src/components/threads/ScreenRecordingUpload.tsx")],
];
// JSX wraps prose across lines; compare on single-spaced text.
const privacy = read("src/routes/privacy.tsx").replace(/\s+/g, " ");

describe("AI-read screens ask first", () => {
  it("the notice names a third-party AI and points to the on-device import", () => {
    expect(notice).toMatch(/third-party AI/);
    expect(notice).toMatch(/Google or OpenAI/);
    expect(notice).toMatch(/to="\/import-messages"/);
  });

  for (const [name, src] of screens) {
    it(`${name} shows the notice and blocks the upload until it is accepted`, () => {
      expect(src).toMatch(/<AiReadNotice /);
      // the save handler bails out without consent...
      expect(src).toMatch(/if \(![^)]*\|\| !(accepted|aiAccepted)\) return;/);
      // ...and the upload button is disabled without it.
      expect(src).toMatch(/disabled=\{[^}]*!(accepted|aiAccepted)[^}]*\}/);
    });
  }

  it("the privacy page says screenshots and call log photos are read by AI", () => {
    expect(privacy).toMatch(/screenshots and call log photos/);
    expect(privacy).toMatch(/sends nothing to an AI provider/);
  });
});
