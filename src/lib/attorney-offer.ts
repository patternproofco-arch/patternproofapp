/** Versioned prices never reuse lookup keys belonging to existing subscribers. */
export const ATTORNEY_PLANS = [
  {
    key: "solo",
    name: "Solo",
    monthly: 69,
    cases: 5,
    seats: 1,
    lookupKey: "attorney_solo_v2_monthly",
    approval: false,
  },
  {
    key: "legal_aid",
    name: "Legal Aid / Founding",
    monthly: 49,
    cases: 5,
    seats: 1,
    lookupKey: "attorney_legal_aid_v2_monthly",
    approval: true,
  },
  {
    key: "practice",
    name: "Practice",
    monthly: 229,
    cases: 25,
    seats: 5,
    lookupKey: "attorney_practice_v2_monthly",
    approval: false,
  },
  {
    key: "firm",
    name: "Firm",
    monthly: 369,
    cases: 50,
    seats: 10,
    lookupKey: "attorney_firm_v2_monthly",
    approval: false,
  },
] as const;

export const FIRST_CASE_MESSAGE =
  "Your first case is free. To manage additional cases, choose a plan.";
export const OFFER_SIGNUP_PATH = "/lawyer-signup";

export const ATTORNEY_PLAN_VALUE = {
  solo: "One attorney workspace for up to 5 active cases: source linked chronology, private attorney notes, scoped file review, and authorized exports.",
  legal_aid:
    "The same 5 case, 1 seat workspace at a reviewed discount for eligible legal aid or founding attorneys. Eligibility requires approval.",
  practice:
    "Everything in Solo, with a shared workspace for up to 5 seats and a pool of 25 active cases. Assign team access to specific shared files.",
  firm: "Everything in Practice, with up to 10 seats and a pool of 50 active cases for a larger team. Client sharing permissions still control access.",
} as const;

export function planForPrice(priceId: string | null | undefined) {
  return ATTORNEY_PLANS.find((plan) => plan.lookupKey === priceId);
}

export function matchesAdvertisedPrice(
  price: {
    active: boolean;
    currency: string;
    unit_amount: number | null;
    recurring: { interval: string; interval_count: number; usage_type?: string } | null;
  },
  lookupKey: string,
) {
  const plan = planForPrice(lookupKey);
  return (
    !!plan &&
    price.active &&
    price.currency === "usd" &&
    price.unit_amount === plan.monthly * 100 &&
    price.recurring?.interval === "month" &&
    price.recurring.interval_count === 1 &&
    price.recurring.usage_type !== "metered"
  );
}

export const ATTORNEY_FAQS = [
  {
    q: "Does PatternProof guarantee privilege or admissibility?",
    a: "No. PatternProof is documentation software. It does not establish an attorney relationship, decide privilege, certify evidence, or guarantee admissibility. Review the sources and decide what is appropriate for your matter.",
  },
  {
    q: "Who controls the documentation?",
    a: "The survivor controls their documentation and chooses what to share. An attorney account, payment, or invitation does not by itself grant access to a survivor's records.",
  },
  {
    q: "Can I export the shared material?",
    a: "Authorized exports include the records within the current sharing scope. They do not include every record a client holds. Review each export before using it; downloaded copies remain in the recipient's possession after access ends.",
  },
  {
    q: "What happens when sharing is revoked?",
    a: "New access requests are checked against the current grant. Previously issued links to original evidence can remain usable for up to 60 seconds. Generated professional packets are scheduled for deletion on revocation; deletion can fail if storage is unavailable. Previously downloaded copies cannot be recalled.",
  },
  {
    q: "Are originals and metadata preserved?",
    a: "The evidence workflow preserves the uploaded original and records a SHA-256 fingerprint. A matching fingerprint can detect byte changes; it cannot prove who created a file or whether its contents are true. Location metadata is handled separately from ordinary sharing. Review your specific upload and export before relying on it.",
  },
  {
    q: "Can PatternProof or its providers access content?",
    a: "Server processing and authorized service providers are involved in storage and requested processing. PatternProof does not promise that no operator or provider can access content, or that the service is end-to-end encrypted. See the Privacy Policy for data handling details.",
  },
  {
    q: "What encryption is promised?",
    a: "Connections use encryption in transit. This page does not promise client-only encryption or independently verified encryption at rest. Review the Privacy Policy and ask about requirements specific to your practice.",
  },
  {
    q: "What about legal requests and subpoenas?",
    a: "The software does not make records immune to legal process. Consult the Privacy Policy and your own professional obligations before uploading or sharing sensitive information. Do not send client evidence through a sales or support email.",
  },
  {
    q: "What if a client needs help or uses a shared device?",
    a: "Offer the printable worksheet or a supported walkthrough without pressure. Quick Exit changes the screen; it does not erase browser history, downloads, notifications, or other device traces. The client decides whether and when using the app is appropriate.",
  },
  {
    q: "Is Clio included and proven?",
    a: "Clio remains an integration that needs separate configuration and verification. Do not rely on it until your connection and a fictional export have been tested. The sample download works without Clio.",
  },
] as const;

export const CLIENT_INVITATION_TEMPLATE = `Subject: An optional way to organize your documentation

Hi [Client Name],

If it is safe and useful for you, PatternProof can help you organize notes, photos, and messages. Survivor documentation is free. You decide what to share and when.

1. Visit https://pattern-proof.tech/signup on a device you can use safely.
2. Create a case and add only the records you want to document. Review suggested dates and entries before confirming them.
3. When you are ready, use Share with attorney and enter my verified work email: [Attorney Email]. Choose this case and review the sharing scope.

Creating an account does not automatically share anything with me. Quick Exit changes the screen but does not erase browser history or downloads. You can stop sharing; copies already downloaded cannot be recalled.

You can use the printable worksheet instead. There is no pressure to use the app.

[Attorney Name]`;
