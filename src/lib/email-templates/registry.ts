import type { ComponentType } from "react";

export interface TemplateEntry {
  component: ComponentType<any>;
  subject: string | ((data: Record<string, any>) => string);
  displayName?: string;
  previewData?: Record<string, any>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
import { template as attorneyInvitationTemplate } from "./attorney-invitation";
import { template as supportRequestTemplate } from "./support-request";
import { template as referralSignupNotificationTemplate } from "./referral-signup-notification";
import { template as teamInvitationTemplate } from "./team-invitation.config";
import { template as attorneyLeadKitTemplate } from "./attorney-lead-kit";
import { template as orgLeadKitTemplate } from "./org-lead-kit";

export const TEMPLATES: Record<string, TemplateEntry> = {
  "attorney-invitation": attorneyInvitationTemplate,
  "support-request": supportRequestTemplate,
  "referral-signup-notification": referralSignupNotificationTemplate,
  "team-invitation": teamInvitationTemplate,
  "attorney-lead-kit": attorneyLeadKitTemplate,
  "org-lead-kit": orgLeadKitTemplate,
};
