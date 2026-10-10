/**
 * Founder alert when an account gains a role for the first time.
 * Deduped per user+role via idempotency key. Never throws.
 */
export async function notifyNewSignup(input: { userId: string; role: string }): Promise<boolean> {
  let stage = "load_template";
  try {
    const React = (await import("react")).default;
    const { render } = await import("@react-email/render");
    const { template } = await import("@/lib/email-templates/new-user-signup-notification");
    const { sendRenderedEmail } = await import("@/lib/email/managed-send.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    stage = "load_account";
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(input.userId);
    if (error || !data?.user?.email) throw new Error("Account lookup failed");
    const props = {
      email: data?.user?.email ?? undefined,
      role: input.role,
      signedUpAt: data?.user?.created_at ?? new Date().toISOString(),
    };
    stage = "render_template";
    const element = React.createElement(template.component, props);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject =
      typeof template.subject === "function" ? template.subject(props) : template.subject;

    stage = "send_email";
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
    // Persist a safe diagnostic before returning: the founder must be able to
    // distinguish a missed alert from no signup. Never log account credentials.
    console.error("[signup-alert] notification failed", { stage });
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from("email_send_log").insert({
        template_name: "new-user-signup-notification",
        recipient_email: "patternproofco@gmail.com",
        status: "failed",
        error_message: `Signup notification failed during ${stage}.`,
      });
      if (error) console.error("[signup-alert] failure log unavailable", { code: error.code });
    } catch {
      console.error("[signup-alert] failure log unavailable");
    }
    return false;
  }
}
