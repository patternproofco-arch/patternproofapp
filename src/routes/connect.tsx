import { createFileRoute, redirect } from "@tanstack/react-router";

/** Old MCP landing. Connections live in Settings after sign-in. */
export const Route = createFileRoute("/connect")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "PatternProof" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: function ConnectRedirect() {
    return null;
  },
});
