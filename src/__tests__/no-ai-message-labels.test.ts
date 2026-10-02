import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Survivor messages are never characterised by software. Courts discard
 * behaviour labels from tools, and an attorney who sees "high severity
 * harassment" beside a client's texts is being handed a conclusion nobody
 * verified. Earlier imports stored AI summaries / flags / exhibit labels on
 * message_threads; those must not be shown to the survivor or an attorney.
 */
const attorneyClient = readFileSync("src/routes/_attorney/clients.$clientId.tsx", "utf8");
const attorneyApi = readFileSync("src/lib/attorney-portal.functions.ts", "utf8");
const survivorThreads = readFileSync("src/routes/_authenticated/message-threads.tsx", "utf8");

/** The attorney server function that lists a client's message threads. */
const listClientThreads = attorneyApi.slice(attorneyApi.indexOf("export const listClientThreads"));
const threadSelect = listClientThreads.slice(0, listClientThreads.indexOf(".eq("));

describe("stored AI labels on message threads are not displayed", () => {
  it("attorney thread list does not fetch AI summary, flags or exhibit label", () => {
    expect(threadSelect).toMatch(/message_threads/);
    for (const col of ["summary", "attorney_summary", "flags", "exhibit_label"]) {
      expect(threadSelect).not.toMatch(new RegExp(`[,"]${col}[,"]`));
    }
  });

  it("attorney thread viewer shows no AI summary or flagged passages", () => {
    expect(attorneyClient).not.toMatch(/Flagged passages/);
    expect(attorneyClient).not.toMatch(/attorney_summary/);
    expect(attorneyClient).not.toMatch(/function toFlags/);
  });

  it("survivor thread card shows no AI summary, flags or label", () => {
    expect(survivorThreads).not.toMatch(/Flags & patterns/);
    expect(survivorThreads).not.toMatch(/Summary for professional review/);
    expect(survivorThreads).not.toMatch(/\{t\.(summary|attorney_summary|exhibit_label)\}/);
    expect(survivorThreads).not.toMatch(/t\.flags\.map/);
  });
});
