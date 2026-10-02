import { afterEach, describe, expect, it } from "vitest";
import {
  CANONICAL_PRODUCTION_SITE_ORIGIN,
  getEmailSiteOrigin,
  normalizeEmailSiteOrigin,
} from "@/lib/email/site-origin.server";

const ENV_KEYS = ["SITE_URL", "PUBLIC_SITE_URL"] as const;

afterEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

describe("normalizeEmailSiteOrigin", () => {
  it("rejects localhost and loopback (the production mailbox bug)", () => {
    expect(normalizeEmailSiteOrigin("http://localhost:8080")).toBeNull();
    expect(normalizeEmailSiteOrigin("http://127.0.0.1:8080")).toBeNull();
    expect(normalizeEmailSiteOrigin("http://0.0.0.0:3000")).toBeNull();
    expect(normalizeEmailSiteOrigin("https://app.localhost")).toBeNull();
  });

  it("forces https for pattern-proof.tech hosts", () => {
    expect(normalizeEmailSiteOrigin("http://pattern-proof.tech")).toBe(
      "https://pattern-proof.tech",
    );
    expect(normalizeEmailSiteOrigin("https://pattern-proof.tech/")).toBe(
      "https://pattern-proof.tech",
    );
  });

  it("allows non-local staging/preview origins", () => {
    expect(normalizeEmailSiteOrigin("https://staging.example.org/")).toBe(
      "https://staging.example.org",
    );
  });
});

describe("getEmailSiteOrigin", () => {
  it("falls back to canonical production when unset", () => {
    expect(getEmailSiteOrigin()).toBe(CANONICAL_PRODUCTION_SITE_ORIGIN);
  });

  it("prefers SITE_URL over PUBLIC_SITE_URL", () => {
    process.env.SITE_URL = "https://pattern-proof.tech";
    process.env.PUBLIC_SITE_URL = "https://other.example.org";
    expect(getEmailSiteOrigin()).toBe("https://pattern-proof.tech");
  });

  it("skips localhost SITE_URL and uses PUBLIC_SITE_URL when safe", () => {
    process.env.SITE_URL = "http://localhost:8080";
    process.env.PUBLIC_SITE_URL = "https://pattern-proof.tech";
    expect(getEmailSiteOrigin()).toBe("https://pattern-proof.tech");
  });

  it("never returns localhost when only localhost env is set", () => {
    process.env.SITE_URL = "http://localhost:8080";
    expect(getEmailSiteOrigin()).toBe(CANONICAL_PRODUCTION_SITE_ORIGIN);
  });
});
