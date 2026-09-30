/**
 * Survivor-side controls for grants that were frozen at the moment of sharing.
 *
 * Because "share all my entries" is snapshotted (see grant-snapshot.server.ts),
 * anything documented afterwards stays private. These functions let the
 * survivor see how many of their newer entries are NOT shared, and explicitly
 * add them. Nothing here shares anything on its own.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type LinkKind = "attorney" | "advocate";

const TABLE: Record<LinkKind, "attorney_client_links" | "advocate_client_links"> = {
  attorney: "attorney_client_links",
  advocate: "advocate_client_links",
};

function isLive(link: { status?: string | null; revoked_at?: string | null; expires_at?: string | null }) {
  if (link.status !== "active") return false;
  if (link.revoked_at) return false;
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) return false;
  return true;
}

type LinkRow = {
  id: string;
  status: string;
  revoked_at: string | null;
  expires_at: string | null;
  created_at?: string | null;
  include_all_incidents?: boolean;
  include_all_evidence?: boolean;
  scope_incidents: string[] | null;
  scope_evidence: string[] | null;
};

/** Counts of the survivor's own entries that each live grant cannot see. */
export const listPrivateSinceSharing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { unsharedSinceGrant, freezeLegacyBlanketScope } = await import(
      "@/lib/grant-snapshot.server"
    );

    const out: Array<{
      kind: LinkKind;
      link_id: string;
      new_incidents: number;
      new_evidence: number;
    }> = [];

    for (const kind of ["attorney", "advocate"] as LinkKind[]) {
      const { data } = await supabaseAdmin
        .from(TABLE[kind])
        .select(
          "id,created_at,status,revoked_at,expires_at,include_all_incidents,include_all_evidence,scope_incidents,scope_evidence",
        )
        .eq("client_user_id", context.userId);
      for (const link of (data ?? []) as unknown[]) {
        const l = link as LinkRow;
        if (!isLive(l)) continue;
        // Legacy "share everything" grants still carry blanket flags and would
        // make every entry look private here while the professional can in
        // fact see it. Freeze them first so this panel always matches what
        // the professional's portal actually shows.
        await freezeLegacyBlanketScope(supabaseAdmin, TABLE[kind], l, context.userId);
        const gap = await unsharedSinceGrant(supabaseAdmin, context.userId, l);
        if (!gap.incidents.length && !gap.evidence.length) continue;
        out.push({
          kind,
          link_id: l.id,
          new_incidents: gap.incidents.length,
          new_evidence: gap.evidence.length,
        });
      }
    }
    return { grants: out };
  });

/** Explicitly add everything documented since sharing to one existing grant. */
export const shareNewItemsWithGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        kind: z.enum(["attorney", "advocate"]),
        link_id: z.string().uuid(),
        include_incidents: z.boolean().default(true),
        include_evidence: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { unsharedSinceGrant } = await import("@/lib/grant-snapshot.server");

    const table = TABLE[data.kind as LinkKind];
    const { data: found } = await supabaseAdmin
      .from(table)
      .select("id,status,revoked_at,expires_at,scope_incidents,scope_evidence")
      .eq("id", data.link_id)
      // Ownership is decided here, on the server, from the signed-in user.
      .eq("client_user_id", context.userId)
      .maybeSingle();
    const link = found as {
      id: string;
      status: string;
      revoked_at: string | null;
      expires_at: string | null;
      scope_incidents: string[] | null;
      scope_evidence: string[] | null;
    } | null;
    if (!link || !isLive(link)) throw new Error("That access is no longer active.");

    const gap = await unsharedSinceGrant(supabaseAdmin, context.userId, link);
    const nextIncidents = data.include_incidents
      ? Array.from(new Set([...(link.scope_incidents ?? []), ...gap.incidents]))
      : (link.scope_incidents ?? []);
    const nextEvidence = data.include_evidence
      ? Array.from(new Set([...(link.scope_evidence ?? []), ...gap.evidence]))
      : (link.scope_evidence ?? []);

    const { error } = await supabaseAdmin
      .from(table)
      .update({
        include_all_incidents: false,
        include_all_evidence: false,
        scope_incidents: nextIncidents,
        scope_evidence: nextEvidence,
      })
      .eq("id", link.id)
      .eq("client_user_id", context.userId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.rpc("record_audit_event", {
      p_user_id: context.userId,
      p_event_type: "share_scope_extended",
      p_subject_kind: table,
      p_subject_id: link.id,
      p_actor_kind: "survivor",
      p_actor_id: context.userId,
      p_meta: {
        added_incidents: data.include_incidents ? gap.incidents.length : 0,
        added_evidence: data.include_evidence ? gap.evidence.length : 0,
      },
    });

    return {
      ok: true,
      added_incidents: data.include_incidents ? gap.incidents.length : 0,
      added_evidence: data.include_evidence ? gap.evidence.length : 0,
    };
  });
