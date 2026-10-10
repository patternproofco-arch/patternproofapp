import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

/**
 * The outside-assistant (MCP) tools act as the survivor, so they must keep the app's own
 * promises: what she marked "no AI" stays out, and what an assistant writes is never
 * recorded as her own words.
 */
const tool = (n: string) => readFileSync(`src/lib/mcp/tools/${n}.ts`, "utf8");
const shared = readFileSync("src/lib/mcp/supabase.ts", "utf8");

describe("outside assistant tools", () => {
  it("leave out anything marked no-AI", () => {
    expect(shared).toMatch(/AI_BLOCKED = "\(none,denied\)"/);
    for (const n of ["list-incidents", "list-evidence"]) {
      expect(tool(n)).toMatch(/\.not\("ai_permission", "in", AI_BLOCKED\)/);
    }
    // search covers incidents and evidence; both must be filtered.
    const found = tool("search").match(/\.not\("ai_permission", "in", AI_BLOCKED\)/g) ?? [];
    expect(found).toHaveLength(2);
  });

  it("records what an assistant writes as AI-extracted and unconfirmed", () => {
    const src = tool("create-incident");
    expect(src).toMatch(/source: "ai_extracted"/);
    expect(src).toMatch(/confirmed_at: null/);
    expect(src).not.toMatch(/source: "survivor"/);
    expect(src).toMatch(/unconfirmed/);
  });

  it("bounds what an assistant can write", () => {
    const src = tool("create-incident");
    expect(src).toMatch(/\.regex\(\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\)/);
    expect(src).toMatch(/description:[\s\S]*\.max\(5000\)/);
    expect(src).toMatch(/\.max\(10\)/);
  });

  it("every tool leaves a trace the survivor can see, counts only", () => {
    for (const n of ["list-incidents", "list-evidence", "search", "create-incident"]) {
      expect(tool(n)).toMatch(/recordMcpCall\(ctx,/);
    }
    expect(shared).toMatch(/mcp\.tool_called/);
    expect(shared).toMatch(/p_actor_kind: "ai"/);
    // A logging failure must never break a tool.
    expect(shared).toMatch(/catch \{\s*\/\* best effort \*\/\s*\}/);
  });

  it("tools do not hand raw database error text to the outside app", () => {
    for (const n of ["list-incidents", "list-evidence", "create-incident"]) {
      expect(tool(n)).not.toMatch(/text: error\.message/);
    }
  });
});
