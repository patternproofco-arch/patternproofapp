/**
 * Founder alert when an account gains a role for the first time.
 * Deduped per user+role via idempotency key. Never throws.
 */
export async function notifyNewSignup(input: { userId: string; role: string }): Promise<boolean> {
  try {
    const React = (await import("react")).default;
    const { render } = await import("@react-email/render");
    const { template } = await import("@/lib/email-templates/new-user-signup-notification");
    const { sendRenderedEmail } = await import("@/lib/email/managed-send.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data } = await supabaseAdmin.auth.admin.getUserById(input.userId);
    const props = {
      email: data?.user?.email ?? undefined,
      role: input.role,
      signedUpAt: data?.user?.created_at ?? new Date().toISOString(),
    };
    const element = React.createElement(template.component, props);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject =
      typeof template.subject === "function" ? template.subject(props) : template.subject;

    const result = await sendRenderedEmail({
      to: template.to!,
      from: "patternproofapp <noreply@pattern-proof.tech>",
      subject,
      html,
      text,
      label: "new-user-signup-notification",
      idempotencyKey: `new-user-signup-${input.userId}-${input.role}`,
    });
    return result.sent;
  } catch {
    return false;
  }
}
