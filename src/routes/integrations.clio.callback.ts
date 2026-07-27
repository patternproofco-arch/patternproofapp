import { createFileRoute } from "@tanstack/react-router";

function done(message: string, ok: boolean) {
  const target = ok ? "/billing?clio=connected" : `/billing?clio=error&reason=${encodeURIComponent(message)}`;
  return new Response(null, { status: 302, headers: { Location: target } });
}

export const Route = createFileRoute("/integrations/clio/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
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
        // One-time use: consume regardless of outcome.
        if (stateRow) await supabaseAdmin.from("clio_oauth_states").delete().eq("state", state);
        if (!stateRow || new Date(stateRow.expires_at).getTime() < Date.now()) {
          return done("That connection link expired. Please start again.", false);
        }

        try {
          const { exchangeCodeForTokens, expiryFrom, fetchClioIdentity } = await import("@/lib/clio.server");
          const tokens = await exchangeCodeForTokens(code);
          if (!tokens.refresh_token) return done("Clio didn't return a refresh token.", false);
          const identity = await fetchClioIdentity(tokens.access_token);

          const { error } = await supabaseAdmin.from("clio_connections").upsert(
            {
              user_id: stateRow.user_id,
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              expires_at: expiryFrom(tokens.expires_in),
              clio_user_id: identity.clioUserId,
              clio_user_email: identity.clioUserEmail,
              firm_name: identity.firmName,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
          if (error) throw error;
          return done("", true);
        } catch (e) {
          console.error("[clio] callback failed", e);
          return done("We couldn't finish connecting Clio.", false);
        }
      },
    },
  },
});
