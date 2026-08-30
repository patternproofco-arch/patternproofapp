# Attorney beta pricing decision

Updated August 30, 2026, at the founder's direction.

## Pricing

The proposed $29/month attorney offer is rejected and superseded. Do not use it in outreach, beta materials, product copy or checkout configuration.

Solo Attorney remains $297/month for one attorney account. Use this as the starting price to validate in interviews, not as evidence of willingness to pay or measured return on investment.

Preserve the existing Firm price of $897/month and Charter Firm price of $597/month for 12 months under the existing program terms. This decision does not approve new firm prices, seat allowances or matter limits. Evaluate future packaging using attorney seats, active client matters, storage, AI costs and support effort.

Survivor access remains free permanently. Optional contributions do not unlock features.

## Founding Attorney Beta

The private beta is separate from the existing paid Charter Firm program and public subscription checkout.

Offer a defined free beta period. The recommended duration is 60 days from onboarding, with any extension to 90 days confirmed in writing. Confirm each participant's start and end dates before enrollment.

No automatic paid conversion. A later paid subscription requires separately accepted pricing and terms. Do not promise permanent discounted pricing or enroll beta participants in a recurring paid checkout to grant free access.

Start with fictional data. Real client use requires verified survivor control, database enforced access, recorded consent, accurate AI disclosures, incident response and an honest security model, along with appropriate professional review. A free beta does not waive these requirements.

PatternProof is a client controlled organization tool, not a law firm. It does not provide legal advice or guarantee privilege, admissibility or outcomes.

## Implementation boundary

The current default branch already displays $297 for Solo in public pricing, attorney subscription and billing pages, and homepage structured data. There is no need to lower or replace that price.

This update records policy only. It does not implement beta entitlements, change Stripe products or prices, migrate subscriptions, grant access, or deploy the application. Before paid conversion, verify the actual Stripe amount, currency, recurring interval and entitlements against the accepted offer. Do not infer live billing configuration from display copy.

Pricing display source: `src/lib/pricing-tiers.ts`. Payment lookup implementation: `src/lib/payments.functions.ts`.

Planning source: [PatternProof Execution Plan](https://app.notion.com/p/3cc8ac0db7da81be9974d4d787ca1302).
