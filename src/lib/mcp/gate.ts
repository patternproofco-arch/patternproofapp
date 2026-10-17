/**
 * Kill switch for the remote MCP surface (/mcp, /.mcp/*, /.well-known/oauth-protected-resource*).
 *
 * Fail-closed: the MCP routes answer 404 unless the server env var MCP_ENABLED is
 * exactly "true". When disabled, NO auth, metadata or tool code is imported or run.
 * Defaults OFF. Do not flip on until the reviewed read-only design ships.
 */
export function isMcpEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.MCP_ENABLED === "true";
}

export function mcpNotFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

type Handler<C extends { request: Request }> = (ctx: C) => Response | Promise<Response>;

/** Wrap a lazily-loaded MCP handler so nothing loads while the gate is closed. */
export function gatedMcpHandler<C extends { request: Request }>(
  load: () => Promise<Handler<C>>,
): (ctx: C) => Promise<Response> {
  return async (ctx) => {
    if (!isMcpEnabled()) return mcpNotFound();
    const handler = await load();
    return handler(ctx);
  };
}
