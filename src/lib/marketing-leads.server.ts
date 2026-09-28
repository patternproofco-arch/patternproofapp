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
    const { sendRenderedEmail } = await import("@/lib/email/managed-send.server");

    const element = React.createElement(ProfessionalReadinessKitEmail, {
      persona: input.persona,
      name: input.name,
    });
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject = kitCopy(input.persona).title;



    const result = await sendRenderedEmail({
      to: input.email,
      from: "PatternProof <noreply@pattern-proof.tech>",
      subject: subject,
      html,
      text,
      label: `professional-readiness-kit-${input.persona}`,
      idempotencyKey: `professional-readiness-kit-${input.id}`,
    });
    return result.sent;
  } catch (error) {
    console.error("Unable to queue professional readiness kit", { error });
    return false;
  }
}
