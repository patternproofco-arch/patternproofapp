/**
 * Single source of truth for public pricing tiers.
 *
 * Imported by /pricing and /for-attorneys so the two marketing pages can never
 * drift apart on tier names, prices, or the live Charter remaining-spot count.
 * Prices here must match the live Stripe price lookup keys used in
 * src/lib/payments.functions.ts (attorney_solo_monthly, attorney_firm_monthly,
 * attorney_firm_charter_monthly).
 */

/** Charter cohort cap — must match the guard in payments.functions.ts. */
export const CHARTER_COHORT_CAP = 10;

export type Tier = {
  key: string;
  name: string;
  price: string;
  priceStrike?: string;
  sub: string;
  eyebrowNote?: string;
  quote: string;
  features: string[];
  cta: string;
  ctaTo: string;
  featured?: boolean;
};

export const BASE_TIERS: Tier[] = [
  {
    key: "survivor",
    name: "Survivor",
    price: "Free",
    sub: "no cost",
    quote: "Built by a survivor, for survivors. Free for survivors.",
    features: [
      "Unlimited incident logging",
      "Photo, document & audio evidence upload",
      "Structured chronological timeline",
      "Pattern detection",
      "Court packet export — printable case summary (HTML/PDF), free",
      "Attorney sharing — send a secure link to your attorney, free",
      "Encrypted in transit; per-user access controls",
    ],
    cta: "Start Documenting Free",
    ctaTo: "/login",
  },
  {
    key: "court_ready",
    name: "Court Ready",
    price: "Pay what you can",
    sub: "$1 – $500",
    quote: "An optional, one-time contribution if PatternProof helped you. It does not unlock anything — every survivor feature is already free.",
    features: [
      "Everything in Survivor — already included at no cost",
      "No features are gated behind this contribution",
      "One-time payment, any amount from $1 to $500",
      "Helps keep the app free for survivors who can't contribute",
    ],
    cta: "Contribute what you can",
    ctaTo: "/login",
  },
  {
    key: "attorney_solo",
    name: "Solo Attorney",
    price: "$297",
    sub: "/month · Solo",
    quote: "For solo practitioners taking DV and custody cases one at a time.",
    features: [
      "Single attorney account (seats and matter counts are not metered today)",
      "Structured chronological timeline",
      "Source-linked supporting records",
      "Exportable case summary (ZIP) — imports into practice management systems",
      "Survivor vs. AI-suggested content clearly distinguished",
    ],
    cta: "Start with Solo",
    ctaTo: "/lawyer-signup",
  },
  // The Firm tier is inserted at runtime (see buildTiers below) so the
  // Charter rate + remaining-seat copy stays in sync with live cohort state.
  {
    key: "organization",
    name: "DV Organization",
    price: "Free",
    sub: "for every survivor you refer",
    quote: "You are a partner, not a customer. Your survivors never pay.",
    features: [
      "Free for every survivor your organization refers",
      "Referral link so we can attribute outcomes back to your advocacy",
      "Priority support for your intake team",
      "Direct line to the PatternProof team",
      "We onboard a limited number of organizations at a time",
    ],
    cta: "Partner with us",
    ctaTo: "/request-org-access",
  },
];

export function buildTiers(remainingCharter: number | null): Tier[] {
  const charterFull = remainingCharter !== null && remainingCharter <= 0;
  const firm: Tier = charterFull
    ? {
        key: "attorney_firm",
        name: "Firm",
        price: "$897",
        sub: "/month · shared firm workspace",
        eyebrowNote: "Charter cohort is full — thank you.",
        quote: "Built for 3–15 attorney family-law firms.",
        features: [
          "Shared firm workspace — invite colleagues to a case (seat counts are not metered today)",
          "Everything in Solo Attorney",
          "No matter limit enforced today",
          "Multi-attorney collaboration and shared case notes",
          "Caseload and capacity view across the firm",
          "Conflict-of-interest check across your own PatternProof caseload",
          "Priority client onboarding + practice-management-ready exports",
        ],
        cta: "Start with Firm",
        ctaTo: "/lawyer-signup",
        featured: true,
      }
    : {
        key: "attorney_firm",
        name: "Firm",
        price: "$597",
        priceStrike: "$897",
        sub: "/month · locked for 12 months",
        eyebrowNote:
          remainingCharter === null
            ? `Charter program — limited to ${CHARTER_COHORT_CAP} firms`
            : `${remainingCharter} of ${CHARTER_COHORT_CAP} Charter spots remaining`,
        quote: "Built for 3–15 attorney family-law firms.",
        features: [
          "Shared firm workspace — invite colleagues to a case (seat counts are not metered today)",
          "Everything in Solo Attorney",
          "No matter limit enforced today",
          "Multi-attorney collaboration and shared case notes",
          "Caseload and capacity view across the firm",
          "Conflict-of-interest check across your own PatternProof caseload",
          "Charter program: personal setup, case import, and staff training",
          "$597/month rate locked for 12 months, then $897/month list",
        ],
        cta: "Apply for the Charter program",
        ctaTo: "/lawyer-signup",
        featured: true,
      };
  // Order: Survivor · Court Ready · Solo · Firm (featured, middle) · DV Organization
  return [BASE_TIERS[0], BASE_TIERS[1], BASE_TIERS[2], firm, BASE_TIERS[3]];
}
