/**
 * Single source of truth for public pricing tiers.
 *
 * Imported by /pricing and /for-attorneys so the two marketing pages can never
 * drift apart on tier names, prices, or the live Charter remaining-spot count.
 * Prices here must match the live Stripe price lookup keys used in
 * src/lib/payments.functions.ts (attorney_solo_monthly, attorney_firm_monthly,
 * attorney_firm_charter_monthly).
 * Attorney beta policy: docs/attorney-beta-pricing.md. Solo remains $297/month;
 * the private free beta is separate from paid checkout and the Charter program.
 */

/** Charter cohort cap — must match the guard in payments.functions.ts. */
export const CHARTER_COHORT_CAP = 10;

/** Hard maximum members per firm — must match FIRM_SEAT_MAX in firm-grants.functions.ts. */
export const FIRM_SEAT_MAX = 5;

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
      "Professional-review packet export — printable case summary (HTML/PDF), free",
      "Attorney sharing — send a secure link to your attorney, free",
      "Encrypted in transit; per-user access controls",
    ],
    cta: "Start Documenting Free",
    ctaTo: "/login",
  },
  {
    key: "court_ready",
    name: "Contribute",
    price: "Pay what you can",
    sub: "$1 – $500",
    quote:
      "An optional, one-time contribution if PatternProof helped you. It does not unlock anything — every survivor feature is already free.",
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
      "Single attorney account",
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
      "Self-serve sign-up — start in minutes",
    ],
    cta: "Partner with us",
    ctaTo: "/org-signup",
  },
];

/**
 * Shared feature-bullet content for the attorney portal's internal
 * billing.tsx (post-purchase account management) and subscribe.tsx
 * (pre-purchase paywall) pages. Those two pages each show firm_charter and
 * firm as distinct, separately selectable tiers — unlike buildTiers() below,
 * which returns one auto-switching "Firm" row for the public marketing
 * pages — so they can't just import buildTiers() output directly. This is
 * the single source for the bullet *content* so the two internal pages
 * can't reword or drop features independently of each other again.
 */
export const ATTORNEY_PORTAL_TIER_BULLETS: {
  solo: string[];
  firm_charter: string[];
  firm: string[];
} = {
  solo: [
    "Single attorney account",
    "Structured chronological timeline + pattern analysis",
    "Exportable case summary (ZIP) — imports into practice management systems",
    "Private attorney notes per incident",
    "Conflict check across your own caseload",
  ],
  firm_charter: [
    `Shared firm workspace — up to ${FIRM_SEAT_MAX} seats`,
    "Everything in Solo Attorney",
    "No matter limit enforced today",
    "Multi-attorney collaboration and shared case notes",
    "Caseload and capacity view across the firm",
    "Conflict check across your own caseload",
    "Charter program: personal setup, case import, and staff training",
    "$597/month rate locked for 12 months, then $897/month list",
  ],
  firm: [
    `Shared firm workspace — up to ${FIRM_SEAT_MAX} seats`,
    "Everything in Solo Attorney",
    "No matter limit enforced today",
    "Multi-attorney collaboration and shared case notes",
    "Caseload and capacity view across the firm",
    "Conflict check across your own caseload",
    "Priority client onboarding + practice-management-ready exports",
  ],
};

export function buildTiers(remainingCharter: number | null): Tier[] {
  const charterFull = remainingCharter !== null && remainingCharter <= 0;
  const firm: Tier = charterFull
    ? {
        key: "attorney_firm",
        name: "Firm",
        price: "$897",
        sub: "/month · shared firm workspace",
        eyebrowNote: "Charter cohort is full — thank you.",
        quote: `Built for small family-law firms — up to ${FIRM_SEAT_MAX} seats.`,
        features: [
          `Shared firm workspace — up to ${FIRM_SEAT_MAX} seats`,
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
        quote: `Built for small family-law firms — up to ${FIRM_SEAT_MAX} seats.`,
        features: [
          `Shared firm workspace — up to ${FIRM_SEAT_MAX} seats`,
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
  // Order: Survivor · Contribute · Solo · Firm (featured, middle) · DV Organization
  return [BASE_TIERS[0], BASE_TIERS[1], BASE_TIERS[2], firm, BASE_TIERS[3]];
}
