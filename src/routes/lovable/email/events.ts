import { createEmailWebhookHandler } from "@lovable.dev/email-js";
import { createFileRoute } from "@tanstack/react-router";

type Reason = "bounce" | "complaint" | "unsubscribe";

const STATUS: Record<Reason, "bounced" | "complained" | "suppressed"> = {
  bounce: "bounced",
  complaint: "complained",
  unsubscribe: "suppressed",
};

const MESSAGE: Record<Reason, string> = {
  bounce: "Permanent bounce — email address is invalid or rejected",
  complaint: "Spam complaint — recipient marked email as spam",
  unsubscribe: "Recipient unsubscribed",
};

/** Records a terminal outcome in the kept email tables (notification only). */
async function recordOutcome(eventId: string, recipient: string, reason: Reason) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = recipient.toLowerCase();
  const { error: suppressError } = await supabaseAdmin
    .from("suppressed_emails")
    .upsert({ email, reason, metadata: null }, { onConflict: "email" });
  if (suppressError) {
    console.error("Failed to record suppression", {
      code: suppressError.code,
      message: suppressError.message,
      event_id: eventId,
    });
    throw new Error("suppression write failed");
  }
  const { error: logError } = await supabaseAdmin.from("email_send_log").insert({
    message_id: null,
    template_name: "system",
    recipient_email: email,
    status: STATUS[reason],
    error_message: MESSAGE[reason],
    metadata: null,
  });
  if (logError) {
    console.error("Failed to record send log", {
      code: logError.code,
      message: logError.message,
      event_id: eventId,
    });
    throw new Error("send log write failed");
  }
}

export const Route = createFileRoute("/lovable/email/events")({
  server: {
    handlers: {
      POST: ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          console.error("Missing required environment variables");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }
        const handler = createEmailWebhookHandler({
          apiKey,
          on: {
            "email.bounced": async (event) => {
              await recordOutcome(event.event_id, event.data.recipient, "bounce");
            },
            "email.complaint": async (event) => {
              await recordOutcome(event.event_id, event.data.recipient, "complaint");
            },
            "email.unsubscribed": async (event) => {
              await recordOutcome(event.event_id, event.data.recipient, "unsubscribe");
            },
          },
        });
        return handler(request);
      },
    },
  },
});
