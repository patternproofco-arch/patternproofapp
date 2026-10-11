import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { type StripeEnv, createStripeClient, verifyWebhook } from "@/lib/stripe.server";

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _supabase;
}

async function syncAttorneyBillingAccess(userId: string | undefined, env: StripeEnv) {
  if (!userId) return;
  const { error } = await getSupabase().rpc("sync_attorney_billing_access", {
    _attorney_id: userId,
    _environment: env,
  });
  if (error) throw new Error(`Could not synchronize attorney billing access: ${error.message}`);
}

async function synchronizeSubscription(subscription: Stripe.Subscription, env: StripeEnv) {
  const supabase = getSupabase();
  const { data: existingOwner, error: ownerError } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env)
    .maybeSingle();
  if (ownerError) throw new Error(`Could not read subscription owner: ${ownerError.message}`);
  if (
    existingOwner?.user_id &&
    subscription.metadata?.userId &&
    existingOwner.user_id !== subscription.metadata.userId
  ) {
    throw new Error("Subscription ownership conflict");
  }
  const userId = existingOwner?.user_id ?? subscription.metadata?.userId;
  // Subscriptions outside the application have no bound account.
  if (!userId) return;
  const item = subscription.items?.data?.[0];
  const priceId =
    item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start;
  const periodEnd = item?.current_period_end;

  // Charter Firm — locked rate for 12 months from first activation.
  const isCharter = priceId === "attorney_firm_charter_monthly";
  const planTier = isCharter ? "charter" : null;
  // Preserve an existing expiry rather than resetting on every webhook.
  let charterExpiresAt: string | null = null;
  if (isCharter) {
    const { data: existing, error: readError } = await supabase
      .from("subscriptions")
      .select("charter_rate_expires_at")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();
    if (readError) throw new Error(`Could not read charter subscription: ${readError.message}`);
    const existingExpiry = (existing as { charter_rate_expires_at: string | null } | null)
      ?.charter_rate_expires_at;
    charterExpiresAt =
      existingExpiry ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  }

  const { error: writeError } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      environment: env,
      plan_tier: planTier,
      charter_rate_expires_at: charterExpiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
  if (writeError) throw new Error(`Could not save subscription: ${writeError.message}`);
  await syncAttorneyBillingAccess(userId, env);
}

/**
 * Professional Review Pay-What-You-Can: a one-time payment that grants 12
 * months of Professional Review access. We synthesize a `subscriptions` row keyed on the
 * checkout session id so `useSubscription` / `tier` resolution works the
 * same as the recurring plan.
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  env: StripeEnv,
  eventCreated: number,
) {
  if (session.mode !== "payment") return;
  if (session.metadata?.tier !== "court_ready_pwyc") return;
  const userId = session.metadata?.userId;
  if (!userId) return;
  if (session.payment_status !== "paid") return;
  // Verify the amount Stripe actually collected, not the client-requested one.
  const paid = session.amount_total ?? 0;
  if ((session.currency ?? "").toLowerCase() !== "usd" || paid < 100 || paid > 50000) {
    console.warn("[payments] PWYC session outside allowed range; not granting access");
    return;
  }
  // A replay must not move the purchase date or extend the paid year.
  const now = new Date(eventCreated * 1000);
  const oneYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const supabase = getSupabase();

  // Source of truth for the Professional Review export paywall. Written with the
  // service role only — the client can read its own row, never write it.
  const { error: entErr } = await supabase.from("entitlements").upsert(
    {
      user_id: userId,
      court_ready_paid: true,
      paid_at: now.toISOString(),
      amount_paid: typeof session.amount_total === "number" ? session.amount_total / 100 : null,
      stripe_checkout_session_id: session.id,
      updated_at: now.toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (entErr) {
    // Never swallow this: the payment succeeded even though we failed to
    // record entitlement. Log loudly so it can be reconciled by hand.
    console.error(
      "[payments] ENTITLEMENT WRITE FAILED",
      JSON.stringify({
        user_id: userId,
        session_id: session.id,
        amount_total: session.amount_total,
        environment: env,
        error: entErr.message,
      }),
    );
  }

  const { error: subscriptionError } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: `pwyc_${session.id}`,
      stripe_customer_id: session.customer,
      product_id: "court_ready",
      price_id: "court_ready_monthly",
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: oneYear.toISOString(),
      cancel_at_period_end: true,
      environment: env,
      updated_at: now.toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
  if (subscriptionError) {
    throw new Error(
      `Could not save Professional Review subscription: ${subscriptionError.message}`,
    );
  }

  // Signal failure only after the rest of the record is persisted, so Stripe
  // retries the event and the entitlement eventually lands.
  if (entErr) throw new Error(`entitlement write failed for session ${session.id}`);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      // Stripe may deliver events out of order. Persist its current state,
      // rather than letting an older event overwrite a newer subscription.
      const current = await createStripeClient(env).subscriptions.retrieve(event.data.object.id);
      await synchronizeSubscription(current, env);
      break;
    }
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object, env, event.created);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
