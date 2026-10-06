import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  mergeShareScopes,
  selectionFingerprint,
  type ShareMergeMode,
} from "@/lib/sharing/merge-share-scope";

const mergeModeSchema = z.enum(["add", "replace"]);

/**
 * "What will this link actually share?" Answered before the link is made, using the same rule that
 * fixes the records when it is made (freezeInvitationScope), and writing nothing. Accepts exact
 * incident/file ids — not only include-all + case id — so individual picks are represented.
 * A failed check must block create on the client; this never invents reassuring numbers.
 */
export const previewShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        include_all_incidents: z.boolean().default(false),
        include_all_evidence: z.boolean().default(false),
        scope_incidents: z.array(z.string().uuid()).max(20000).optional(),
        scope_evidence: z.array(z.string().uuid()).max(20000).optional(),
        /** Extra file ids she chose from missing-attachments — always authorized for this invite only. */
        deliberate_evidence: z.array(z.string().uuid()).max(20000).optional(),
        case_id: z.string().uuid().optional().nullable(),
        /** When inviting someone who already has access, preview Add vs Replace. */
        existing_link_id: z.string().uuid().optional().nullable(),
        merge_mode: mergeModeSchema.optional().nullable(),
        /** attorney | advocate — which link table existing_link_id refers to */
        link_kind: z.enum(["attorney", "advocate"]).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { freezeInvitationScope } = await import("@/lib/invitation-scope.server");

    const hasExplicitInc = Array.isArray(data.scope_incidents);
    const hasExplicitEv = Array.isArray(data.scope_evidence);

    const f = await freezeInvitationScope(supabaseAdmin, context.userId, {
      include_all_incidents: hasExplicitInc ? false : data.include_all_incidents,
      include_all_evidence: hasExplicitEv ? false : data.include_all_evidence,
      scope_incidents: data.scope_incidents,
      scope_evidence: data.scope_evidence,
      case_id: data.case_id ?? null,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = supabaseAdmin;
    const total = async (table: "incidents" | "evidence") => {
      const { count, error } = await db
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .is("deleted_at", null);
      if (error) throw new Error("We couldn't check what would be shared. Try again in a moment.");
      return count ?? 0;
    };

    const held = f.excluded;
    const sweepingInc = !hasExplicitInc && data.include_all_incidents;
    const sweepingEv = !hasExplicitEv && data.include_all_evidence;
    const heldBackEntries = sweepingInc
      ? Math.max(0, (await total("incidents")) - f.scope_incidents.length)
      : held.filter((x) => x.kind === "incident").length;
    const heldBackFiles = sweepingEv
      ? Math.max(0, (await total("evidence")) - f.scope_evidence.length)
      : held.filter((x) => x.kind === "file").length;

    let resulting = {
      incidents: f.scope_incidents,
      evidence: f.scope_evidence,
    };
    let merge:
      | {
          mode: ShareMergeMode;
          existing_link_id: string;
          previously: { incidents: number; files: number };
          added: { incidents: number; files: number };
          removed: { incidents: number; files: number };
          resulting: { incidents: number; files: number };
        }
      | null = null;

    if (data.existing_link_id && data.merge_mode) {
      const table =
        data.link_kind === "advocate" ? "advocate_client_links" : "attorney_client_links";
      const { data: link, error: linkErr } = await db
        .from(table)
        .select("id,scope_incidents,scope_evidence,status,client_user_id")
        .eq("id", data.existing_link_id)
        .eq("client_user_id", context.userId)
        .maybeSingle();
      if (linkErr || !link) {
        throw new Error("We couldn't check the existing share. Try again in a moment.");
      }
      if (link.status !== "active") {
        throw new Error("That share is no longer active. Start a new invitation instead.");
      }
      const merged = mergeShareScopes(
        data.merge_mode,
        {
          incidents: (link.scope_incidents ?? []) as string[],
          evidence: (link.scope_evidence ?? []) as string[],
        },
        { incidents: f.scope_incidents, evidence: f.scope_evidence },
      );
      resulting = { incidents: merged.incidents, evidence: merged.evidence };
      merge = {
        mode: data.merge_mode,
        existing_link_id: link.id as string,
        previously: {
          incidents: ((link.scope_incidents ?? []) as string[]).length,
          files: ((link.scope_evidence ?? []) as string[]).length,
        },
        added: { incidents: merged.added.incidents.length, files: merged.added.evidence.length },
        removed: {
          incidents: merged.removed.incidents.length,
          files: merged.removed.evidence.length,
        },
        resulting: { incidents: merged.incidents.length, files: merged.evidence.length },
      };
    }

    // Deliberate missing-attachment includes: authorize owned ids for THIS invite only,
    // without turning off include-all for the rest of the evidence set.
    const deliberate = data.deliberate_evidence ?? [];
    if (deliberate.length) {
      const { snapshotShareScope } = await import("@/lib/grant-snapshot.server");
      const auth = await snapshotShareScope(
        supabaseAdmin,
        context.userId,
        {
          include_all_incidents: false,
          include_all_evidence: false,
          scope_incidents: [],
          scope_evidence: deliberate,
        },
        { authorizeExplicitPicks: true },
      );
      resulting = {
        incidents: resulting.incidents,
        evidence: Array.from(new Set([...resulting.evidence, ...auth.scope_evidence])),
      };
    }

    const fingerprint = selectionFingerprint({
      include_all_incidents: hasExplicitInc ? false : data.include_all_incidents,
      include_all_evidence: hasExplicitEv ? false : data.include_all_evidence,
      scope_incidents: hasExplicitInc ? data.scope_incidents : f.scope_incidents,
      scope_evidence: hasExplicitEv ? data.scope_evidence : f.scope_evidence,
      case_id: data.case_id ?? null,
      merge_mode: data.merge_mode ?? null,
      existing_link_id: data.existing_link_id ?? null,
      deliberate_evidence: deliberate,
    });

    const { findMissingAttachments } = await import("@/lib/sharing/referenced-attachments.server");
    const missing_attachments = await findMissingAttachments(supabaseAdmin, context.userId, {
      sharedIncidentIds: resulting.incidents,
      sharedEvidenceIds: resulting.evidence,
    });

    return {
      verified: true as const,
      fingerprint,
      /** Exact ids that will be frozen on create (after Add/Replace if any). */
      scope_incidents: resulting.incidents,
      scope_evidence: resulting.evidence,
      incidents: resulting.incidents.length,
      files: resulting.evidence.length,
      heldBackEntries,
      heldBackFiles,
      excluded: held,
      merge,
      /**
       * Files the shared entries reference that are not in this share.
       * Listed so she can include them deliberately — never auto-added.
       */
      missing_attachments,
    };
  });

export type SharePreviewResult = Awaited<ReturnType<typeof previewShare>>;
