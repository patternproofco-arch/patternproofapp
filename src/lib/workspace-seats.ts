/** Client-safe workspace seat constants and helpers. */

/** Seats included with the Firm plan. */
export const FIRM_INCLUDED_SEATS = 3;
/** Hard cap on people in one firm workspace. Unrelated to the Charter cohort cap. */
export const FIRM_MAX_SEATS = 10;
/** Stripe price lookup key for the additional attorney seat. */
export const SEAT_PRICE_LOOKUP_KEY = "attorney_seat_monthly";
/** Additional seat price, in cents, per month. */
export const SEAT_PRICE_CENTS = 9900;

export function newInviteToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
