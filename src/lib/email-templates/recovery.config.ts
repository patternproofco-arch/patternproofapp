/**
 * Survivor-safe recovery mail labels.
 *
 * Inbox glance surface (subject + from display) must not say PatternProof,
 * Court, DV, or survivor. Body copy stays educational and calm once opened.
 * The sending domain may still show pattern-proof.tech — changing that needs
 * DNS/SMTP on muy, which this repo cannot do.
 */

/** Subject line shown in the inbox list. */
export const RECOVERY_EMAIL_SUBJECT = "Your account access link";

/** From display name for Lovable auth emails (recovery and other auth types). */
export const AUTH_EMAIL_FROM_DISPLAY = "Account Notices";

/** Short tip shown on /forgot-password after a successful request. */
export const RECOVERY_EMAIL_INBOX_HINT =
  'Look for a message titled "Your account access link" from Account Notices. Check spam or promotions if you do not see it within a few minutes.';
