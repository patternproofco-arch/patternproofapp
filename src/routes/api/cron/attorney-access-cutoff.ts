import { createFileRoute } from "@tanstack/react-router";

/**
 * Manual / external-scheduler fallback for the 180-day attorney access cutoff
 * sweep. The primary path is the Cloudflare Cron Trigger in wrangler.jsonc
 * (nitro-plugins/attorney-access-cutoff-cron.ts). Auth: header
 * `x-cron-secret` must equal env CRON_SECRET. Idempotent.
 */
export const Route = createFileRoute("/api/cron/attorney-access-cutoff")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) {
          return Response.json(
            { ok: false, error: "CRON_SECRET not configured" },
            { status: 500 },
          );
        }
        if (request.headers.get("x-cron-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { runAttorneyAccessCutoffSweep } = await import(
            "@/lib/attorney-access-cutoff.server"
          );
          const result = await runAttorneyAccessCutoffSweep(supabaseAdmin);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("[cron] attorney-access-cutoff sweep failed", e);
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "Sweep failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
