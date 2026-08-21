export async function enqueueReferralSignupNotification(input: {
  code: string;
  orgName: string | null;
}): Promise<boolean> {
  try {
    const React = (await import("react")).default;
    const { render } = await import("@react-email/render");
    const { template } = await import("@/lib/email-templates/referral-signup-notification");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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

    const messageId = crypto.randomUUID();

    // The email API requires an unsubscribe token for every transactional send.
    const inbox = template.to!.toLowerCase();
    const { data: existing } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", inbox)
      .maybeSingle();
    let unsubscribeToken = existing?.token;
    if (!unsubscribeToken) {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const fresh = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      await supabaseAdmin
        .from("email_unsubscribe_tokens")
        .upsert({ token: fresh, email: inbox }, { onConflict: "email", ignoreDuplicates: true });
      const { data: stored } = await supabaseAdmin
        .from("email_unsubscribe_tokens")
        .select("token")
        .eq("email", inbox)
        .maybeSingle();
      unsubscribeToken = stored?.token ?? fresh;
    }

    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: "referral-signup-notification",
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
        subject,
        html,
        text,
        purpose: "transactional",
        label: "referral-signup-notification",
        idempotency_key: `referral-signup-${input.code}-${messageId}`,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    });
    return !error;
  } catch {
    return false;
  }
}
