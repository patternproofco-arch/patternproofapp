import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shouldLoadLeaveADot } from "@/lib/leaveadot-routes";

describe("Leave a Dot only on public marketing pages", () => {
  it("loads on the public home and core marketing paths", () => {
    for (const path of [
      "/",
      "/pricing",
      "/how-it-works",
      "/for-attorneys",
      "/for-organizations",
      "/safety",
      "/privacy",
      "/terms",
      "/demo",
      "/resources",
    ]) {
      expect(shouldLoadLeaveADot(path)).toBe(true);
    }
  });

  it("does not load where someone types a password, an email or a message", () => {
    for (const path of [
      "/signin",
      "/signup",
      "/login",
      "/lawyer-signup",
      "/org-signup",
      "/support",
      "/org-feedback",
      "/partner-access",
      "/triage",
      "/unsubscribe",
    ]) {
      expect(shouldLoadLeaveADot(path)).toBe(false);
    }
  });

  it("is removed with a fresh page load when someone leaves for a page where it must not run", () => {
    const loader = readFileSync(new URL("../components/LeaveADotLoader.tsx", import.meta.url), "utf8");
    expect(loader).toMatch(/loadedInThisPage/);
    expect(loader).toMatch(/window\.location\.reload\(\)/);
  });

  it("does not load on authenticated survivor screens", () => {
    for (const path of [
      "/journal",
      "/evidence",
      "/dashboard",
      "/entries",
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

  it("root uses the path-gated loader and does not inject Leave a Dot in the shell", () => {
    const root = readFileSync(new URL("../routes/__root.tsx", import.meta.url), "utf8");
    expect(root).toContain("LeaveADotLoader");
    expect(root).not.toMatch(/src=["']https:\/\/app\.leaveadot\.com\/dot\.js["']/);
  });

  it("loader still points at the Leave a Dot project script", () => {
    const loader = readFileSync(new URL("../components/LeaveADotLoader.tsx", import.meta.url), "utf8");
    expect(loader).toContain("LEAVE_A_DOT_SCRIPT_SRC");
    expect(loader).toContain("shouldLoadLeaveADot");
    const routes = readFileSync(new URL("../lib/leaveadot-routes.ts", import.meta.url), "utf8");
    expect(routes).toContain("https://app.leaveadot.com/dot.js");
    expect(routes).toContain("proj_ydd514h48rz0");
  });
});
