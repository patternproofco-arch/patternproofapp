import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AttorneyNoteRow {
  linkId: string;
  attorneyName: string;
  note: string;
  updatedAt: string | null;
}

/** Read-only notes an attorney already saved on this survivor's grant. */
export const listMyAttorneyCaseNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AttorneyNoteRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: links, error } = await supabaseAdmin
      .from("attorney_client_links")
      .select("id, attorney_user_id, attorney_case_notes, created_at")
      .eq("client_user_id", context.userId)
      .eq("status", "active");
    if (error) throw new Error("We couldn't load notes from your attorney.");
    const rows = (links ?? []) as Array<{
      id: string;
      attorney_user_id: string;
      attorney_case_notes: string | null;
      created_at: string | null;
    }>;
    const visible = rows.filter((r) => (r.attorney_case_notes ?? "").trim().length > 0);
    if (visible.length === 0) return [];

    const ids = [...new Set(visible.map((r) => r.attorney_user_id))];
    const { data: profiles } = await supabaseAdmin
      .from("attorney_profiles")
      .select("user_id, full_name")
      .in("user_id", ids);
    const names = new Map(
      ((profiles ?? []) as Array<{ user_id: string; full_name: string | null }>).map((p) => [
        p.user_id,
        p.full_name?.trim() || "Your attorney",
      ]),
    );

    return visible.map((r) => ({
      linkId: r.id,
      attorneyName: names.get(r.attorney_user_id) ?? "Your attorney",
      note: (r.attorney_case_notes ?? "").trim(),
      updatedAt: r.created_at,
    }));
  });
