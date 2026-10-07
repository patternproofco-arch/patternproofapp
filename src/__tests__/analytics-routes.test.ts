import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isReportableRoute } from "@/lib/ga-routes";

describe("analytics only counts the public site", () => {
  it("counts public pages", () => {
    for (const r of ["/", "/pricing", "/how-it-works", "/for-attorneys", "/privacy", "/terms", "/safety", "/signin", "/signup"]) {
      expect(isReportableRoute(r)).toBe(true);
    }
  });

  it("never reports anything a signed-in person does, in any portal", () => {
    for (const r of [
      "/_authenticated/journal",
      "/_authenticated/share-with-attorney",
      "/_authenticated/court-packet",
      "/_attorney/clients/$clientId",
      "/_advocate/advocate-cases/$clientId",
    ]) {
      expect(isReportableRoute(r)).toBe(false);
    }
  });

  it("never reports invitation, review or recovery pages, or the pre-signup capture", () => {
    for (const r of [
      "/survivor-invite/$token",
      "/advocate-survivor-invite/$token",
      "/accept-invite/$token",
      "/attorney/$token",
      "/review/$token",
      "/forgot-password",
      "/reset-password",
      "/capture",
      "/mfa",
    ]) {
      expect(isReportableRoute(r)).toBe(false);
    }
  });

  it("never reports the fictional /demo/* sub-portals, so typed practice text can't reach analytics", () => {
    for (const r of ["/demo_/attorney", "/demo_/org", "/demo_/prep"]) {
      expect(isReportableRoute(r)).toBe(false);
    }
    expect(readFileSync(new URL("../lib/ga-routes.ts", import.meta.url), "utf8")).toContain('"/demo_"');
    // The tracker only ever sends the route id and document title, never form values.
    const ga = readFileSync(new URL("../lib/ga.tsx", import.meta.url), "utf8");
    expect(ga).not.toMatch(/\.value\b|textarea|FormData/);
  });

  it("the tracker uses the filter, and ad personalization signals are off", () => {
    expect(readFileSync(new URL("../lib/ga.tsx", import.meta.url), "utf8")).toMatch(/isReportableRoute\(routeId\)/);
    const root = readFileSync(new URL("../routes/__root.tsx", import.meta.url), "utf8");
    expect(root).toMatch(/allow_google_signals: false/);
    expect(root).toMatch(/allow_ad_personalization_signals: false/);
  });
});
