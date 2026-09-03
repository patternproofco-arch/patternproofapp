export async function enqueueProfessionalReadinessKit(input: {
  id: string;
  name: string;
  email: string;
  persona: "attorney" | "org";
}): Promise<boolean> {
  try {
    const React = (await import("react")).default;
    const { render } = await import("@react-email/render");
    const { ProfessionalReadinessKitEmail, kitCopy } =
      await import("@/lib/email-templates/professional-readiness-kit");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const element = React.createElement(ProfessionalReadinessKitEmail, {
      persona: input.persona,
      name: input.name,
    });
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject = kitCopy(input.persona).title;
    const messageId = crypto.randomUUID();

    const { data: existing } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", input.email)
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
        .upsert(
          { token: fresh, email: input.email },
          { onConflict: "email", ignoreDuplicates: true },
        );
      const { data: stored } = await supabaseAdmin
        .from("email_unsubscribe_tokens")
        .select("token")
        .eq("email", input.email)
        .maybeSingle();
      unsubscribeToken = stored?.token ?? fresh;
    }

    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: `professional-readiness-kit-${input.persona}`,
      recipient_email: input.email,
      status: "pending",
    });

    const { error } = await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: input.email,
        from: "PatternProof <noreply@pattern-proof.tech>",
        sender_domain: "notify.pattern-proof.tech",
        subject,
        html,
        text,
        purpose: "transactional",
        label: `professional-readiness-kit-${input.persona}`,
        idempotency_key: `professional-readiness-kit-${input.id}`,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    });
    if (error) return false;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (apiKey) {
      const { drainEmailQueues } = await import("@/lib/email-queue-drain.server");
      try {
        await drainEmailQueues(supabaseAdmin, apiKey, process.env.LOVABLE_SEND_URL);
      } catch (drainError) {
        console.error("Immediate readiness-kit email drain failed", { drainError });
      }
    }

    return true;
  } catch (error) {
    console.error("Unable to queue professional readiness kit", { error });
    return false;
  }
}
