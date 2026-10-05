import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * getMyUnreadCounts previously selected status=active only, so a revoked_at
 * half-state (or expired window) could still inflate survivor unread badges.
 */
const src = readFileSync(resolve("src/lib/attorney-portal.functions.ts"), "utf8");
const block = src.slice(src.indexOf("export const getMyUnreadCounts"));

describe("getMyUnreadCounts honour revoked and expired shares", () => {
  it("selects revoked_at/expires_at and filters with isActiveShareLink", () => {
    expect(block).toContain("revoked_at");
    expect(block).toContain("expires_at");
    expect(block).toContain('.is("revoked_at", null)');
    expect(block).toContain("isActiveShareLink");
  });

  it("does not count from a status-active-only link query", () => {
    const selectBlock = block.slice(
      block.indexOf('.from("attorney_client_links")'),
      block.indexOf("const counts"),
    );
    expect(selectBlock).toContain('.eq("status", "active")');
    expect(selectBlock).toContain('.is("revoked_at", null)');
    expect(selectBlock).toContain("isActiveShareLink");
  });
});
