export async function enqueueMarketingLeadEmail(input: {
  id: string;
  email: string;
  name: string | null;
  persona: "attorney" | "org";
}): Promise<boolean> {
  try {
    const React = (await import("react")).default;
    const { render } = await import("@react-email/render");
    const { TEMPLATES } = await import("@/lib/email-templates/registry");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const templateName = input.persona === "attorney" ? "attorney-lead-kit" : "org-lead-kit";
    const template = TEMPLATES[templateName];

    const props = { name: input.name ?? undefined };
    const element = React.createElement(template.component, props);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject =
      typeof template.subject === "function" ? template.subject(props) : template.subject;

    const messageId = crypto.randomUUID();
    const inbox = input.email.toLowerCase();

    // The email API requires an unsubscribe token for every transactional send.
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
      template_name: templateName,
      recipient_email: inbox,
      status: "pending",
    });

    const { error } = await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: inbox,
        from: "patternproofapp <noreply@pattern-proof.tech>",
        sender_domain: "notify.pattern-proof.tech",
        subject,
        html,
        text,
        purpose: "transactional",
        label: templateName,
        idempotency_key: `marketing-lead-${input.id}`,
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
