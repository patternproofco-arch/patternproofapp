import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Read-only, survivor-side mirror of attorney-portal.functions.ts's
 * getCaseNote/saveCaseNote. Those two assert the caller is the attorney on
 * the link (assertAttorney + assertLink) and can write attorney_case_notes.
 * This asserts the opposite side — the caller is the client_user_id on the
 * link — and only ever reads. There is no write path here: notes stay
 * attorney-authored, she just isn't locked out of seeing them anymore.
 *
 * Scoped entirely by client_user_id = context.userId, same as every other
 * survivor-facing query in survivor-home-packet.functions.ts — no RLS or
 * schema change, just a query that was never written.
 */
export const getAttorneyNotesForMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("attorney_client_links")
      .select("id, attorney_user_id, attorney_case_notes, status, revoked_at, created_at")
      .eq("client_user_id", context.userId)
      .is("revoked_at", null)
      .eq("status", "active");

    const rows = (data ?? []) as Array<{
      id: string;
      attorney_user_id: string;
      attorney_case_notes: string | null;
      created_at: string;
    }>;

    return {
      notes: rows
        .filter((r) => (r.attorney_case_notes ?? "").trim().length > 0)
        .map((r) => ({
          linkId: r.id,
          note: r.attorney_case_notes as string,
          sharedSince: r.created_at,
        })),
    };
  });
