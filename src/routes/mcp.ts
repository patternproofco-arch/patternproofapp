// Owned by PatternProof — do not re-auto-generate as a marketing surface.
// Protocol clients still hit createTanStackMcpHandler; browser document
// navigations get a minimal fail-closed page (no MCP upsell, no soft-claim chrome).
import { createFileRoute } from "@tanstack/react-router";
import { createTanStackMcpHandler } from "@lovable.dev/mcp-js/stacks/tanstack";
import mcp from "../lib/mcp/index";

const mcpOpts = {
  resourcePath: "/mcp",
  metadataPath: "/.well-known/oauth-protected-resource",
  trustForwardedHost: true,
} as const;

const mcpApi = createTanStackMcpHandler(mcp, mcpOpts);

const FAIL_CLOSED_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>PatternProof</title>
</head>
<body style="margin:0;font-family:system-ui,-apple-system,sans-serif;background:#F7F8FA;color:#1A1F26">
  <main style="max-width:26rem;margin:3rem auto;padding:0 1.25rem">
    <h1 style="font-size:1.25rem;margin:0 0 0.75rem;letter-spacing:-0.02em">Not a public page</h1>
    <p style="font-size:0.95rem;line-height:1.55;color:#5B6570;margin:0 0 1rem">
      This address is not a product landing. App connections are managed in
      Settings → Connected apps after you sign in.
    </p>
    <p style="font-size:0.9rem;line-height:1.5;margin:0">
      <a href="/signin?redirect=/settings%23connected-apps" style="color:#1A1F26;font-weight:600">Sign in</a>
      · <a href="/" style="color:#1A1F26">Home</a>
    </p>
  </main>
</body>
</html>`;

function isBrowserDocumentNavigation(request: Request): boolean {
  if (request.headers.get("sec-fetch-mode") === "navigate") return true;
  const accept = request.headers.get("accept") ?? "";
  // Browsers lead with text/html; MCP/API clients typically do not.
  return (
    accept.includes("text/html") &&
    !accept.includes("application/json") &&
    !accept.includes("text/event-stream") &&
    !accept.includes("application/mcp")
  );
}

export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      ANY: async (ctx: { request: Request }) => {
        if (isBrowserDocumentNavigation(ctx.request)) {
          return new Response(FAIL_CLOSED_HTML, {
            status: 404,
            headers: {
              "content-type": "text/html; charset=utf-8",
              "cache-control": "no-store",
            },
          });
        }
        return mcpApi(ctx);
      },
    },
  },
});
