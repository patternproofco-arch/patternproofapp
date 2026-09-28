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
    const { sendRenderedEmail } = await import("@/lib/email/managed-send.server");

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




    const result = await sendRenderedEmail({
      to: template.to!,
      from: "patternproofapp <noreply@pattern-proof.tech>",
      subject: subject,
      html,
      text,
      label: "support-request",
      idempotencyKey: `support-request-${input.id}`,
      replyTo: input.replyEmail,
    });
    return result.sent;
  } catch {
    return false;
  }
}

/** Email an admin's reply to the person who sent a support request. */
export async function enqueueSupportReplyEmail(input: {
  id: string;
  name: string | null;
  replyEmail: string;
  reply: string;
  originalMessage: string;
}): Promise<boolean> {
  try {
    const React = (await import("react")).default;
    const { render } = await import("@react-email/render");
    const { template } = await import("@/lib/email-templates/support-reply");
    const { sendRenderedEmail } = await import("@/lib/email/managed-send.server");
    const props = {
      name: input.name ?? undefined,
      reply: input.reply,
      originalMessage: input.originalMessage,
    };
    const element = React.createElement(template.component, props);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const to = input.replyEmail.toLowerCase();


    const result = await sendRenderedEmail({
      to: to,
      from: "patternproofapp <noreply@pattern-proof.tech>",
      subject: template.subject,
      html,
      text,
      label: "support-reply",
      idempotencyKey: `support-reply-${input.id}-${messageId}`,
      replyTo: "pattern@pattern-proof.tech",
    });
    return result.sent;
  } catch {
    return false;
  }
}
