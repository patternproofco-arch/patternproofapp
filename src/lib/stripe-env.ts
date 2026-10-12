/**
 * Stripe environment detection. Deliberately has NO dependency on
 * @stripe/stripe-js so pricing, billing, attorney and case pages can ask
 * "is checkout configured / sandbox or live?" without pulling Stripe.js
 * (and its js.stripe.com script injection) into their bundle.
 */
export type StripeEnv = "sandbox" | "live";

export function getPaymentsClientToken(): string {
  const token = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
  if (token?.startsWith("pk_test_") || token?.startsWith("pk_live_")) return token;
  throw new Error(
    "Stripe payments are not configured for this build. Complete Stripe go-live to enable production checkout.",
  );
}

export function getStripeEnvironment(): StripeEnv {
  return getPaymentsClientToken().startsWith("pk_live_") ? "live" : "sandbox";
}
