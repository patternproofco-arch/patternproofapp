import { describe, expect, it } from "vitest";
import { verifyPublishedSource } from "../../scripts/verify-published-source.mjs";

const digest = "a".repeat(64);
const marker = {
  source_digest: digest,
  source_digest_algorithm: "patternproof-source-v1-sha256",
  commit: "unknown",
  commit_source: "unavailable",
  build_id: "abc123abc123",
  built_at: "2026-10-12T00:00:00.000Z",
};

describe("published source verification", () => {
  it("verifies matching source even when the host has no git metadata", () => {
    expect(verifyPublishedSource(marker, digest)).toMatchObject({
      source_digest: digest,
      commit: "unknown",
    });
  });
  it("refuses old builds, different source and unsupported fingerprint methods", () => {
    expect(() => verifyPublishedSource({}, digest)).toThrow("no supported source digest");
    expect(() => verifyPublishedSource(marker, "b".repeat(64))).toThrow("differs");
    expect(() =>
      verifyPublishedSource({ ...marker, source_digest_algorithm: "another" }, digest),
    ).toThrow("no supported");
  });
  it("refuses fabricated commit values and malformed build metadata", () => {
    expect(() => verifyPublishedSource({ ...marker, commit: "lagging-stamp" }, digest)).toThrow(
      "commit metadata",
    );
    expect(() => verifyPublishedSource({ ...marker, built_at: "invalid" }, digest)).toThrow(
      "build instance",
    );
  });
});
