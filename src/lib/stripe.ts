import type { Stripe } from "@stripe/stripe-js";
import { getPaymentsClientToken, getStripeEnvironment, type StripeEnv } from "@/lib/stripe-env";

export { getStripeEnvironment, type StripeEnv };

/**
 * The only pages allowed to load Stripe.js (js.stripe.com). Never case,
 * binder, attorney-client or survivor record pages.
 */
export const STRIPE_ALLOWED_PATHS: readonly string[] = Object.freeze(["/subscribe", "/contribute"]);

export function isStripeAllowedPath(pathname: string): boolean {
  let p = pathname.split(/[?#]/)[0] || "/";
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return STRIPE_ALLOWED_PATHS.includes(p);
}

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Lazily loads Stripe.js. Uses `@stripe/stripe-js/pure` through a dynamic
 * import: the package's main entry injects the js.stripe.com <script> as a
 * side effect of merely being imported, `/pure` only injects when
 * loadStripe() is called. Refuses to load outside /subscribe and /contribute.
 */
export function getStripe(): Promise<Stripe | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!isStripeAllowedPath(window.location.pathname)) {
    return Promise.reject(new Error("Stripe.js may only load on /subscribe or /contribute."));
  }
  if (!stripePromise) {
    const token = getPaymentsClientToken();
    stripePromise = import("@stripe/stripe-js/pure")
      .then(({ loadStripe }) => loadStripe(token))
      .catch((err) => {
        stripePromise = null;
        throw err;
      });
  }
  return stripePromise;
}
