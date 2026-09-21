import { planForPrice, matchesAdvertisedPrice } from "./attorney-offer";

// Narrow adapter for new tables until the reviewed migration's types are regenerated.
type DB = import("@supabase/supabase-js").SupabaseClient<any>;
export type OfferSettings = {
  enabled: boolean;
  nurture_enabled: boolean;
  payment_environment: "live" | "sandbox";
};
const disabled: OfferSettings = {
  enabled: false,
  nurture_enabled: false,
  payment_environment: "live",
};

const legacyAttorneyPrices = new Set([
  "attorney_solo_monthly",
  "attorney_firm_monthly",
  "attorney_firm_charter_monthly",
  "attorney_enterprise_monthly",
  "attorney_portal_monthly_297",
]);
export function activeSubscription(
  row: { status: string; current_period_end: string | null },
  now = Date.now(),
) {
  const end = row.current_period_end ? Date.parse(row.current_period_end) : null;
  if (end !== null && (!Number.isFinite(end) || end <= now)) return false;
  return (
    ["active", "trialing", "past_due"].includes(row.status) ||
    (row.status === "canceled" && end !== null)
  );
}

export async function offerPaidSubscription(db: DB, userId: string) {
  const cfg = await readOfferSettings(db);
  const { data: membership, error: memberError } = await db
    .from("firm_members")
    .select("firm_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (memberError) throw new Error("Unable to verify workspace membership");
  let payer = userId;
  if (membership) {
    const { data: firm, error } = await db
      .from("firms")
      .select("created_by")
      .eq("id", membership.firm_id)
      .maybeSingle();
    if (error || !firm) throw new Error("Unable to verify workspace owner");
    payer = firm.created_by;
  }
  const { data: rows, error } = await db
    .from("subscriptions")
    .select("status,current_period_end,price_id,cancel_at_period_end")
    .eq("user_id", payer)
    .eq("environment", cfg.payment_environment)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Unable to verify workspace plan");
  const { data: reviewed, error: reviewError } = cfg.enabled
    ? await db
        .from("attorney_conversion_accounts")
        .select("approved_at")
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null, error: null };
  if (reviewError) throw new Error("Unable to verify attorney access review");
  return (
    (rows ?? []).find(
      (row: { price_id: string; status: string; current_period_end: string | null }) => {
        const plan = planForPrice(row.price_id);
        if (payer !== userId && plan && plan.seats < 2) return false;
        if (
          payer !== userId &&
          !plan &&
          !row.price_id?.includes("firm") &&
          !row.price_id?.includes("enterprise")
        )
          return false;
        return (
          activeSubscription(row) &&
          (plan ? cfg.enabled && !!reviewed?.approved_at : legacyAttorneyPrices.has(row.price_id))
        );
      },
    ) ?? null
  );
}

/** Adds a billing boundary for the new offer without replacing consent checks. */
export async function assertOfferCaseAccess(db: DB, userId: string, clientId: string) {
  if (!(await readOfferSettings(db)).enabled) return;
  if (await offerPaidSubscription(db, userId)) return;
  const { data: profile, error } = await db
    .from("attorney_profiles")
    .select("trial_ends_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Unable to verify workspace access");
  if (profile?.trial_ends_at && Date.parse(profile.trial_ends_at) > Date.now()) return;
  if (!(await hasFreeCaseAccess(db, userId, clientId)))
    throw new Error("Choose a plan to open an additional case.");
}

export async function readOfferSettings(db: DB): Promise<OfferSettings> {
  const { data, error } = await db
    .from("attorney_conversion_settings")
    .select("enabled,nurture_enabled,payment_environment")
    .eq("id", 1)
    .maybeSingle();
  // An unapplied migration or unavailable backend cannot activate an offer.
  if (error || !data) return disabled;
  return data as OfferSettings;
}

export async function freeCaseState(db: DB, userId: string) {
  const settings = await readOfferSettings(db);
  if (!settings.enabled) return null;
  const { data, error } = await db
    .from("attorney_conversion_accounts")
    .select("approved_at,discount_approved_at,free_matter_id,free_link_id,free_case_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("We couldn't verify your first case access. Try again.");
  return data;
}

/** Free billing entitlement is specific to a grant and case, never all of a client's data. */
export async function hasFreeCaseAccess(db: DB, userId: string, clientId: string) {
  const account = await freeCaseState(db, userId);
  if (!account?.approved_at || !account.free_link_id || !account.free_case_id) return false;
  const { data: link, error } = await db
    .from("attorney_client_links")
    .select("id,case_id,status,expires_at")
    .eq("id", account.free_link_id)
    .eq("attorney_user_id", userId)
    .eq("client_user_id", clientId)
    .maybeSingle();
  if (error) throw new Error("We couldn't verify this case's sharing permission.");
  return (
    !!link &&
    link.status === "active" &&
    link.case_id === account.free_case_id &&
    (!link.expires_at || new Date(link.expires_at).getTime() > Date.now())
  );
}

export async function validateOfferCheckout(
  db: DB,
  userId: string,
  environment: string,
  lookupKey: string,
  price: Parameters<typeof matchesAdvertisedPrice>[0],
) {
  const plan = planForPrice(lookupKey);
  if (!plan) return;
  const settings = await readOfferSettings(db);
  if (!settings.enabled || environment !== settings.payment_environment)
    throw new Error("This plan is not available for checkout yet.");
  const account = await freeCaseState(db, userId);
  if (!account?.approved_at)
    throw new Error("Your attorney access review must be completed before checkout.");
  if (plan.approval && !account.discount_approved_at)
    throw new Error("The Legal Aid / Founding rate requires approval.");
  if (!matchesAdvertisedPrice(price, lookupKey))
    throw new Error("Checkout pricing does not match the advertised plan. No payment was created.");
}
