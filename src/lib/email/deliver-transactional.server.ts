import * as React from "react";
import { render } from "@react-email/render";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { sendRenderedEmail } from "@/lib/email/managed-send.server";

const SITE_NAME = "patternproofapp";
const FROM_DOMAIN = "pattern-proof.tech";

/**
 * Server-side transactional send for registered templates. Used when an
 * invite is created so delivery does not depend on the browser staying open.
 */
export async function deliverTransactionalEmail(input: {
  templateName: string;
  recipientEmail: string;
  templateData: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<{ sent: boolean; error?: string }> {
  const template = TEMPLATES[input.templateName];
  if (!template) return { sent: false, error: `Unknown template ${input.templateName}` };

  const recipient = (template.to || input.recipientEmail).trim().toLowerCase();
  if (!recipient) return { sent: false, error: "No recipient." };

  const element = React.createElement(template.component, input.templateData);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function"
      ? template.subject(input.templateData)
      : template.subject;

  const result = await sendRenderedEmail({
    to: recipient,
    from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
    subject,
    html,
    text,
    label: input.templateName,
    idempotencyKey: input.idempotencyKey,
  });
  if (result.sent) return { sent: true };
  if (result.reason === "recipient_suppressed") {
    return { sent: false, error: "That address has unsubscribed." };
  }
  return { sent: false, error: result.error };
}
