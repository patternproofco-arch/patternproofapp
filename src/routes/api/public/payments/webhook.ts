import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

async function handleSubscriptionCreated(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata");
    return;
  }
  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.lookup_key
    || item?.price?.metadata?.lovable_external_id
    || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  // Charter Firm — locked rate for 12 months from first activation.
  const isCharter = priceId === "attorney_firm_charter_monthly"
    || subscription.metadata?.plan_tier === "charter";
  const planTier = isCharter ? "charter" : null;
  // Preserve an existing expiry rather than resetting on every webhook.
  const supabase = getSupabase();
  let charterExpiresAt: string | null = null;
  if (isCharter) {
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("charter_rate_expires_at")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();
    const existingExpiry = (existing as { charter_rate_expires_at: string | null } | null)?.charter_rate_expires_at;
    charterExpiresAt = existingExpiry
      ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  }

  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      environment: env,
      plan_tier: planTier,
      charter_rate_expires_at: charterExpiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
}

async function handleSubscriptionUpdated(subscription: any, env: StripeEnv) {
  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.lookup_key
    || item?.price?.metadata?.lovable_external_id
    || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const isCharter = priceId === "attorney_firm_charter_monthly";
  const supabase = getSupabase();
  const update: Record<string, unknown> = {
    status: subscription.status,
    product_id: productId,
    price_id: priceId,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end || false,
    updated_at: new Date().toISOString(),
  };
  // If the price moved off the charter price, clear the flag; otherwise leave
  // plan_tier / charter_rate_expires_at untouched (never reset the locked window).
  if (!isCharter && priceId) {
    update.plan_tier = null;
  }
  await supabase
    .from("subscriptions")
    .update(update)
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
  if (["canceled", "unpaid", "incomplete_expired"].includes(subscription.status)) {
    await pauseAttorneyAccessIfApplicable(subscription);
  }
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
  await pauseAttorneyAccessIfApplicable(subscription);
}

/**
 * Court Ready Pay-What-You-Can: a one-time payment that grants 12 months
 * of Court Ready access. We synthesize a `subscriptions` row keyed on the
 * checkout session id so `useSubscription` / `tier` resolution works the
 * same as the recurring plan.
 */
async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  if (session.mode !== "payment") return;
  if (session.metadata?.tier !== "court_ready_pwyc") return;
  const userId = session.metadata?.userId;
  if (!userId) return;
  const now = new Date();
  const oneYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  await getSupabase().from("subscriptions").upsert(
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
}

/**
 * When an attorney's subscription ends, pause every active client link
 * and notify each affected survivor. Survivors keep their data — only
 * the attorney's shared view is suspended until they re-subscribe.
 */
async function pauseAttorneyAccessIfApplicable(subscription: any) {
  const attorneyUserId: string | undefined = subscription.metadata?.userId;
  if (!attorneyUserId) return;
  const supabase = getSupabase();

  const { data: isAttorney } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", attorneyUserId)
    .eq("role", "attorney")
    .maybeSingle();
  if (!isAttorney) return;

  const { data: links } = await supabase
    .from("attorney_client_links")
    .select("id, client_user_id")
    .eq("attorney_user_id", attorneyUserId)
    .eq("status", "active");
  if (!links || links.length === 0) return;

  const ids = links.map((l: any) => l.id);
  await supabase
    .from("attorney_client_links")
    .update({ status: "paused", updated_at: new Date().toISOString() })
    .in("id", ids);

  const rows = links.map((l: any) => ({
    user_id: l.client_user_id,
    kind: "attorney_access_paused",
    title: "Your attorney's access is paused",
    body: "Your records are safe and unchanged. Your attorney's shared view is paused until their subscription is active again.",
    metadata: { link_id: l.id, attorney_user_id: attorneyUserId },
  }));
  if (rows.length) await supabase.from("notifications").insert(rows);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "customer.subscription.created":
      await handleSubscriptionCreated(event.data.object, env);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object, env);
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