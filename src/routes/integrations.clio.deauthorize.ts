import { createFileRoute } from "@tanstack/react-router";

// Clio POSTs here when a token is deauthorized (by us, or by the user revoking
// access inside Clio Manage). Body shape is typically
// { client_id, user_id, access_token }; access_token === "all" means every
// token for that Clio user is gone.
//
// FAIL-CLOSED (intentional): Clio documents no signature for this callback,
// and client_id is not a secret — it is embedded in the public authorize URL.
// This endpoint therefore cannot be authenticated as coming from Clio.
// PatternProof does NOT treat this callback as authoritative and does NOT
// mutate clio_connections (or any other table) from this unauthenticated path.
// Doing so would be an IDOR: anyone who knows/guesses a clio_user_id could
// disconnect another attorney's integration.
//
// Authoritative revocation happens only via:
//   1. Authenticated disconnectClio (auth + own user_id), and/or
//   2. Refresh-token failure paths that mark the caller's own connection revoked.
//
// We still return HTTP 200 so Clio's retry behavior stays quiet. We may log
// that an unauthenticated callback arrived; we never look up or update a
// connection by the supplied user_id.
const ok = () => new Response(null, { status: 200 });

export const Route = createFileRoute("/integrations/clio/deauthorize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Parse only enough to acknowledge receipt. Never use body fields to
        // select or mutate clio_connections.
        try {
          await request.json();
        } catch {
          // Malformed body is still acknowledged; Clio expects success-ish.
        }

        console.info(
          "[clio] unauthenticated deauthorize callback received; ignored (fail-closed, no DB mutate)",
        );

        return ok();
      },
    },
  },
});
