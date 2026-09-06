import { createFileRoute, Link } from "@tanstack/react-router";

/**
 * Public MCP / assistant-connect landing is intentionally buried.
 * Hard consent and connection management live in Settings → Connected apps
 * (Guardian). This route must not upsell MCP or reuse soft-claim marketing chrome.
 */
function ConnectBuried() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F7F8FA",
        color: "#1A1F26",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "48px 20px",
      }}
    >
      <main style={{ maxWidth: 420, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 12px", letterSpacing: "-0.02em" }}>
          Not a public feature page
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.55, margin: "0 0 16px", color: "#5B6570" }}>
          App connections are managed in your account under Settings → Connected apps after you sign
          in. Approval and revoke live there — not on a public landing.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.5, margin: "0 0 28px", color: "#5B6570" }}>
          If you followed an old link here, sign in and open Connected apps, or go home.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Link
            to="/signin"
            search={{ redirect: "/settings" }}
            style={{
              display: "inline-block",
              padding: "10px 16px",
              borderRadius: 999,
              background: "#1A1F26",
              color: "#F7F8FA",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Sign in to Connected apps
          </Link>
          <Link
            to="/"
            style={{
              display: "inline-block",
              padding: "10px 16px",
              borderRadius: 999,
              color: "#1A1F26",
              textDecoration: "underline",
              textUnderlineOffset: 3,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Home
          </Link>
        </div>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/connect")({
  head: () => ({
    meta: [
      { title: "Connected apps — PatternProof" },
      {
        name: "description",
        content: "App connections are managed in Settings after you sign in.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ConnectBuried,
});
