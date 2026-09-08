import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Downloadable advocate packets.
 *
 * Both sides go through the same server-side authorization: an ACTIVE,
 * non-expired advocate_client_links row, intersected with the case scope and
 * the survivor's selected categories. Nothing is generated in the browser and
 * no permanent public URL is ever created — the bytes are returned once, in
 * the authorized response.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function audit(admin: any, args: Record<string, unknown>) {
  try {
    await admin.rpc("record_audit_event", args);
  } catch (e) {
    console.error("[audit] packet event failed", e);
  }
}

function b64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

/* ------------------------------ survivor side ----------------------------- */

export const downloadMyAdvocatePacket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ link_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveAdvocateGrant, grantIsEmpty, loadScopedContent, buildPacketPdf } = await import(
      "@/lib/advocate-packet.server"
    );

    const { data: own } = await supabaseAdmin
      .from("advocate_client_links")
      .select("id,advocate_user_id,client_user_id")
      .eq("id", data.link_id)
      .eq("client_user_id", context.userId)
      .maybeSingle();
    if (!own) throw new Error("That sharing link isn't on your account.");

    const grant = await resolveAdvocateGrant(supabaseAdmin, {
      advocateUserId: own.advocate_user_id,
      clientUserId: context.userId,
      linkId: own.id,
    });
    if (!grant) throw new Error("This sharing link is no longer active, so there is nothing to package.");
    if (grantIsEmpty(grant)) throw new Error("Nothing is shared on this link yet.");

    const [content, { data: profile }] = await Promise.all([
      loadScopedContent(supabaseAdmin, grant),
      supabaseAdmin
        .from("advocate_profiles")
        .select("full_name,org_name,email")
        .eq("user_id", grant.advocate_user_id)
        .maybeSingle(),
    ]);

    const pdf = await buildPacketPdf({
      grant,
      content,
      advocate: profile ?? null,
      generatedAt: new Date().toISOString(),
      audience: "survivor",
    });

    await audit(supabaseAdmin, {
      p_user_id: context.userId,
      p_event_type: "packet.downloaded_by_survivor",
      p_subject_kind: "advocate_link",
      p_subject_id: grant.link_id,
      p_actor_kind: "survivor",
      p_actor_id: context.userId,
      p_meta: {
        incidents: content.incidents.length,
        evidence: content.evidence.length,
      },
    });

    return {
      filename: `patternproof-advocate-packet-${new Date().toISOString().slice(0, 10)}.pdf`,
      content_type: "application/pdf",
      base64: b64(pdf),
    };
  });

/**
 * "Preview what they can see" — the same server authorization result the
 * advocate would get, summarised. Never a client-side approximation.
 */
export const previewAdvocateScope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ link_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveAdvocateGrant, grantIsEmpty, loadScopedContent } = await import(
      "@/lib/advocate-packet.server"
    );

    const { data: own } = await supabaseAdmin
      .from("advocate_client_links")
      .select("id,advocate_user_id")
      .eq("id", data.link_id)
      .eq("client_user_id", context.userId)
      .maybeSingle();
    if (!own) throw new Error("That sharing link isn't on your account.");

    const grant = await resolveAdvocateGrant(supabaseAdmin, {
      advocateUserId: own.advocate_user_id,
      clientUserId: context.userId,
      linkId: own.id,
    });
    if (!grant || grantIsEmpty(grant)) {
      return { active: false as const, incidents: [], evidence: [], grant: null };
    }
    const content = await loadScopedContent(supabaseAdmin, grant);
    return {
      active: true as const,
      grant: {
        granted_at: grant.granted_at,
        expires_at: grant.expires_at,
        include_patterns: grant.include_patterns,
        org_admin_visibility: grant.org_admin_visibility,
        case_scoped: !!grant.case_id,
      },
      incidents: content.incidents.map((i) => ({
        id: i.id,
        date: i.date,
        location: i.location ?? null,
      })),
      evidence: content.evidence.map((e) => ({
        id: e.id,
        date: e.date,
        title: e.title,
        file_type: e.file_type,
      })),
    };
  });

/**
 * Organization-level administrative visibility. Starts OFF and only the
 * survivor can turn it on, per advocate link.
 */
export const setAdvocateOrgVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ link_id: z.string().uuid(), enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("advocate_client_links")
      .update({
        org_admin_visibility: data.enabled,
        org_visibility_updated_at: new Date().toISOString(),
      })
      .eq("id", data.link_id)
      .eq("client_user_id", context.userId);
    if (error) throw new Error(error.message);

    await audit(supabaseAdmin, {
      p_user_id: context.userId,
      p_event_type: data.enabled ? "org_visibility.granted" : "org_visibility.withdrawn",
      p_subject_kind: "advocate_link",
      p_subject_id: data.link_id,
      p_actor_kind: "survivor",
      p_actor_id: context.userId,
      p_meta: {},
    });
    return { ok: true as const, enabled: data.enabled };
  });

/* ------------------------------ advocate side ----------------------------- */

export const exportAdvocateCasePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        client_user_id: z.string().uuid(),
        case_id: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveAdvocateGrant, grantIsEmpty, loadScopedContent, buildAdvocateZip } = await import(
      "@/lib/advocate-packet.server"
    );

    const grant = await resolveAdvocateGrant(supabaseAdmin, {
      advocateUserId: context.userId,
      clientUserId: data.client_user_id,
    });

    if (!grant || grantIsEmpty(grant)) {
      await audit(supabaseAdmin, {
        p_user_id: data.client_user_id,
        p_event_type: "export.denied",
        p_subject_kind: "advocate_link",
        p_subject_id: undefined,
        p_actor_kind: "advocate",
        p_actor_id: context.userId,
        p_meta: { reason: grant ? "empty-scope" : "no-active-grant" },
      });
      throw new Error("This case is no longer shared with you.");
    }

    // A case id supplied by the caller must match the grant's own case scope.
    if (data.case_id && grant.case_id !== data.case_id) {
      await audit(supabaseAdmin, {
        p_user_id: data.client_user_id,
        p_event_type: "export.denied",
        p_subject_kind: "advocate_link",
        p_subject_id: grant.link_id,
        p_actor_kind: "advocate",
        p_actor_id: context.userId,
        p_meta: { reason: "case-outside-grant" },
      });
      throw new Error("That case isn't part of what was shared with you.");
    }

    const [content, { data: profile }] = await Promise.all([
      loadScopedContent(supabaseAdmin, grant),
      supabaseAdmin
        .from("advocate_profiles")
        .select("full_name,org_name,email")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);

    const zip = await buildAdvocateZip(supabaseAdmin, {
      grant,
      content,
      advocate: profile ?? null,
      generatedAt: new Date().toISOString(),
      audience: "advocate",
      includeFiles: true,
    });

    await audit(supabaseAdmin, {
      p_user_id: data.client_user_id,
      p_event_type: "export.downloaded_by_advocate",
      p_subject_kind: "advocate_link",
      p_subject_id: grant.link_id,
      p_actor_kind: "advocate",
      p_actor_id: context.userId,
      p_meta: {
        incidents: content.incidents.length,
        evidence: content.evidence.length,
      },
    });

    return {
      filename: `patternproof-case-package-${new Date().toISOString().slice(0, 10)}.zip`,
      content_type: "application/zip",
      base64: Buffer.from(zip).toString("base64"),
    };
  });
