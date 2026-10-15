import { describe, expect, it } from "vitest";
import { NAV_TABS, navTabFor, segmentsFor } from "@/lib/nav-tabs";

describe("survivor bottom nav", () => {
  it("has four tabs: Home, Notes, Timeline, Sharing", () => {
    expect(NAV_TABS.map((t) => t.label)).toEqual(["Home", "Notes", "Timeline", "Sharing"]);
  });
  it.each([
    ["/dashboard", "home"],
    ["/journal", "notes"],
    ["/drafts", "notes"],
    ["/evidence", "notes"],
    ["/voice-notes", "notes"],
    ["/message-threads", "notes"],
    ["/timeline", "timeline"],
    ["/calendar", "timeline"],
    ["/patterns", "timeline"],
    ["/access", "sharing"],
    ["/requests", "sharing"],
    ["/case", "sharing"],
    ["/court-packet", "sharing"],
    ["/share-with-attorney", "sharing"],
  ])("old route %s highlights %s", (path, tab) => {
    expect(navTabFor(path)).toBe(tab);
  });
  it("Resources is not a tab", () => {
    expect(navTabFor("/resources")).toBeUndefined();
  });
  it("segments appear only on the pages they switch between", () => {
    expect(segmentsFor("/journal")?.map((s) => s.label)).toEqual(["Notes", "Drafts", "Files"]);
    expect(segmentsFor("/calendar")?.map((s) => s.label)).toEqual(["List", "Calendar", "Patterns"]);
    expect(segmentsFor("/voice-notes")).toBeUndefined();
  });
  it("never labels anything court-ready", () => {
    const labels = JSON.stringify([NAV_TABS, segmentsFor("/access")]);
    expect(labels).not.toMatch(/court[- ]ready/i);
  });
});
