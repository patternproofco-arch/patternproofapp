import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* Survivor toggles Clio sharing consent for one attorney relationship.
   Only the two consent columns are written — the DB trigger guard enforces
   the same rule server-side. */
export const setClioShareConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ link_id: z.string().uuid(), consent: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("attorney_client_links")
      .update({
        clio_share_consent: data.consent,
        clio_share_consent_at: data.consent ? new Date().toISOString() : null,
      })
      .eq("id", data.link_id)
      .eq("client_user_id", context.userId);
    if (error) throw new Error("We couldn't update that setting. Try again in a moment.");
    return { ok: true as const };
  });

/* Attorney: relationships whose survivor has approved Clio sharing. */
export const listClioConsentedClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: links, error } = await context.supabase
      .from("attorney_client_links")
      .select("id,client_user_id,case_id,created_at")
      .eq("attorney_user_id", context.userId)
      .eq("status", "active")
      .eq("clio_share_consent", true)
      .order("created_at", { ascending: false });
    if (error) throw new Error("We couldn't load your approved clients just now.");
    const caseIds = (links ?? []).map((l) => l.case_id).filter((v): v is string => !!v);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cases } = caseIds.length
      ? await supabaseAdmin.from("cases").select("id,case_name,other_party").in("id", caseIds)
      : { data: [] as Array<{ id: string; case_name: string | null; other_party: string | null }> };
    const caseMap = new Map((cases ?? []).map((c) => [c.id, c]));
    return {
      clients: (links ?? []).map((l) => {
        const c = l.case_id ? caseMap.get(l.case_id) : null;
        return {
          link_id: l.id,
          client_label: `Client ${l.client_user_id.slice(0, 8)}`,
          case_label: c ? (c.case_name?.trim() || c.other_party?.trim() || "Case") : "All cases",
        };
      }),
    };
  });

/* Attorney: active matter links across their caseload. */
export const listClioMatterLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("clio_matter_links")
      .select("id,attorney_client_link_id,clio_matter_id,clio_matter_display_number,clio_matter_description,linked_at")
      .is("unlinked_at", null);
    if (error) return { links: [] };
    return { links: data ?? [] };
  });

export const linkClioMatter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      attorney_client_link_id: z.string().uuid(),
      clio_matter_id: z.string().min(1).max(120),
      clio_matter_display_number: z.string().max(200).nullable().optional(),
      clio_matter_description: z.string().max(2000).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("clio_matter_links").insert({
      attorney_client_link_id: data.attorney_client_link_id,
      clio_matter_id: data.clio_matter_id,
      clio_matter_display_number: data.clio_matter_display_number ?? null,
      clio_matter_description: data.clio_matter_description ?? null,
      linked_by: context.userId,
    });
    if (error) {
      if (error.code === "23505") {
        throw new Error("That case is already linked to a Clio matter. Unlink it first.");
      }
      throw new Error(
        "We couldn't link that matter. Your client's Clio sharing approval may have been turned off — reload and try again.",
      );
    }
    return { ok: true as const };
  });

export const unlinkClioMatter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ attorney_client_link_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("clio_matter_links")
      .update({ unlinked_at: new Date().toISOString() })
      .eq("attorney_client_link_id", data.attorney_client_link_id)
      .is("unlinked_at", null);
    if (error) throw new Error("We couldn't unlink that matter. Try again in a moment.");
    return { ok: true as const };
  });
