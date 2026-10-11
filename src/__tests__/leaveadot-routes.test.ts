import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shouldLoadLeaveADot } from "@/lib/leaveadot-routes";
import { PUBLIC_MARKETING_PATHS } from "@/lib/public-routes";
import { readGeneratedRoutes } from "./helpers/route-tree";

describe("Leave a Dot only on public marketing pages (shared fail-closed allowlist)", () => {
  it("loads on the public home and core marketing/legal paths", () => {
    for (const path of [
      "/",
      "/pricing",
      "/pricing/",
      "/how-it-works",
      "/for-attorneys",
      "/for-organizations",
      "/safety",
      "/privacy",
      "/terms",
      "/resources",
    ]) {
      expect(shouldLoadLeaveADot(path)).toBe(true);
    }
  });

  it("does not load on sign-in/sign-up forms, the demo walkthrough, or support form", () => {
    for (const path of [
      "/signin",
      "/signup",
      "/login",
      "/demo",
      "/support",
      "/lawyer-signup",
      "/org-signup",
    ]) {
      expect(shouldLoadLeaveADot(path)).toBe(false);
    }
  });

  it("does not load on authenticated survivor screens", () => {
    for (const path of [
      "/journal",
      "/evidence",
      "/dashboard",
      "/share-with-attorney",
      "/court-packet",
      "/settings",
      "/onboarding",
      "/case",
      "/timeline",
    ]) {
      expect(shouldLoadLeaveADot(path)).toBe(false);
    }
  });

  it("does not load on attorney or advocate portal paths", () => {
    for (const path of [
      "/clients",
      "/clients/abc",
      "/caseload",
      "/matters/xyz",
      "/binder/abc",
      "/advocate-cases",
      "/advocate-cases/abc",
      "/advocate-matters",
      "/setup",
      "/billing",
      "/subscribe",
    ]) {
      expect(shouldLoadLeaveADot(path)).toBe(false);
    }
  });

  it("does not load on invite, shared-record, or recovery flows", () => {
    for (const path of [
      "/survivor-invite/tok",
      "/advocate-survivor-invite/tok",
      "/accept-invite/tok",
      "/attorney/tok",
      "/review/tok",
      "/matter-invite/tok",
      "/collaborator-invite/tok",
      "/advocate-invite/tok",
      "/forgot-password",
      "/reset-password",
      "/capture",
      "/intake",
      "/mfa",
    ]) {
      expect(shouldLoadLeaveADot(path)).toBe(false);
    }
  });

  it("loads on exactly the shared allowlist, for every route in routeTree.gen.ts", () => {
    const { fullPaths } = readGeneratedRoutes();
    const loading = fullPaths
      .map((p) => p.replace(/\$[A-Za-z]+/g, "x1"))
      .filter((p) => shouldLoadLeaveADot(p));
    expect(new Set(loading)).toEqual(new Set(PUBLIC_MARKETING_PATHS));
  });

  it("root uses the path-gated loader and does not inject Leave a Dot in the shell", () => {
    const root = readFileSync(new URL("../routes/__root.tsx", import.meta.url), "utf8");
    expect(root).toContain("LeaveADotLoader");
    expect(root).not.toMatch(/src=["']https:\/\/app\.leaveadot\.com\/dot\.js["']/);
  });

  it("loader still points at the Leave a Dot project script", () => {
    const loader = readFileSync(
      new URL("../components/LeaveADotLoader.tsx", import.meta.url),
      "utf8",
    );
    expect(loader).toContain("LEAVE_A_DOT_SCRIPT_SRC");
    expect(loader).toContain("shouldLoadLeaveADot");
    const routes = readFileSync(new URL("../lib/leaveadot-routes.ts", import.meta.url), "utf8");
    expect(routes).toContain("https://app.leaveadot.com/dot.js");
    expect(routes).toContain("proj_ydd514h48rz0");
  });
});
