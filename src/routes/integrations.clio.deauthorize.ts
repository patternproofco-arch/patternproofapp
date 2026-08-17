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
          const { data: existing } = await supabaseAdmin
            .from("clio_connections")
            .select("user_id")
            .eq("clio_user_id", clioUserId)
            .is("revoked_at", null)
            .maybeSingle();
          const query = supabaseAdmin
            .from("clio_connections")
            .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("clio_user_id", clioUserId)
            .is("revoked_at", null);

          // Stored tokens are encrypted with a random IV, so we cannot match
          // on the plaintext token Clio sends. We hold at most one connection
          // per Clio user, so revoking by clio_user_id is equivalent.
          void accessToken;

          const { error } = await query;
          if (error) console.error("[clio] deauthorize update failed", error);
          if (!error && existing?.user_id) {
            const { recordClioAudit } = await import("@/lib/clio-audit.server");
            await recordClioAudit({
              userId: existing.user_id,
              event: "clio.revoked_by_provider",
              actorId: existing.user_id,
              meta: { clio_user_id: clioUserId },
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