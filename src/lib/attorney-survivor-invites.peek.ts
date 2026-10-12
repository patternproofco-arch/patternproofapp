import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const peekSurvivorInvite = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("attorney_survivor_invites")
      .select("id,survivor_email,survivor_name,personal_note,attorney_user_id,status,expires_at")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!inv) return { status: "not-found" as const };
    if (inv.status !== "pending") return { status: inv.status as "accepted" | "revoked" };
    if (inv.expires_at && new Date(inv.expires_at) < new Date())
      return { status: "expired" as const };
    await supabaseAdmin
      .from("attorney_survivor_invites")
      .update({ opened_at: new Date().toISOString() })
      .eq("id", inv.id)
      .is("opened_at", null);
    const { data: prof } = await supabaseAdmin
      .from("attorney_profiles")
      .select("full_name,firm_name")
      .eq("user_id", inv.attorney_user_id)
      .maybeSingle();
    return {
      status: "ok" as const,
      invite: {
        id: inv.id,
        survivor_email: inv.survivor_email,
        survivor_name: inv.survivor_name,
        personal_note: inv.personal_note,
        attorney_name: prof?.full_name ?? null,
        firm_name: prof?.firm_name ?? null,
      },
    };
  });

const acceptScopeInput = z.object({
  include_all_incidents: z.boolean().default(false),
  include_all_evidence: z.boolean().default(false),
  include_patterns: z.boolean().default(false),
  scope_incidents: z.array(z.string().uuid()).max(2000).optional().default([]),
  scope_evidence: z.array(z.string().uuid()).max(2000).optional().default([]),
});

const acceptInput = z.object({
  token: z.string().min(8).max(128),
  /** Only what SHE chose on this screen. Never anything the attorney pre-filled. */
  scope: acceptScopeInput,
});

type AcceptInput = z.infer<typeof acceptInput>;

const PICK_HINT =
  "Use \u201cSelect specific\u201d to authorize items for this invite, or mark them OK to share.";

/**
 * Load the invite, check it is still usable and addressed to her, and work out exactly
 * what would be shared. Preview and accept both run this, so the number she is shown
 * before connecting is the number the attorney gets.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveSurvivorInvite(admin: any, data: AcceptInput, userId: string, claims: unknown) {
  const { data: inv } = await admin
    .from("attorney_survivor_invites")
    .select("*")
    .eq("invite_token", data.token)
    .maybeSingle();
  if (!inv) throw new Error("Invite not found");
  if (inv.status !== "pending") throw new Error("Invite no longer valid");
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) throw new Error("Invite expired");
  const jwtEmail = (claims as { email?: string } | undefined)?.email?.toLowerCase();
  if (!jwtEmail || jwtEmail !== String(inv.survivor_email).toLowerCase()) {
    throw new Error("This invite was sent to a different email address.");
  }
  const { resolveInviteAcceptScope, prefillFromInviteRow } = await import(
    "@/lib/sharing/invite-accept-scope.server"
  );
  // Share all: only OK-to-share, frozen to ids that exist right now. Her own per-item
  // picks on this screen (which lists Keep-private items "authorize for this invite")
  // are authorized for this invite only. Anything pre-filled on the invite is not.
  const resolved = await resolveInviteAcceptScope(admin, userId, {
    survivorChoice: data.scope,
    invitePrefill: prefillFromInviteRow(inv),
    authorizeSurvivorPicks: true,
  });
  return { inv, resolved };
}

/** What accepting would share right now. Writes nothing. */
export const previewSurvivorInviteScope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => acceptInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolved } = await resolveSurvivorInvite(
      supabaseAdmin,
      data,
      context.userId,
      context.claims,
    );
    return {
      shared: { incidents: resolved.scope_incidents.length, files: resolved.scope_evidence.length },
      include_patterns: resolved.include_patterns,
      excluded: resolved.excluded,
    };
  });

export const acceptSurvivorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => acceptInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { inv, resolved } = await resolveSurvivorInvite(
      supabaseAdmin,
      data,
      context.userId,
      context.claims,
    );
    await (
      await import("@/lib/attorney-approval.server")
    ).assertApprovedAttorney(supabaseAdmin, inv.attorney_user_id);

    // Nothing is written and the invite stays pending if this would share nothing she
    // asked for, so she can pick again instead of ending up with an empty grant.
    const { assertAcceptWouldShare } = await import("@/lib/sharing/invite-accept-scope.server");
    assertAcceptWouldShare(data.scope, resolved, PICK_HINT);

    const { acceptAttorneyShare } = await import("@/lib/attorney-share.server");
    await acceptAttorneyShare(supabaseAdmin, {
      invitationId: inv.id,
      // Survivor id comes only from her own signed-in session, never from input.
      actorId: context.userId,
      direction: "survivor",
      attorneyUserId: inv.attorney_user_id,
      survivorUserId: context.userId,
      scope: {
        scope_incidents: resolved.scope_incidents,
        scope_evidence: resolved.scope_evidence,
        include_patterns: resolved.include_patterns,
      },
    });
    // Say exactly what the recipient got and what was left out, so a selected item is
    // never missing without the survivor knowing.
    return {
      ok: true,
      shared: { incidents: resolved.scope_incidents.length, files: resolved.scope_evidence.length },
      include_patterns: resolved.include_patterns,
      excluded: resolved.excluded,
    };
  });
