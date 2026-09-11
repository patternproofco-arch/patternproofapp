/**
 * Public pricing tiers. Survivors free. Attorneys pay. Orgs partner at no cost.
 * No public pay-what-you-can tier.
 */

export const CHARTER_COHORT_CAP = 10;
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
      "Photo, document and audio evidence",
      "Source-linked chronology",
      "Pattern counts, not legal conclusions",
      "Professional-review packet — free",
      "Share a link with an attorney or advocate — free",
    ],
    cta: "Start documenting",
    ctaTo: "/signup",
  },
  {
    key: "attorney_solo",
    name: "Solo Attorney",
    price: "$297",
    sub: "/month · Solo",
    quote: "For solo practitioners taking DV and custody cases one at a time.",
    features: [
      "Single attorney account",
      "Source-linked chronology",
      "ZIP export for practice management",
      "Survivor words kept distinct from any tool suggestion",
    ],
    cta: "Create an attorney account",
    ctaTo: "/lawyer-signup",
  },
  {
    key: "organization",
    name: "DV Organization",
    price: "Free",
    sub: "for every survivor you refer",
    quote: "You are a partner, not a customer. Your survivors never pay.",
    features: [
      "Free for every survivor you refer",
      "Print the intake QR at /intake",
      "Survivor keeps the file",
      "Create an organization account — no invitation gate",
    ],
    cta: "Create an organization account",
    ctaTo: "/org-signup",
  },
];

export const ATTORNEY_PORTAL_TIER_BULLETS: {
  solo: string[];
  firm_charter: string[];
  firm: string[];
} = {
  solo: [
    "Single attorney account",
    "Structured chronological timeline + pattern analysis",
    "Exportable case summary (ZIP)",
    "Private attorney notes per incident",
    "Conflict check across your own caseload",
  ],
  firm_charter: [
    `Shared firm workspace — up to ${FIRM_SEAT_MAX} seats`,
    "Everything in Solo Attorney",
    "Charter program: personal setup and staff training",
    "$597/month locked 12 months, then $897",
  ],
  firm: [
    `Shared firm workspace — up to ${FIRM_SEAT_MAX} seats`,
    "Everything in Solo Attorney",
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
        ],
        cta: "Create a firm account",
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
          "Charter: setup, case import, staff training",
          "$597/month locked 12 months, then $897",
        ],
        cta: "Create a Charter firm account",
        ctaTo: "/lawyer-signup",
        featured: true,
      };
  return [BASE_TIERS[0], BASE_TIERS[1], firm, BASE_TIERS[2]];
}
