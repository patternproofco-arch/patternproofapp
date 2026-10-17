import { isActiveShareLink } from "@/lib/attorney-access.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  canResendInvitation,
  INVITATION_RESEND_DAYS,
  invitationSurvivorStatus,
} from "@/lib/invitation-status";

async function verifiedAccountEmail(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = data.user?.email?.trim().toLowerCase();
  if (error || !email || !data.user.email_confirmed_at) {
    throw new Error("A verified account email is required to accept this invitation.");
  }
  return email;
}

/* ---------- survivor side: invitations ---------- */

export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        attorney_email: z.string().email().max(255),
        attorney_name: z.string().trim().max(120).optional(),
        firm_name: z.string().trim().max(200).optional(),
        personal_note: z.string().trim().max(2000).optional(),
        date_range_start: z.string().optional().nullable(),
        date_range_end: z.string().optional().nullable(),
        include_all_incidents: z.boolean().default(true),
        include_all_evidence: z.boolean().default(true),
        // Exact ids the survivor reviewed (from a verified preview). When given, "include all" is ignored for that category.
        scope_incidents: z.array(z.string().uuid()).max(20000).optional(),
        scope_evidence: z.array(z.string().uuid()).max(20000).optional(),
        include_patterns: z.boolean().default(true),
        // Voice notes, communications, and legal documents default to false —
        // sharing them requires explicit opt-in, unlike the three categories
        // above which predate this consent model.
        include_voice_notes: z.boolean().default(false),
        include_communications: z.boolean().default(false),
        include_legal_documents: z.boolean().default(false),
        expires_days: z.number().int().min(1).max(365).default(30),
        case_id: z.string().uuid().optional().nullable(),
        /** Required when widening/replacing an existing active attorney link. */
        existing_link_id: z.string().uuid().optional().nullable(),
        merge_mode: z.enum(["add", "replace"]).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // If a case_id is supplied, verify it belongs to the survivor. Otherwise
    // treat the invitation as "all cases" for backward compatibility.
    let scopedCaseId: string | null = null;
    if (data.case_id) {
      const { data: c } = await supabaseAdmin
        .from("cases")
        .select("id")
        .eq("id", data.case_id)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!c) throw new Error("That case isn't on your account.");
      scopedCaseId = c.id;
    }
    // The survivor's consent is given NOW. Fix the exact records at this moment so nothing
    // added before the attorney opens the invitation is shared without her approval.
    // Exact ids from a verified preview win over include-all for that category.
    const { freezeInvitationScope } = await import("@/lib/invitation-scope.server");
    const hasExplicitInc = Array.isArray(data.scope_incidents);
    const hasExplicitEv = Array.isArray(data.scope_evidence);
    let frozen = await freezeInvitationScope(supabaseAdmin, context.userId, {
      include_all_incidents: hasExplicitInc ? false : data.include_all_incidents,
      include_all_evidence: hasExplicitEv ? false : data.include_all_evidence,
      scope_incidents: data.scope_incidents,
      scope_evidence: data.scope_evidence,
      case_id: scopedCaseId,
    });
    if (data.existing_link_id) {
      if (data.merge_mode !== "add" && data.merge_mode !== "replace") {
        throw new Error("Choose Add items or Replace what's shared before creating this link.");
      }
      const { data: link, error: linkErr } = await supabaseAdmin
        .from("attorney_client_links")
        .select("id,scope_incidents,scope_evidence,status,revoked_at,expires_at")
        .eq("id", data.existing_link_id)
        .eq("client_user_id", context.userId)
        .maybeSingle();
      if (linkErr || !link || !isActiveShareLink(link)) {
        throw new Error("That existing share couldn't be verified. Try again.");
      }
      const { mergeShareScopes } = await import("@/lib/sharing/merge-share-scope");
      const merged = mergeShareScopes(
        data.merge_mode,
        {
          incidents: (link.scope_incidents ?? []) as string[],
          evidence: (link.scope_evidence ?? []) as string[],
        },
        { incidents: frozen.scope_incidents, evidence: frozen.scope_evidence },
      );
      frozen = {
        scope_incidents: merged.incidents,
        scope_evidence: merged.evidence,
        excluded: frozen.excluded,
      };
    }
    const expires = new Date(Date.now() + data.expires_days * 86400000).toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("attorney_invitations")
      .insert({
        client_user_id: context.userId,
        attorney_email: data.attorney_email.toLowerCase(),
        attorney_name: data.attorney_name ?? null,
        firm_name: data.firm_name ?? null,
        personal_note: data.personal_note ?? null,
        date_range_start: data.date_range_start || null,
        date_range_end: data.date_range_end || null,
        include_all_incidents: false,
        include_all_evidence: false,
        scope_incidents: frozen.scope_incidents,
        scope_evidence: frozen.scope_evidence,
        include_patterns: data.include_patterns,
        include_voice_notes: data.include_voice_notes,
        include_communications: data.include_communications,
        include_legal_documents: data.include_legal_documents,
        expires_at: expires,
        case_id: scopedCaseId,
      })
      .select("id,invite_token,expires_at")
      .single();
    if (error) throw new Error(error.message);
    const { supersedePendingInvitations } = await import("@/lib/supersede-invitations.server");
    await supersedePendingInvitations(supabaseAdmin, {
      clientId: context.userId,
      attorneyEmail: data.attorney_email,
      caseId: scopedCaseId,
      keepId: row.id,
    });
    return {
      invitation: row,
      shared: { incidents: frozen.scope_incidents.length, files: frozen.scope_evidence.length },
      excluded: frozen.excluded,
    };
  });

export const listMyInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invitations } = await supabaseAdmin
      .from("attorney_invitations")
      .select("*")
      .eq("client_user_id", context.userId)
      .order("created_at", { ascending: false });
    const { data: links } = await supabaseAdmin
      .from("attorney_client_links")
      .select(
        "id,attorney_user_id,invitation_id,created_at,status,include_all_incidents,include_all_evidence,include_patterns,include_voice_notes,include_communications,include_legal_documents,deposition_prep_consent,deposition_prep_consent_at,clio_share_consent,clio_share_consent_at,case_id,expires_at,revoked_at",
      )
      .eq("client_user_id", context.userId)
      .order("created_at", { ascending: false });
    const attorneyIds = (links ?? []).map((l) => l.attorney_user_id);
    const { data: profiles } = attorneyIds.length
      ? await supabaseAdmin
          .from("attorney_profiles")
          .select("user_id,full_name,firm_name,email")
          .in("user_id", attorneyIds)
      : {
          data: [] as Array<{
            user_id: string;
            full_name: string;
            firm_name: string | null;
            email: string;
          }>,
        };
    const profMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    // Enrich with case labels so the UI can show "shared: <case name>" per link
    // and per pending invitation. Missing case_id means "all cases" (legacy).
    const caseIds = Array.from(
      new Set([
        ...(links ?? []).map((l) => l.case_id).filter((v): v is string => !!v),
        ...(invitations ?? []).map((i) => i.case_id).filter((v): v is string => !!v),
      ]),
    );
    const { data: cases } = caseIds.length
      ? await supabaseAdmin.from("cases").select("id,case_name,other_party").in("id", caseIds)
      : { data: [] as Array<{ id: string; case_name: string | null; other_party: string | null }> };
    const caseMap = new Map((cases ?? []).map((c) => [c.id, c]));
    const labelFor = (id: string | null) => {
      if (!id) return null;
      const c = caseMap.get(id);
      if (!c) return null;
      return (c.case_name?.trim() || c.other_party?.trim() || "Case") as string;
    };
    const linksOut = (links ?? []).map((l) => ({
      ...l,
      status: l.revoked_at
        ? "revoked"
        : l.expires_at && Date.parse(l.expires_at) <= Date.now()
          ? "expired"
          : l.status,
      profile: profMap.get(l.attorney_user_id) ?? null,
      case_label: labelFor(l.case_id),
      // Surface the terms this access was granted under, so the survivor can
      // always see what she agreed to — not just who has access.
      grant: (() => {
        const inv = l.invitation_id
          ? (invitations ?? []).find((i) => i.id === l.invitation_id)
          : undefined;
        return {
          date_range_start: inv?.date_range_start ?? null,
          date_range_end: inv?.date_range_end ?? null,
          expires_at: l.expires_at ?? inv?.expires_at ?? null,
          granted_at: l.created_at,
        };
      })(),
    }));
    // The only thing a survivor learns about an attorney's review: an application for the
    // email she invited is still pending. Never declined, never reasons, never details.
    const livePending = (invitations ?? []).filter(
      (i) => i.status === "pending" && (!i.expires_at || Date.parse(i.expires_at) > Date.now()),
    );
    const pendingEmails = new Set<string>();
    await Promise.all(
      Array.from(new Set(livePending.map((i) => String(i.attorney_email).trim().toLowerCase()))).map(
        async (em) => {
          const escaped = em.replace(/[\\%_]/g, (c) => `\\${c}`);
          const { data: app } = await supabaseAdmin
            .from("attorney_access_applications")
            .select("status")
            .ilike("email", escaped)
            .eq("status", "pending")
            .limit(1);
          if ((app ?? []).length > 0) pendingEmails.add(em);
        },
      ),
    );
    const invitationsOut = (invitations ?? []).map((i) => {
      const survivor_status = invitationSurvivorStatus({
        status: i.status,
        expiresAt: i.expires_at,
        applicationPending: pendingEmails.has(String(i.attorney_email).trim().toLowerCase()),
      });
      return {
        ...i,
        case_label: labelFor(i.case_id),
        survivor_status,
        can_resend: canResendInvitation(survivor_status),
      };
    });
    return { invitations: invitationsOut, links: linksOut };
  });

/**
 * Send an expired invitation again. Only on the survivor's request, only after expiry.
 * The new invitation carries the old one's exact records, narrowed only: anything she has
 * since deleted drops out and nothing is ever added. Review never pauses the 30 day clock.
 */
export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: old } = await supabaseAdmin
      .from("attorney_invitations")
      .select("*")
      .eq("id", data.id)
      .eq("client_user_id", context.userId)
      .maybeSingle();
    if (!old) throw new Error("Invitation not found.");
    const state = invitationSurvivorStatus({ status: old.status, expiresAt: old.expires_at, applicationPending: false });
    if (!canResendInvitation(state)) {
      throw new Error("This invitation can only be sent again after it has expired.");
    }
    if (old.status !== "pending") throw new Error("Invitation no longer valid");
    if (old.include_all_incidents === true || old.include_all_evidence === true) {
      throw new Error("This older invitation can't be sent again. Please create a new one so you can review what is shared.");
    }
    const email = String(old.attorney_email).trim().toLowerCase();
    // One live invitation per attorney and case, so two links never pile up.
    const { data: live } = await supabaseAdmin
      .from("attorney_invitations")
      .select("id,expires_at,case_id")
      .eq("client_user_id", context.userId)
      .eq("status", "pending")
      .ilike("attorney_email", email.replace(/[\\%_]/g, (c) => `\\${c}`));
    const hasLive = (live ?? []).some(
      (r) =>
        r.id !== old.id &&
        (r.case_id ?? null) === (old.case_id ?? null) &&
        (!r.expires_at || Date.parse(r.expires_at) > Date.now()),
    );
    if (hasLive) throw new Error("You already have a live invitation for this attorney. Cancel it first if you want to send a new one.");

    const { scopeForAcceptance } = await import("@/lib/invitation-scope.server");
    const frozen = await scopeForAcceptance(supabaseAdmin, old);
    if (frozen.scope_incidents.length === 0 && frozen.scope_evidence.length === 0) {
      throw new Error("Nothing from the original invitation is left to share, so it wasn't sent again.");
    }
    const expires = new Date(Date.now() + INVITATION_RESEND_DAYS * 86400000).toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("attorney_invitations")
      .insert({
        client_user_id: context.userId,
        attorney_email: email,
        attorney_name: old.attorney_name,
        firm_name: old.firm_name,
        personal_note: old.personal_note,
        date_range_start: old.date_range_start,
        date_range_end: old.date_range_end,
        include_all_incidents: false,
        include_all_evidence: false,
        scope_incidents: frozen.scope_incidents,
        scope_evidence: frozen.scope_evidence,
        include_patterns: old.include_patterns,
        include_voice_notes: old.include_voice_notes,
        include_communications: old.include_communications,
        include_legal_documents: old.include_legal_documents,
        expires_at: expires,
        case_id: old.case_id,
      })
      .select("id,invite_token,expires_at")
      .single();
    if (error) throw new Error(error.message);
    // The expired one is retired so only the new link works.
    await supabaseAdmin
      .from("attorney_invitations")
      .update({ status: "revoked" })
      .eq("id", old.id)
      .eq("client_user_id", context.userId);
    return {
      invitation: row,
      attorney_email: email,
      attorney_name: old.attorney_name,
      personal_note: old.personal_note,
      shared: { incidents: frozen.scope_incidents.length, files: frozen.scope_evidence.length },
    };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("attorney_invitations")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("client_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("attorney_client_links")
      .select("attorney_user_id,revoked_at")
      .eq("id", data.id)
      .eq("client_user_id", context.userId)
      .maybeSingle();
    if (!link) throw new Error("Share not found.");
    const { error } = await supabaseAdmin
      .from("attorney_client_links")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("client_user_id", context.userId)
      .is("revoked_at", null);
    if (error) throw new Error(error.message);
    // Close any packet already sitting in storage, so old download links die now.
    if (link?.attorney_user_id) {
      const { purgeProfessionalExports } = await import("@/lib/professional-links.server");
      await purgeProfessionalExports(supabaseAdmin, {
        professionalUserId: link.attorney_user_id,
        clientUserId: context.userId,
      });
    }
    return { ok: true };
  });

/* ---------- attorney side: peek + accept ---------- */

export const peekInvitation = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("attorney_invitations")
      .select("attorney_email,attorney_name,status,expires_at")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!inv) return { status: "not-found" as const };
    if (inv.status !== "pending") return { status: inv.status as "accepted" | "revoked" };
    if (inv.expires_at && new Date(inv.expires_at) < new Date())
      return { status: "expired" as const };
    // This runs before anyone signs in, so it returns only what the invite page shows.
    // Case names, the other party, and the scope of what was shared never leave here.
    return {
      status: "ok" as const,
      invitation: {
        attorney_email: inv.attorney_email,
        attorney_name: inv.attorney_name,
        expires_at: inv.expires_at,
      },
    };
  });

export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (
      await import("@/lib/attorney-approval.server")
    ).assertApprovedAttorney(supabaseAdmin, context.userId);
    const { data: inv } = await supabaseAdmin
      .from("attorney_invitations")
      .select("*")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!inv) throw new Error("Invitation not found");
    if (inv.status !== "pending") throw new Error("Invitation no longer valid");
    if (inv.expires_at && new Date(inv.expires_at) < new Date())
      throw new Error("Invitation expired");

    // Verify the authenticated user's email matches the invitation's
    // attorney_email AND that this account's email is actually confirmed —
    // otherwise anyone who obtains the link (forwarded email, shared device,
    // phished from the survivor) could sign up with that address and accept
    // it without ever proving inbox ownership.
    const jwtEmail = await verifiedAccountEmail(context.userId);
    if (jwtEmail !== String(inv.attorney_email).toLowerCase()) {
      throw new Error("This invitation was sent to a different email address.");
    }

    // The scope was fixed when the survivor created the invitation (Add vs Replace
    // already resolved into the frozen ids). This only narrows by ownership/deletion.
    const { scopeForAcceptance } = await import("@/lib/invitation-scope.server");
    const frozen = await scopeForAcceptance(supabaseAdmin, inv);

    // Claim the invitation and mutate the grant in one transaction. An ended
    // grant keeps its identity; fresh survivor consent creates a new row.
    const { acceptAttorneyShare } = await import("@/lib/attorney-share.server");
    const link = await acceptAttorneyShare(supabaseAdmin, {
      invitationId: inv.id,
      actorId: context.userId,
      direction: "attorney",
      scope: frozen,
    });

    // Only after a successful accept: ensure the attorney role, and alert the
    // founder only when this accept actually created the role (a genuinely new
    // attorney). A failed accept, or an existing attorney, sends nothing.
    const { data: hadRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "attorney")
      .maybeSingle();
    if (!hadRole) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: context.userId, role: "attorney" }, { onConflict: "user_id,role" });
      if (!roleError)
        await (
          await import("@/lib/signup-notify.server")
        ).notifyNewSignup({ userId: context.userId, role: "attorney" });
    }

    return { ok: true, link };
  });
