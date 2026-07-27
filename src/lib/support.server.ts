export async function enqueueSupportEmail(input: {
  id: string;
  name: string | null;
  replyEmail: string;
  category: string;
  message: string;
  userId: string | null;
}): Promise<boolean> {
  try {
    const React = (await import("react")).default;
    const { render } = await import("@react-email/render");
    const { template } = await import("@/lib/email-templates/support-request");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const props = {
      requestId: input.id,
      name: input.name ?? undefined,
      replyEmail: input.replyEmail,
      category: input.category,
      message: input.message,
      accountState: input.userId ? "Signed-in account" : "Logged-out visitor",
    };
    const element = React.createElement(template.component, props);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject =
      typeof template.subject === "function" ? template.subject(props) : template.subject;

    const messageId = crypto.randomUUID();
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: "support-request",
      recipient_email: template.to!,
      status: "pending",
    });

    const { error } = await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: template.to!,
        from: "patternproofapp <noreply@pattern-proof.tech>",
        sender_domain: "notify.pattern-proof.tech",
        reply_to: input.replyEmail,
        subject,
        html,
        text,
        purpose: "transactional",
        label: "support-request",
        idempotency_key: `support-request-${input.id}`,
        queued_at: new Date().toISOString(),
      },
    });
    return !error;
  } catch {
    return false;
  }
}
