import { accountNotifyFields, type AccountNotifyInput } from "@/lib/account-notify";
import { opsNotifyEmail } from "@/lib/email/ops-inbox";

/** Best-effort pager. Never throws, and never includes survivor content. */
export async function enqueueAccountCreatedNotification(
  input: AccountNotifyInput & { idempotencyKey: string },
): Promise<boolean> {
  try {
    const React = (await import("react")).default;
    const { render } = await import("@react-email/render");
    const { template } = await import("@/lib/email-templates/account-created-notification");
    const { sendRenderedEmail } = await import("@/lib/email/managed-send.server");
    const props = accountNotifyFields(input);
    const element = React.createElement(template.component, props);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject =
      typeof template.subject === "function" ? template.subject(props) : template.subject;
    const result = await sendRenderedEmail({
      to: opsNotifyEmail(),
      from: "patternproofapp <noreply@pattern-proof.tech>",
      subject,
      html,
      text,
      label: "account-created-notification",
      idempotencyKey: input.idempotencyKey,
    });
    return result.sent;
  } catch (error) {
    console.error("[email] account created notification failed", error);
    return false;
  }
}
