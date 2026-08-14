import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/__clio-probe")({
  server: {
    handlers: {
      GET: async () => {
        const { clioAvailability, clioRedirectUri } = await import("@/lib/clio.server");
        return Response.json({ availability: clioAvailability(), redirect: clioRedirectUri() });
      },
    },
  },
});
