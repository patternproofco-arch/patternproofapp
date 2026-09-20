import { definePlugin } from "nitro";
import { runAttorneyAccessCutoffCron } from "@/lib/attorney-access-cutoff-cron.server";

/**
 * Daily 180-day attorney access cutoff sweep. Same Cloudflare Cron Trigger
 * integration as the email-queue backstop (nitro-plugins/email-cron.ts).
 * Manual/HTTP fallback: POST /api/cron/attorney-access-cutoff with
 * header x-cron-secret: $CRON_SECRET.
 */
export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("cloudflare:scheduled", async ({ controller, env, context }) => {
    if (controller?.cron && controller.cron !== "15 13 * * *") return;
    context.waitUntil(
      runAttorneyAccessCutoffCron(env as Record<string, string | undefined>),
    );
  });
});
