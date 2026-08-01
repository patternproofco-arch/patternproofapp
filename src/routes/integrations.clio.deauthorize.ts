import { createFileRoute } from "@tanstack/react-router";

// Clio POSTs here when a token is deauthorized (by us, or by the user revoking
// access inside Clio Manage). Body: { client_id, user_id, access_token }.
// access_token === "all" means every token for that Clio user is gone.
// Clio documents no signature for this callback — client_id is the only check.
const ok = () => new Response(null, { status: 200 });

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
          let query = supabaseAdmin
            .from("clio_connections")
            .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("clio_user_id", clioUserId)
            .is("revoked_at", null);

          if (accessToken !== "all") {
            query = query.eq("access_token", accessToken);
          }

          const { error } = await query;
          if (error) console.error("[clio] deauthorize update failed", error);
        } catch (e) {
          console.error("[clio] deauthorize failed", e);
        }

        return ok();
      },
    },
  },
});