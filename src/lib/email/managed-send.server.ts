import { EmailAPIError, sendLovableEmail } from "@lovable.dev/email-js";

const SENDER_DOMAIN = "notify.pattern-proof.tech";

export type ManagedSendResult =
  | { sent: true }
  | { sent: false; reason: "recipient_suppressed" }
  | { sent: false; reason: "failed"; error: string };

/**
 * Sends a pre-rendered email through Lovable's managed email API and records
 * the outcome in email_send_log. Suppression, retries and unsubscribe are
 * handled by Lovable. Never throws.
 */
export async function sendRenderedEmail(input: {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  label: string;
  idempotencyKey: string;
  replyTo?: string;
}): Promise<ManagedSendResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  let result: ManagedSendResult;
  if (!apiKey) {
    result = { sent: false, reason: "failed", error: "Email is not configured on this deploy." };
  } else {
    try {
      await sendLovableEmail(
        {
          to: input.to,
          from: input.from,
          sender_domain: SENDER_DOMAIN,
          subject: input.subject,
          html: input.html,
          text: input.text,
          purpose: "transactional",
          label: input.label,
          idempotency_key: input.idempotencyKey,
          reply_to: input.replyTo,
        },
        { apiKey, sendUrl: process.env.LOVABLE_SEND_URL },
      );
      result = { sent: true };
    } catch (error) {
      if (error instanceof EmailAPIError && error.code === "recipient_suppressed") {
        result = { sent: false, reason: "recipient_suppressed" };
      } else {
        result = {
          sent: false,
          reason: "failed",
          error: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
        };
      }
    }
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("email_send_log").insert({
      message_id: null,
      template_name: input.label,
      recipient_email: input.to,
      status: result.sent ? "sent" : result.reason === "recipient_suppressed" ? "suppressed" : "failed",
      error_message: !result.sent && result.reason === "failed" ? result.error : null,
    });
    if (error) console.error("[email] send log write failed", { code: error.code, message: error.message });
  } catch (error) {
    console.error("[email] send log write failed", error);
  }
  return result;
}
