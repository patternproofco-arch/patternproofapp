/** Public addresses. These stay on pattern-proof.tech and are never the ops pager. */
export const PUBLIC_SUPPORT_EMAIL = "pattern@pattern-proof.tech";
export const PUBLIC_FOUNDER_EMAIL = "graceburns@pattern-proof.tech";

/**
 * Inbox that should actually be read. Lovable only sends outbound mail from
 * notify.pattern-proof.tech, so a public From/Reply-To address is not the
 * same thing as a monitored inbox.
 *
 * OPS_NOTIFY_EMAIL overrides this on the deploy without a code change.
 * The default matches the referral pager already in use.
 */
export function opsNotifyEmail(): string {
  const fromEnv = process.env.OPS_NOTIFY_EMAIL?.trim();
  return fromEnv || "patternproofco@gmail.com";
}
