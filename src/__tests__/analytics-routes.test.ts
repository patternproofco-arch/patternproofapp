import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GA_REPORTABLE_PATHS, isReportablePath, isReportableRoute } from "@/lib/ga-routes";
import { readGeneratedRoutes, readRouteIdToFullPath } from "./helpers/route-tree";

const { ids, fullPaths } = readGeneratedRoutes();
const idToFullPath = readRouteIdToFullPath();

/** Portal, invite, prep, org, demo, auth, token routes — the Guardian's private set. */
const PRIVATE_ROUTE =
  /^\/_(authenticated|attorney|advocate)(\/|$)|^\/(auth|attorney|advocate|org|prep|demo|sample-case|mfa|capture|intake|review|connect|team-invite)|invite|\$|^\/(signin|signup|login|lawyer-signup|forgot-password|reset-password|choose-role|support|unsubscribe)$/;

describe("analytics only counts the public site (allowlist, fail closed)", () => {
  it("route tree was read", () => {
    expect(ids.length).toBeGreaterThan(100);
    expect(fullPaths.length).toBeGreaterThan(100);
    expect(idToFullPath.size).toBeGreaterThan(100);
  });

  it("counts the public marketing and legal pages", () => {
    for (const r of [
      "/",
      "/pricing",
      "/how-it-works",
      "/for-attorneys",
      "/for-organizations",
      "/privacy",
      "/terms",
      "/safety",
    ]) {
      expect(isReportableRoute(r)).toBe(true);
      expect(isReportablePath(r)).toBe(true);
    }
  });

  it("every allowlisted page is a real route (no typos that silently drop pages)", () => {
    for (const p of GA_REPORTABLE_PATHS) expect(ids).toContain(p);
  });

  it("the only reportable route ids are exactly the allowlist", () => {
    const reportable = ids.filter((id) => isReportableRoute(id)).sort();
    expect(reportable).toEqual([...GA_REPORTABLE_PATHS].sort());
  });

  it("every _authenticated / attorney / advocate / org / prep / invite / demo / auth route is non-reportable (enumerated from routeTree.gen.ts)", () => {
    const privateIds = ids.filter((id) => PRIVATE_ROUTE.test(id));
    expect(privateIds.length).toBeGreaterThan(80);
    for (const id of privateIds) {
      expect({ id, reportable: isReportableRoute(id) }).toEqual({ id, reportable: false });
      const full = idToFullPath.get(id);
      // Pathless layout routes (/_attorney etc.) have fullPath "/" and never render as a leaf.
      if (full && full !== "/") {
        expect({ full, reportable: isReportablePath(full) }).toEqual({ full, reportable: false });
      }
    }
    const privatePaths = fullPaths.filter((p) => PRIVATE_ROUTE.test(p));
    for (const p of privatePaths) {
      expect({ p, reportable: isReportablePath(p) }).toEqual({ p, reportable: false });
    }
  });

  it("concrete private URLs (with real-looking tokens and ids) are non-reportable", () => {
    for (const p of [
      "/dashboard",
      "/journal",
      "/court-packet",
      "/share-with-attorney",
      "/binder/3f1c2a/frequency/9",
      "/clients/abc",
      "/advocate-cases/abc",
      "/prep/modules/intro",
      "/survivor-invite/tok_123",
      "/attorney/tok_123",
      "/review/tok_123",
      "/org-portal",
      "/demo",
      "/signin",
      "/auth/callback",
      "/subscribe",
      "/contribute",
    ]) {
      expect({ p, r: isReportablePath(p) }).toEqual({ p, r: false });
    }
  });

  it("unknown and future routes are non-reportable", () => {
    for (const r of [
      "/new-feature",
      "/_authenticated/new",
      "/pricing-internal",
      "",
      "/_x",
      "/pricing?x",
    ]) {
      expect(isReportableRoute(r)).toBe(false);
    }
  });

  it("query strings and trailing slashes never change the decision", () => {
    expect(isReportablePath("/?ref=abc123")).toBe(true);
    expect(isReportablePath("/pricing/?utm=1#x")).toBe(true);
    expect(isReportablePath("/dashboard?from=/")).toBe(false);
  });

  it("the tracker uses the filter; no user id, query string or form values are sent; signals are off", () => {
    const ga = readFileSync(new URL("../lib/ga.tsx", import.meta.url), "utf8");
    expect(ga).toMatch(/isReportableRoute\(routeId\)/);
    expect(ga).toMatch(/send_page_view: false/);
    expect(ga).toMatch(/allow_google_signals: false/);
    expect(ga).toMatch(/allow_ad_personalization_signals: false/);
    expect(ga).not.toMatch(/user_id|userId|user\.id|user\.email/);
    expect(ga).not.toMatch(/location\.search|location\.href|\.search\b/);
  });

  it("the root shell never server-renders gtag.js or a gtag config call", () => {
    const root = readFileSync(new URL("../routes/__root.tsx", import.meta.url), "utf8");
    expect(root).not.toMatch(/googletagmanager\.com/);
    expect(root).not.toMatch(/gtag\(\s*['"]config/);
    expect(root).toMatch(/GA_GUARD_INLINE_SCRIPT/);
    // The guard must be the first head script.
    const scriptsAt = root.indexOf("scripts: [");
    expect(root.indexOf("GA_GUARD_INLINE_SCRIPT", scriptsAt)).toBeLessThan(
      root.indexOf("quickExitFallbackScript", scriptsAt),
    );
  });
});
