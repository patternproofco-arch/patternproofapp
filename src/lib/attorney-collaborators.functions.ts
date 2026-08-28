import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { isAttorneyEntitled } from "@/lib/payments.functions";

const ROLES = ["paralegal", "associate", "attorney"] as const;

// Unlike firm-team seats (capped at FIRM_SEAT_MAX and gated on an active Firm
// subscription in firm-grants.functions.ts), per-case collaborator invites had
// no cap and no subscription check at all — a single Solo-tier (or even
// unsubscribed) attorney could add unlimited "co-counsel" to one case, each
// getting full case access, for free. Mirrors the firm-seat cap.
const COLLABORATOR_SEAT_MAX = 5;

async function assertOwnerLink(userId: string, clientId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: link } = await supabaseAdmin
    .from("attorney_client_links")
    .select("id,status")
    .eq("attorney_user_id", userId)
    .eq("client_user_id", clientId)
    .maybeSingle();
  if (!link || link.status !== "active") throw new Error("No active client link");
  return link;
}

export const listCaseCollaborators = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const link = await assertOwnerLink(context.userId, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("case_collaborators")
      .select(
        "id,collaborator_email,collaborator_name,role,status,invite_token,created_at,accepted_at",
      )
      .eq("link_id", link.id)
      .eq("owner_attorney_user_id", context.userId)
      .order("created_at", { ascending: false });
    return { collaborators: rows ?? [], link_id: link.id };
  });

export const inviteCaseCollaborator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      clientId: z.string().uuid(),
      email: z.string().trim().email().max(255),
      name: z.string().trim().max(120).optional().nullable(),
      role: z.enum(ROLES),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const link = await assertOwnerLink(context.userId, data.clientId);
    const ent = await isAttorneyEntitled(context.userId, data.clientId);
    if (!ent.entitled) {
      throw new Error("An active attorney subscription is required to invite collaborators.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("case_collaborators")
      .select("id", { count: "exact", head: true })
      .eq("link_id", link.id)
      .in("status", ["pending", "active"]);
    if ((count ?? 0) >= COLLABORATOR_SEAT_MAX) {
      throw new Error(
        `This case already has ${COLLABORATOR_SEAT_MAX} collaborators, the maximum allowed.`,
      );
    }
    const { data: row, error } = await supabaseAdmin
      .from("case_collaborators")
      .insert({
        link_id: link.id,
        owner_attorney_user_id: context.userId,
        collaborator_email: data.email.toLowerCase(),
        collaborator_name: data.name ?? null,
        role: data.role,
      })
      .select(
        "id,collaborator_email,collaborator_name,role,status,invite_token,created_at,accepted_at",
      )
      .single();
    if (error) {
      if (String(error.message).toLowerCase().includes("duplicate")) {
        throw new Error("That email is already invited to this case.");
      }
      throw new Error(error.message);
    }
    return { collaborator: row };
  });

export const revokeCaseCollaborator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("case_collaborators")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("owner_attorney_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const peekCollaboratorInvite = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("case_collaborators")
      .select("id,collaborator_email,collaborator_name,role,status,owner_attorney_user_id,link_id")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!inv) return { status: "not-found" as const };
    if (inv.status !== "pending") return { status: inv.status as "active" | "revoked" };
    const { data: prof } = await supabaseAdmin
      .from("attorney_profiles")
      .select("full_name,firm_name")
      .eq("user_id", inv.owner_attorney_user_id)
      .maybeSingle();
    return {
      status: "ok" as const,
      invite: {
        id: inv.id,
        collaborator_email: inv.collaborator_email,
        collaborator_name: inv.collaborator_name,
        role: inv.role as (typeof ROLES)[number],
        attorney_name: prof?.full_name ?? null,
        firm_name: prof?.firm_name ?? null,
      },
    };
  });

export const acceptCollaboratorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("case_collaborators")
      .select("id,owner_attorney_user_id,collaborator_email,status")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!inv) throw new Error("Invite not found");
    if (inv.status !== "pending") throw new Error("Invite no longer valid");
    const jwtEmail = (context.claims as { email?: string } | undefined)?.email?.toLowerCase();
    if (!jwtEmail || jwtEmail !== String(inv.collaborator_email).toLowerCase()) {
      throw new Error("This invite was sent to a different email address.");
    }
    if (inv.owner_attorney_user_id === context.userId) {
      throw new Error("The owning attorney cannot accept their own collaborator invite.");
    }
    const { error } = await supabaseAdmin
      .from("case_collaborators")
      .update({
        status: "active",
        accepted_at: new Date().toISOString(),
        collaborator_user_id: context.userId,
      })
      .eq("id", inv.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });