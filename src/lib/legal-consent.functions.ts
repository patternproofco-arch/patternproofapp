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
