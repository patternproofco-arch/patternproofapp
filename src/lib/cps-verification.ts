/**
 * Deciding whether a child-protection professional may be approved without a person.
 *
 * Claude (or any model) never approves anyone here. These are plain rules over facts the
 * server collected: a clicked link in the work mailbox, the founder's domain list, and
 * lookalike checks. A model may summarize an application for a human reviewer, nothing more.
 *
 * Even a Tier 1 approval only proves "someone with a mailbox at this agency", so the survivor
 * is shown exactly that, never "verified CPS".
 */

export type ProfessionalType = "agency_caseworker" | "licensed_social_worker" | "gal_or_court";

export type ApplicationFacts = {
  email: string;
  /** She clicked the one-time link sent to this mailbox. */
  emailVerified: boolean;
  professionalType: ProfessionalType;
  /** The founder's list of accepted domains (active ones only). */
  allowedDomains: string[];
  /** Domains and addresses the founder has blocked. */
  deniedDomains: string[];
  /** CISA registry entry for the domain, when one was found (type like "State", "County"). */
  registryType?: string | null;
};

export type Decision =
  | { action: "verify_email"; tier: null; reasons: string[] }
  | { action: "auto_approve"; tier: 1; reasons: string[] }
  | { action: "needs_review"; tier: 2; reasons: string[] }
  | { action: "manual"; tier: 3; reasons: string[] }
  | { action: "reject"; tier: null; reasons: string[] };

export function emailDomain(email: string): string | null {
  const at = email.trim().toLowerCase().lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.trim().toLowerCase().slice(at + 1);
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) ? domain : null;
}

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

/** True for a domain that imitates an accepted one (one or two characters off, or punycode). */
export function isLookalikeDomain(domain: string, allowed: string[]): boolean {
  if (allowed.includes(domain)) return false;
  if (domain.split(".").some((label) => label.startsWith("xn--"))) return true;
  return allowed.some((good) => {
    if (Math.abs(good.length - domain.length) > 2) return false;
    return distance(good, domain) <= 2;
  });
}

function isGovernmentLike(domain: string, registryType?: string | null): boolean {
  if (registryType && /^(state|county|city|tribal|territorial|interstate)/i.test(registryType)) return true;
  return /\.gov$/.test(domain) || /\.state\.[a-z]{2}\.us$/.test(domain);
}

export function classifyApplication(f: ApplicationFacts): Decision {
  const domain = emailDomain(f.email);
  if (!domain) return { action: "reject", tier: null, reasons: ["not a usable work email"] };
  const denied = f.deniedDomains.map((d) => d.toLowerCase());
  if (denied.includes(domain) || denied.includes(f.email.trim().toLowerCase())) {
    return { action: "reject", tier: null, reasons: ["blocked address or domain"] };
  }
  if (!f.emailVerified) {
    return { action: "verify_email", tier: null, reasons: ["work mailbox not yet confirmed"] };
  }
  const allowed = f.allowedDomains.map((d) => d.toLowerCase());
  if (isLookalikeDomain(domain, allowed)) {
    return { action: "reject", tier: null, reasons: ["domain imitates an accepted agency domain"] };
  }
  const onList = allowed.includes(domain);
  if (onList && f.professionalType === "agency_caseworker") {
    return { action: "auto_approve", tier: 1, reasons: ["confirmed mailbox on an accepted agency domain"] };
  }
  if (onList) {
    return {
      action: "needs_review",
      tier: 2,
      reasons: ["accepted agency domain, but not an agency caseworker; a person confirms the role"],
    };
  }
  if (isGovernmentLike(domain, f.registryType)) {
    return { action: "needs_review", tier: 2, reasons: ["government domain not on the accepted list"] };
  }
  return {
    action: "manual",
    tier: 3,
    reasons: ["non-government email; needs an agency letter or a call to the agency's published number"],
  };
}

/** Invites a worker may send in a day. New accounts are held to a small number. */
export function dailyInviteCap(approvedAt: string | null | undefined, now = Date.now()): number {
  if (!approvedAt) return 0;
  const approved = Date.parse(approvedAt);
  if (!Number.isFinite(approved)) return 0;
  return now - approved < 14 * 86_400_000 ? 3 : 10;
}

export const MAX_GRANT_DAYS = 90;
export const DEFAULT_GRANT_DAYS = 30;

/** Expiry for a new grant: default 30 days, never more than 90. Bad input gets the default. */
export function clampGrantDays(days: unknown): number {
  if (typeof days !== "number" || !Number.isFinite(days) || days < 1) return DEFAULT_GRANT_DAYS;
  return Math.min(Math.floor(days), MAX_GRANT_DAYS);
}
