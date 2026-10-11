/**
 * Founder alert when an account gains a role for the first time.
 * Persistent per-user/role receipts dedupe successful sends; failures can retry.
 * Provider idempotency also covers concurrent requests. Never throws.
 */
export async function notifyNewSignup(input: { userId: string; role: string }): Promise<boolean> {
  let stage = "load_receipt";
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: receipt, error: receiptError } = await db
      .from("signup_alert_receipts")
      .select("status")
      .eq("user_id", input.userId)
      .eq("role", input.role)
      .maybeSingle();
    if (receiptError) throw new Error("Could not verify signup alert receipt");
    if (receipt) return receipt.status === "sent";

    stage = "load_template";
    const React = (await import("react")).default;
    const { render } = await import("@react-email/render");
    const { template } = await import("@/lib/email-templates/new-user-signup-notification");
    const { sendRenderedEmail } = await import("@/lib/email/managed-send.server");
    stage = "load_account";
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(input.userId);
    if (error || !data?.user?.email || !data.user.email_confirmed_at)
      throw new Error("Account lookup failed");
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
    if (result.sent || result.reason === "recipient_suppressed") {
      stage = "save_receipt";
      const { error: saveError } = await db
        .from("signup_alert_receipts")
        .upsert(
          { user_id: input.userId, role: input.role, status: result.sent ? "sent" : "suppressed" },
          { onConflict: "user_id,role" },
        );
      if (saveError) throw new Error("Could not save signup alert receipt");
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
