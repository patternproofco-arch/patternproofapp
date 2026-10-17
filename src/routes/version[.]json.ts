import { createFileRoute } from "@tanstack/react-router";

/** Real commit metadata when available, plus deterministic source provenance.
 * Hosted builds without git report an unavailable commit honestly. The source
 * digest lets QA compare their source against the deployed artifact regardless.
 * Environment files and credentials never contribute to that digest.
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
              commit_source: __COMMIT_SOURCE__,
              source_digest: __SOURCE_DIGEST__,
              source_digest_algorithm: "patternproof-source-v1-sha256",
              build_id: __BUILD_ID__,
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
