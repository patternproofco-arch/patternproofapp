import { describe, expect, it, vi } from "vitest";
import { requireAuth, supabaseForUser } from "@/lib/mcp/supabase";
import type { ToolContext } from "@lovable.dev/mcp-js";
describe("external app release pause", () => {
  it("denies authenticated tools and direct helper access without reading a token", () => {
    const ctx = { isAuthenticated: () => true, getToken: vi.fn() } as unknown as ToolContext;
    expect(requireAuth(ctx)?.isError).toBe(true);
    expect(requireAuth(ctx)?.content[0].text).toContain("paused");
    expect(() => supabaseForUser(ctx)).toThrow("paused");
    expect(ctx.getToken).not.toHaveBeenCalled();
  });
  it("still denies an unauthenticated request", () => {
    const ctx = { isAuthenticated: () => false } as ToolContext;
    expect(requireAuth(ctx)?.content[0].text).toBe("Not authenticated.");
  });
});
