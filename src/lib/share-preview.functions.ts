import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * "What will this link actually share?" Answered before the link is made, using the same rule that
 * fixes the records when it is made (freezeInvitationScope), and writing nothing. Without this the
 * survivor learned what was left out, if ever, from an attorney saying the file was empty.
 */
export const previewShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        include_all_incidents: z.boolean().default(false),
        include_all_evidence: z.boolean().default(false),
        case_id: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { freezeInvitationScope } = await import("@/lib/invitation-scope.server");
    const f = await freezeInvitationScope(supabaseAdmin, context.userId, {
      include_all_incidents: data.include_all_incidents,
      include_all_evidence: data.include_all_evidence,
      case_id: data.case_id ?? null,
    });
    // "Share all" sweeps in whatever is eligible and doesn't list the rest as picked-and-left-out,
    // so what was held back is everything she has minus what is going.
    const total = async (table: "incidents" | "evidence") => {
      const { count, error } = await supabaseAdmin
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .is("deleted_at", null);
      if (error) throw new Error("We couldn't check what would be shared. Try again in a moment.");
      return count ?? 0;
    };
    const held = f.excluded;
    const heldBackEntries = data.include_all_incidents
      ? Math.max(0, (await total("incidents")) - f.scope_incidents.length)
      : held.filter((x) => x.kind === "incident").length;
    const heldBackFiles = data.include_all_evidence
      ? Math.max(0, (await total("evidence")) - f.scope_evidence.length)
      : held.filter((x) => x.kind === "file").length;
    return { incidents: f.scope_incidents.length, files: f.scope_evidence.length, heldBackEntries, heldBackFiles };
  });
