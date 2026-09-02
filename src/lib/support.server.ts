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
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    });
    if (error) return false;

    // Send immediately rather than waiting on a scheduler — there is no cron
    // trigger wired up to drain this queue any other way.
    const apiKey = process.env.LOVABLE_API_KEY;
    if (apiKey) {
      const { drainEmailQueues } = await import("@/lib/email-queue-drain.server");
      try {
        await drainEmailQueues(supabaseAdmin, apiKey, process.env.LOVABLE_SEND_URL);
      } catch (drainError) {
        console.error("Immediate drain after enqueue failed", { drainError });
      }
    }

    return true;
  } catch {
    return false;
  }
}
