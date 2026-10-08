export type AccountNotifyRole = "survivor" | "attorney" | "advocate" | "org";

export interface AccountNotifyInput {
  role: AccountNotifyRole;
  signedUpAt: string;
  source: string;
  contactEmail?: string | null;
  orgName?: string | null;
  referralCode?: string | null;
}

export interface AccountNotifyFields {
  role: AccountNotifyRole;
  signedUpAt: string;
  source: string;
  contactEmail?: string;
  orgName?: string;
  referralCode?: string;
}

/**
 * Operational metadata only. Survivor notifications never carry an email
 * address. Professional roles may, because those addresses are work contacts
 * the founder is expected to answer.
 */
export function accountNotifyFields(input: AccountNotifyInput): AccountNotifyFields {
  const professional = input.role !== "survivor";
  const contact = input.contactEmail?.trim();
  return {
    role: input.role,
    signedUpAt: input.signedUpAt,
    source: input.source,
    ...(professional && contact ? { contactEmail: contact } : {}),
    ...(input.orgName?.trim() ? { orgName: input.orgName.trim() } : {}),
    ...(input.referralCode?.trim() ? { referralCode: input.referralCode.trim() } : {}),
  };
}
