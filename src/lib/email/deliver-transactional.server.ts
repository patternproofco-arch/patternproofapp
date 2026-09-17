import * as React from "react";
import { render } from "@react-email/render";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { drainEmailQueues } from "@/lib/email-queue-drain.server";

const SITE_NAME = "patternproofapp";
const SENDER_DOMAIN = "notify.pattern-proof.tech";
const FROM_DOMAIN = "pattern-proof.tech";

/**
 * Server-side transactional send. Used when an invite is created so delivery
 * does not depend on the browser staying open to hit /lovable/email/...
 */
export async function deliverTransactionalEmail(input: {
  templateName: string;
  recipientEmail: string;
  templateData: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !supabaseUrl || !serviceKey) {
    return { sent: false, error: "Email is not configured on this deploy." };
  }

  const template = TEMPLATES[input.templateName];
  if (!template) return { sent: false, error: `Unknown template ${input.templateName}` };

  const recipient = (template.to || input.recipientEmail).trim().toLowerCase();
  if (!recipient) return { sent: false, error: "No recipient." };

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: suppressed } = await supabase
    .from("suppressed_emails")
    .select("id")
    .eq("email", recipient)
    .maybeSingle();
  if (suppressed) return { sent: false, error: "That address has unsubscribed." };

  const element = React.createElement(template.component, input.templateData);
  const html = await render(element);
  const plainText = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function"
      ? template.subject(input.templateData)
      : template.subject;
  const messageId = crypto.randomUUID();

  await supabase.from("email_send_log").insert({
    message_id: messageId,
    template_name: input.templateName,
    recipient_email: recipient,
    status: "pending",
  });

  const { error: enqueueError } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text: plainText,
      purpose: "transactional",
      label: input.templateName,
      idempotency_key: input.idempotencyKey,
      queued_at: new Date().toISOString(),
    },
  });
  if (enqueueError) {
    return { sent: false, error: enqueueError.message };
  }

  try {
    await drainEmailQueues(supabase, apiKey, process.env.LOVABLE_SEND_URL);
  } catch (error) {
    console.error("[email] drain after invite enqueue failed", error);
  }
  return { sent: true };
}
