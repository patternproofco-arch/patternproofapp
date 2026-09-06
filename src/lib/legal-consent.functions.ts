import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal-versions";

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
    const userId = context.userId;
    const acceptedAt = new Date().toISOString();
    const city = data.city.trim();
    const state = data.state.trim();

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

    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        onboarding_complete: true,
        state,
        city,
        agreed_privacy_at: acceptedAt,
        agreed_terms_at: acceptedAt,
        acknowledged_legal_use_at: acceptedAt,
      },
    });

    if (metaError) {
      // Compensate: do not leave user_terms_acceptance without onboarding_complete.
      if (insertedId) {
        await supabaseAdmin.from("user_terms_acceptance").delete().eq("id", insertedId);
      } else {
        await supabaseAdmin
          .from("user_terms_acceptance")
          .delete()
          .eq("user_id", userId)
          .eq("terms_version", TERMS_VERSION)
          .eq("privacy_version", PRIVACY_VERSION)
          .eq("account_type", "survivor");
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
