import { sendInvitationEmail } from "@/lib/email/invitation-email.functions";

/**
 * Thin client helper for invitation emails. The server rebuilds the email
 * content from the caller's own pending invitation. Returns false instead of
 * throwing so a failed send never blocks the survivor's flow.
 */
export async function sendTransactionalEmail(input: {
  templateName: string;
  recipientEmail: string;
  idempotencyKey?: string;
  templateData?: Record<string, unknown>;
}): Promise<boolean> {
  if (
    input.templateName !== "advocate-survivor-invitation" &&
    input.templateName !== "attorney-invitation"
  ) {
    return false;
  }
  try {
    const res = await sendInvitationEmail({
      data: {
        templateName: input.templateName,
        recipientEmail: input.recipientEmail,
        idempotencyKey: input.idempotencyKey,
      },
    });
    return res.success;
  } catch {
    return false;
  }
}
