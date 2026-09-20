import { definePlugin } from "nitro";
import { runEmailQueueCron } from "@/lib/email-cron.server";

/**
 * Retry backstop for the email queue. Every send already tries to drain
 * synchronously right after enqueue (email-queue-drain.server.ts) — this
 * only catches whatever a failed synchronous attempt left behind. Wired to
 * the Cron Trigger declared in wrangler.jsonc via Nitro's Cloudflare
 * runtime hook: a `scheduled` export on a custom server entry (src/server.ts)
 * isn't picked up by TanStack Start's build, which only extracts `fetch`
 * from that entry — this hook is the actual integration point Nitro's
 * "cloudflare-module" preset wires a Cron Trigger invocation to.
 */
export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("cloudflare:scheduled", async ({ controller, env, context }) => {
    // Two crons share this Worker; only run the email drain on the */5 tick.
    if (controller?.cron && controller.cron !== "*/5 * * * *") return;
    context.waitUntil(runEmailQueueCron(env as Record<string, string | undefined>));
  });
});
