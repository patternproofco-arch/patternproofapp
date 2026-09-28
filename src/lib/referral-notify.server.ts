export async function enqueueReferralSignupNotification(input: {
  code: string;
  orgName: string | null;
}): Promise<boolean> {
  try {
    const React = (await import("react")).default;
    const { render } = await import("@react-email/render");
    const { template } = await import("@/lib/email-templates/referral-signup-notification");
    const { sendRenderedEmail } = await import("@/lib/email/managed-send.server");

    const props = {
      orgName: input.orgName ?? undefined,
      code: input.code,
      signedUpAt: new Date().toISOString(),
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
      label: "referral-signup-notification",
      idempotencyKey: `referral-signup-${input.code}-${crypto.randomUUID()}`,
    });
    return result.sent;
  } catch {
    return false;
  }
}
