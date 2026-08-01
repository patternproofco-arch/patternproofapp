import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { findConflicts, resolveCallerRole } from "@/lib/conflict-check.server";

/**
 * v1 conflict screening — scoped to the caller's OWN accessible clients only.
 * There is no cross-attorney / firm-wide search here.
 */
export const checkConflict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ opposingPartyName: z.string().trim().min(2).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const role = await resolveCallerRole(context.userId);
    if (role !== "attorney" && role !== "collaborator") throw new Error("Not authorized");
    const matches = await findConflicts(context.userId, data.opposingPartyName);
    return { query: data.opposingPartyName, matches };
  });
