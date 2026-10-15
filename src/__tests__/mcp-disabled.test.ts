import { readFileSync } from "fs";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The remote MCP surface is switched off (fail-closed 404) until the reviewed
 * read-only design ships. Nothing behind the gate (auth, metadata, tools) may load.
 */
vi.mock("@lovable.dev/mcp-js/stacks/tanstack", () => {
  throw new Error("mcp-js must not load while MCP is disabled");
});
vi.mock("@/lib/mcp/index", () => {
  throw new Error("MCP tools must not load while MCP is disabled");
});

type Handler = (ctx: { request: Request }) => Promise<Response>;
async function handlerOf(path: string): Promise<Handler> {
  const mod = await import(/* @vite-ignore */ path);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (mod.Route as any).options.server.handlers.ANY as Handler;
}

const ROUTES: [string, string][] = [
  ["/mcp", "../routes/mcp"],
  ["/.well-known/oauth-protected-resource", "../routes/[.well-known]/oauth-protected-resource"],
  ["/.mcp/list-tools", "../routes/[.mcp]/list-tools"],
  ["/.mcp/invoke-tool/list_incidents", "../routes/[.mcp]/invoke-tool/$tool"],
];

afterEach(() => {
  delete process.env.MCP_ENABLED;
});

describe("MCP is disabled by default", () => {
  for (const [url, file] of ROUTES) {
    for (const method of ["GET", "POST"]) {
      it(`${method} ${url} -> 404 with no auth challenge`, async () => {
        const h = await handlerOf(file);
        const init: RequestInit = { method };
        if (method === "POST") {
          init.body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" });
          init.headers = { "content-type": "application/json", authorization: "Bearer x" };
        }
        const res = await h({ request: new Request(`https://pattern-proof.tech${url}`, init) });
        expect(res.status).toBe(404);
        expect(res.headers.get("www-authenticate")).toBeNull();
        expect(await res.text()).not.toMatch(/authorization_servers|supabase/i);
      });
    }
  }

  it("stays closed for any value other than exactly 'true'", async () => {
    const h = await handlerOf("../routes/mcp");
    for (const v of ["1", "TRUE", "yes", " true", ""]) {
      process.env.MCP_ENABLED = v;
      const res = await h({ request: new Request("https://pattern-proof.tech/mcp") });
      expect(res.status).toBe(404);
    }
  });

  it("the Vite plugin that regenerates un-gated routes is gone", () => {
    expect(readFileSync("vite.config.ts", "utf8")).not.toMatch(/mcpPlugin\(/);
  });

  it("the timeline-writing tool is not registered", () => {
    expect(readFileSync("src/lib/mcp/index.ts", "utf8")).not.toMatch(/createIncident/);
  });
});
