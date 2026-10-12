/**
 * Founder alert when an account gains a role for the first time.
 * Durably deduped per user+role; failed attempts can retry after five minutes. Never throws.
 */
export async function notifyNewSignup(input: {
  userId: string;
  role: string;
  retryOnly?: boolean;
}): Promise<boolean> {
  let stage = "load_template";
  try {
    const React = (await import("react")).default;
    const { render } = await import("@react-email/render");
    const { template } = await import("@/lib/email-templates/new-user-signup-notification");
    const { sendRenderedEmail } = await import("@/lib/email/managed-send.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    stage = "claim_alert";
    const { data: claimed, error: claimError } = await (supabaseAdmin as any).rpc(
      "claim_signup_alert",
      {
        _user_id: input.userId,
        _role: input.role,
        _enqueue: !input.retryOnly,
      },
    );
    if (claimError) throw new Error("Alert claim failed");
    if (!claimed) return false;

    stage = "load_account";
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(input.userId);
    if (error || !data?.user?.email || !data.user.email_confirmed_at)
      throw new Error("Account lookup failed");
    // Role and timestamp only. The account lookup gates on a confirmed email but the
    // address itself never enters the alert, whatever the role.
    const props = {
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
    if (result.sent || result.reason === "recipient_suppressed") {
      stage = "complete_alert";
      const { error: completeError } = await supabaseAdmin
        .from("signup_alert_outbox" as any)
        .update({
          completed_at: new Date().toISOString(),
          outcome: result.sent ? "sent" : "suppressed",
        } as any)
        .eq("user_id", input.userId)
        .eq("role", input.role);
      if (completeError) throw new Error("Alert completion failed");
    }
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
