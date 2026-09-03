import { createFileRoute } from "@tanstack/react-router";

/**
 * Clio Manage OAuth callback (Authorization Code flow).
 *
 * Everything happens server-side: the authorization code is exchanged here and
 * never reaches the browser, and neither codes nor tokens are logged. The
 * state row proves which PatternProof user started the flow, is single-use, and
 * expires within minutes.
 */
function done(message: string, ok: boolean) {
  const target = ok
    ? "/billing?clio=connected"
    : `/billing?clio=error&reason=${encodeURIComponent(message)}`;
  return new Response(null, { status: 302, headers: { Location: target } });
}

export const Route = createFileRoute("/integrations/clio/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { clioAvailability } = await import("@/lib/clio.server");
        if (!clioAvailability().available) {
          return done("Clio connection is not available yet.", false);
        }

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (url.searchParams.get("error") || !code || !state) {
          return done("Clio didn't complete the connection.", false);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: stateRow } = await supabaseAdmin
          .from("clio_oauth_states")
          .select("state, user_id, expires_at")
          .eq("state", state)
          .maybeSingle();
        // Single use: consume the state regardless of what happens next.
        if (stateRow) await supabaseAdmin.from("clio_oauth_states").delete().eq("state", state);
        const { checkClioState } = await import("@/lib/clio-state");
        const check = checkClioState(stateRow, state);
        if (!check.ok) {
          return done("That connection link expired. Please start again.", false);
        }

        try {
          const { exchangeCodeForTokens, fetchClioIdentity, storeClioTokens } =
            await import("@/lib/clio.server");
          const tokens = await exchangeCodeForTokens(code);
          if (!tokens.refresh_token) return done("Clio didn't return a refresh token.", false);
          // Only mark connected after an authenticated Clio API call succeeds.
          const identity = await fetchClioIdentity(tokens.access_token);
          await storeClioTokens(check.userId, tokens, identity);
          return done("", true);
        } catch (e) {
          // Log the failure shape, never the code, token, or provider body.
          console.error(
            "[clio] callback failed:",
            e instanceof Error ? e.message : "unknown error",
          );
          return done("We couldn't finish connecting Clio.", false);
        }
      },
    },
  },
});
