import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal-versions";


/**
 * TEMPORARY Verifier prove-it hook helpers — remove after Verifier PASS on
 * compensate-delete. Env-gated only (never query/body). Off by default.
 */
function isOnboardingForceMetaFailEnabled(): boolean {
  return (
    process.env.ONBOARDING_FORCE_META_FAIL === "1" ||
    process.env.PATTERNPROOF_FORCE_ONBOARDING_META_FAIL === "1"
  );
}

/** Guardian CLEAR: refuse the force-fail hook on live/public production. */
function onboardingForceMetaFailBlockReason(): string | null {
  const paymentsToken = process.env.VITE_PAYMENTS_CLIENT_TOKEN ?? "";
  if (paymentsToken.startsWith("pk_live_")) {
    return "Stripe live mode (pk_live_)";
  }
  const stripeEnv = (process.env.VITE_STRIPE_ENV || process.env.STRIPE_ENV || "").toLowerCase();
  if (stripeEnv === "live") {
    return "Stripe env=live";
  }

  const siteCandidates = [process.env.SITE_URL, process.env.PUBLIC_SITE_URL].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  for (const raw of siteCandidates) {
    try {
      const host = new URL(raw).hostname.toLowerCase();
      if (
        host === "pattern-proof.tech" ||
        host === "www.pattern-proof.tech" ||
        host === "attorney.pattern-proof.tech"
      ) {
        return `public production host (${host})`;
      }
    } catch {
      /* ignore malformed */
    }
  }

  if ((process.env.PATTERNPROOF_ENV || "").toLowerCase() === "production") {
    return "PATTERNPROOF_ENV=production";
  }

  // Workers often set NODE_ENV=production; allow only when SITE_URL clearly
  // points at a non-prod preview/staging host. Otherwise refuse.
  if (process.env.NODE_ENV === "production") {
    const explicitNonProd = siteCandidates.some((raw) => {
      try {
        const host = new URL(raw).hostname.toLowerCase();
        return (
          host === "localhost" ||
          host.endsWith(".localhost") ||
          host.endsWith(".workers.dev") ||
          host.endsWith(".lovable.app") ||
          host.endsWith(".lovable.dev") ||
          host.includes("preview") ||
          host.includes("staging")
        );
      } catch {
        return false;
      }
    });
    if (!explicitNonProd) {
      return "NODE_ENV=production without a non-production SITE_URL";
    }
  }

  return null;
}

export const recordLegalAcceptance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        accepted: z.literal(true),
        account_type: z.enum(["survivor", "attorney", "organization"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_terms_acceptance").insert({
      user_id: context.userId,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      account_type: data.account_type,
    });
    if (error && error.code !== "23505") throw new Error(error.message);
    return { ok: true as const, terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION };
  });

/**
 * Atomic survivor onboarding finish: record legal acceptance AND set
 * onboarding_complete metadata under the authenticated user id via the
 * admin Auth API. Success only if both persist; on metadata failure we
 * compensate by removing the acceptance row so we never leave terms
 * written without onboarding_complete.
 *
 * Client updateUser is intentionally not used — intermittent "Auth session
 * missing!" left a half-state when terms were already inserted.
 */
export const completeSurvivorOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        accepted: z.literal(true),
        state: z.string().max(8).optional().default(""),
        city: z.string().max(120).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Auth-bound: only the signed-in caller (context.userId). Never accepts a
    // target user id from the client.
    const userId = context.userId;
    const acceptedAt = new Date().toISOString();
    const city = data.city.trim();
    const state = data.state.trim();

    // TEMPORARY Verifier prove-it (remove after Verifier PASS on compensate-delete).
    // Env-only, OFF by default — never a query/body flag.
    const forceMetaFail = isOnboardingForceMetaFailEnabled();
    if (forceMetaFail) {
      const blocked = onboardingForceMetaFailBlockReason();
      if (blocked) {
        // Hard-deny on production / Stripe live / public prod host BEFORE any write.
        throw new Error(
          `ONBOARDING_FORCE_META_FAIL refused before any write (${blocked}). Unset the env var on this deployment.`,
        );
      }
    }

    // Load existing metadata first — admin updateUserById replaces the whole
    // user_metadata object, so we must merge rather than wipe other keys.
    const { data: existingUserData, error: getUserError } =
      await supabaseAdmin.auth.admin.getUserById(userId);
    if (getUserError) {
      throw new Error(getUserError.message || "Could not load user for onboarding. Please try again.");
    }
    const existingMeta =
      (existingUserData.user?.user_metadata as Record<string, unknown> | null | undefined) ?? {};

    // Real terms insert first (even when force-failing) so compensate-delete
    // exercises the same path as a genuine metadata failure.
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("user_terms_acceptance")
      .insert({
        user_id: userId,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
        account_type: "survivor",
      })
      .select("id")
      .maybeSingle();

    let insertedId: string | null = null;
    if (insertError) {
      if (insertError.code !== "23505") throw new Error(insertError.message);
      // Same versions already recorded (retry after a prior half-state or
      // double-submit). Keep going so metadata can still be healed.
    } else {
      insertedId = inserted?.id ?? null;
    }

    let metaError: { message: string } | null = null;
    if (forceMetaFail) {
      // Skip real metadata write so we do not leave onboarding_complete=true
      // while compensate-delete removes terms.
      metaError = {
        message:
          "Forced onboarding metadata failure (ONBOARDING_FORCE_META_FAIL=1). Compensate-delete should run.",
      };
    } else {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...existingMeta,
          onboarding_complete: true,
          state,
          city,
          agreed_privacy_at: acceptedAt,
          agreed_terms_at: acceptedAt,
          acknowledged_legal_use_at: acceptedAt,
        },
      });
      metaError = error;
    }

    if (metaError) {
      // Compensate: do not leave user_terms_acceptance without onboarding_complete.
      // If delete fails, fail loudly — never report success while terms still stick.
      let deleteErrorMessage: string | null = null;
      if (insertedId) {
        const { error: deleteError } = await supabaseAdmin
          .from("user_terms_acceptance")
          .delete()
          .eq("id", insertedId);
        if (deleteError) deleteErrorMessage = deleteError.message;
      } else {
        const { error: deleteError } = await supabaseAdmin
          .from("user_terms_acceptance")
          .delete()
          .eq("user_id", userId)
          .eq("terms_version", TERMS_VERSION)
          .eq("privacy_version", PRIVACY_VERSION)
          .eq("account_type", "survivor");
        if (deleteError) deleteErrorMessage = deleteError.message;
      }
      if (deleteErrorMessage) {
        throw new Error(
          `Could not save onboarding status (${metaError.message || "metadata update failed"}), and failed to roll back terms acceptance (${deleteErrorMessage}). Please contact support.`,
        );
      }
      throw new Error(metaError.message || "Could not save onboarding status. Please try again.");
    }

    return {
      ok: true as const,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      onboarding_complete: true as const,
    };
  });
