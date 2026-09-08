import { createFileRoute } from "@tanstack/react-router";

/**
 * Build/version marker so QA can prove exactly which commit is serving
 * production. Values are injected at build time from the build environment's
 * git metadata. No secrets are exposed.
 */
export const Route = createFileRoute("/version.json")({
  server: {
    handlers: {
      GET: async () =>
        new Response(
          JSON.stringify(
            {
              commit: __GIT_COMMIT_SHA__,
              commit_short: __GIT_COMMIT_SHA__.slice(0, 12),
              built_at: __BUILD_TIME__,
            },
            null,
            2,
          ),
          {
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
            },
          },
        ),
    },
  },
});
