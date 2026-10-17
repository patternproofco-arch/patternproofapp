// Owned file (mcp-js banner removed on purpose): MCP is disabled by default.
// Returns 404 before any auth or tool code runs unless MCP_ENABLED === "true".
import { createFileRoute } from "@tanstack/react-router";

import { gatedMcpHandler } from "../lib/mcp/gate";

export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      ANY: gatedMcpHandler(async () => {
        const [{ createTanStackMcpHandler }, { default: mcp }] = await Promise.all([
          import("@lovable.dev/mcp-js/stacks/tanstack"),
          import("../lib/mcp/index"),
        ]);
        return createTanStackMcpHandler(mcp, { resourcePath: "/mcp", metadataPath: "/.well-known/oauth-protected-resource", trustForwardedHost: true });
      }),
    },
  },
});
