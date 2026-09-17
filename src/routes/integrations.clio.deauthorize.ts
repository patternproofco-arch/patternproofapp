import { createFileRoute } from "@tanstack/react-router";

// Clio POSTs here when a token is deauthorized (by us, or by the user revoking
// access inside Clio Manage). Body: { client_id, user_id, access_token }.
// access_token === "all" means every token for that Clio user is gone.
//
// Clio documents no signature for this callback, and client_id is not a
// secret — it's embedded in the public authorize URL, so it's visible to
// anyone who starts the connect flow. This endpoint therefore cannot be
// truly authenticated as coming from Clio. To bound the damage an attacker
// who knows/guesses a clio_user_id could do (forcing repeated disconnects —
// a low-cost denial-of-service against that attorney's integration), this
// rate-limits how often a single Clio connection can be revoked through this
// path and records the event so it's visible in the app's own audit trail.
const ok = () => new Response(null, { status: 200 });
const DEAUTH_WINDOW_MS = 60 * 60 * 1000;
const DEAUTH_MAX_PER_WINDOW = 3;

export const Route = createFileRoute("/integrations/clio/deauthorize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { client_id?: unknown; user_id?: unknown; access_token?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return ok();
        }

        const clientId = process.env.CLIO_CLIENT_ID;
        if (!clientId || typeof body.client_id !== "string" || body.client_id !== clientId) {
          return ok();
        }

        const clioUserId = body.user_id == null ? "" : String(body.user_id);
        const accessToken = typeof body.access_token === "string" ? body.access_token : "";
        if (!clioUserId || !accessToken) return ok();

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Stored tokens are encrypted with a random IV, so we cannot match
          // on the plaintext token Clio sends. We hold at most one connection
          // per Clio user, so revoking by clio_user_id is equivalent.
          void accessToken;

          const { data: connection } = await supabaseAdmin
            .from("clio_connections")
            .select("user_id")
            .eq("clio_user_id", clioUserId)
            .is("revoked_at", null)
            .maybeSingle();
          if (!connection) return ok();

          const since = new Date(Date.now() - DEAUTH_WINDOW_MS).toISOString();
          const { count } = await supabaseAdmin
            .from("audit_events")
            .select("id", { count: "exact", head: true })
            .eq("user_id", connection.user_id)
            .eq("event_type", "clio.deauthorized")
            .gte("created_at", since);
          if ((count ?? 0) >= DEAUTH_MAX_PER_WINDOW) return ok();

          const { error } = await supabaseAdmin
            .from("clio_connections")
            .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("clio_user_id", clioUserId)
            .is("revoked_at", null);
          if (error) {
            console.error("[clio] deauthorize update failed", error);
          } else {
            await supabaseAdmin.rpc("record_audit_event", {
              p_user_id: connection.user_id,
              p_event_type: "clio.deauthorized",
              p_subject_kind: "clio_connection",
              p_subject_id: undefined,
              p_actor_kind: "system",
              p_actor_id: undefined,
              p_meta: { source: "clio_webhook" },
            });
          }
        } catch (e) {
          console.error("[clio] deauthorize failed", e);
        }

        return ok();
      },
    },
  },
});
