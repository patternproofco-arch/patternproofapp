/**
 * Survivor-side court timeline: exactly what each live attorney link can see,
 * numbered with the same helper the attorney's exhibit binder uses, so both
 * sides show identical exhibit numbers and dates.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildBinderEntries, type BinderEntry } from "@/lib/binder";

type Link = {
  id: string;
  status: string;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string | null;
  include_all_incidents?: boolean;
  include_all_evidence?: boolean;
  scope_incidents: string[] | null;
  scope_evidence: string[] | null;
  attorney_user_id: string | null;
};

export const getMyCourtTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { freezeLegacyBlanketScope } = await import("@/lib/grant-snapshot.server");
    const { data: links } = await db
      .from("attorney_client_links")
      .select(
        "id,status,revoked_at,expires_at,created_at,include_all_incidents,include_all_evidence,scope_incidents,scope_evidence,attorney_user_id",
      )
      .eq("client_user_id", context.userId);

    const out: Array<{ link_id: string; attorney: string; entries: BinderEntry[] }> = [];
    for (const raw of (links ?? []) as unknown[]) {
      let l = raw as Link;
      if (l.status !== "active" || l.revoked_at) continue;
      if (l.expires_at && new Date(l.expires_at).getTime() < Date.now()) continue;
      await freezeLegacyBlanketScope(db, "attorney_client_links", l, context.userId);
      const { data: fresh } = await db
        .from("attorney_client_links")
        .select("scope_incidents,scope_evidence")
        .eq("id", l.id)
        .single();
      l = { ...l, ...(fresh ?? {}) };
      const incIds = l.scope_incidents ?? [];
      const evIds = l.scope_evidence ?? [];
      const [inc, ev, req, prof] = await Promise.all([
        incIds.length
          ? db
              .from("incidents")
              .select("*")
              .eq("user_id", context.userId)
              .in("id", incIds)
              .is("deleted_at", null)
              // Same rule as the attorney's binder: machine-read entries the
              // survivor never confirmed are not shown to the attorney.
              .or("source.neq.ai_extracted,confirmed_at.not.is.null")
          : Promise.resolve({ data: [] }),
        evIds.length
          ? db.from("evidence").select("*").eq("user_id", context.userId).in("id", evIds).is("deleted_at", null)
          : Promise.resolve({ data: [] }),
        db
          .from("attorney_document_requests")
          .select("id,title,status,submitted_at,response_note")
          .eq("client_user_id", context.userId)
          .eq("link_id", l.id),
        l.attorney_user_id
          ? db.from("attorney_profiles").select("full_name").eq("user_id", l.attorney_user_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      out.push({
        link_id: l.id,
        attorney: (prof.data as { full_name?: string } | null)?.full_name ?? "Your attorney",
        entries: buildBinderEntries(
          (inc.data ?? []) as Record<string, unknown>[],
          (ev.data ?? []) as Record<string, unknown>[],
          (req.data ?? []) as Record<string, unknown>[],
        ),
      });
    }
    return { timelines: out };
  });
