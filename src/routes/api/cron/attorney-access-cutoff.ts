import { createFileRoute } from "@tanstack/react-router";

/**
 * Runs the 150/165/175-day reminder + 173-day survivor-notice + 180-day
 * cutoff sweep for attorney_client_links (see attorney-access-cutoff.server.ts).
 *
 * There is no Cloudflare Cron Trigger wired into this deploy yet (same gap
 * noted for the email queue in email-queue-drain.server.ts) — this is a
 * manually- or externally-scheduled HTTP endpoint until one is. Idempotent:
 * running it more than once in a day is harmless, since every action checks
 * its own *_sent_at column first.
 */
export const Route = createFileRoute("/api/cron/attorney-access-cutoff")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) {
          return Response.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 500 });
        }
        if (request.headers.get("x-cron-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { runAttorneyAccessCutoffSweep } = await import("@/lib/attorney-access-cutoff.server");
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
