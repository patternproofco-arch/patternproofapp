import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public availability probe — safe for unauthenticated UI gating. */
export const getClioAvailability = createServerFn({ method: "GET" }).handler(async () => {
  const { clioAvailability } = await import("@/lib/clio.server");
  return clioAvailability();
});

export const startClioConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertClioAvailable, buildClioAuthorizeUrl, STATE_TTL_MS } = await import("@/lib/clio.server");
    assertClioAvailable();

    // Attorney accounts only — this is a practice-management integration.
    const { resolveCallerRole } = await import("@/lib/conflict-check.server");
    const role = await resolveCallerRole(context.userId);
    if (role !== "attorney" && role !== "collaborator") {
      throw new Error("This area is for attorney accounts.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Housekeeping: expired states are useless and must not linger.
    await supabaseAdmin.from("clio_oauth_states").delete().lt("expires_at", new Date().toISOString());

    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const state = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

    const { error } = await supabaseAdmin.from("clio_oauth_states").insert({
      state,
      user_id: context.userId,
      redirect_to: "/billing",
      expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
    });
    if (error) throw new Error("We couldn't start the Clio connection. Try again in a moment.");
    return { url: buildClioAuthorizeUrl(state) };
  });

export const getClioStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("clio_connections")
      .select("firm_name, clio_user_email, clio_user_name, clio_region, last_verified_at, created_at, revoked_at")
      .eq("user_id", context.userId)
      .maybeSingle();

    // Last export attempt, so the status area can show a real outcome rather
    // than an assumed one. No token or file contents are exposed here.
    const { data: lastExport } = await context.supabase
      .from("clio_document_exports")
      .select("document_name, clio_matter_id, status, created_at, confirmed_at, error_code")
      .eq("attorney_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return { connected: false as const, needsReconnect: false, lastExport: lastExport ?? null };
    if (data.revoked_at) {
      // Clio (or a failed refresh) ended the grant — never show "connected".
      return { connected: false as const, needsReconnect: true, lastExport: lastExport ?? null };
    }
    return {
      connected: true as const,
      needsReconnect: false,
      firmName: data.firm_name,
      email: data.clio_user_email,
      userName: data.clio_user_name,
      region: data.clio_region,
      verifiedAt: data.last_verified_at,
      connectedAt: data.created_at,
      lastExport: lastExport ?? null,
    };
  });

export const disconnectClio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptToken } = await import("@/lib/clio-crypto.server");
    const { revokeClioToken } = await import("@/lib/clio.server");

    // Read the caller's own row only, then ask Clio to revoke before deleting.
    const { data } = await supabaseAdmin
      .from("clio_connections")
      .select("access_token")
      .eq("user_id", context.userId)
      .maybeSingle();

    let revokedAtClio = false;
    if (data?.access_token) {
      try {
        revokedAtClio = await revokeClioToken(decryptToken(data.access_token));
      } catch {
        revokedAtClio = false;
      }
    }

    // Never report "disconnected" when Clio still holds the grant.
    if (data?.access_token && !revokedAtClio) {
      throw new Error(
        "Clio didn't confirm the disconnect, so your credentials are still in place. Try again in a moment — nothing was changed.",
      );
    }

    const { error } = await supabaseAdmin
      .from("clio_connections")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error("We couldn't disconnect Clio. Try again in a moment.");
    const { recordClioAudit } = await import("@/lib/clio-audit.server");
    await recordClioAudit({
      userId: context.userId,
      event: "clio.disconnected",
      actorId: context.userId,
      meta: { revoked_at_clio: revokedAtClio },
    });
    return { ok: true, revokedAtClio };
  });

export const listMyClioMatters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query?: string }) => ({
    query: typeof input?.query === "string" ? input.query.slice(0, 120) : undefined,
  }))
  .handler(async ({ data, context }) => {
    const { assertClioAvailable } = await import("@/lib/clio.server");
    assertClioAvailable();
    const { resolveCallerRole } = await import("@/lib/conflict-check.server");
    const role = await resolveCallerRole(context.userId);
    if (role !== "attorney" && role !== "collaborator") {
      throw new Error("This area is for attorney accounts.");
    }
    const { listClioMatters } = await import("@/lib/clio-matters.server");
    const matters = await listClioMatters(context.userId, { query: data.query });
    return { matters };
  });

/** What this attorney can do with Clio for one client, right now. */
export const getClioTargetForClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => ({ clientId: String(input?.clientId ?? "") }))
  .handler(async ({ data, context }) => {
    const { clioAvailability } = await import("@/lib/clio.server");
    const availability = clioAvailability();
    const { data: link } = await context.supabase
      .from("attorney_client_links")
      .select("id, clio_share_consent")
      .eq("attorney_user_id", context.userId)
      .eq("client_user_id", data.clientId)
      .eq("status", "active")
      .maybeSingle();
    if (!link) return { available: availability.available, consent: false, matter: null };
    const { data: matter } = await context.supabase
      .from("clio_matter_links")
      .select("clio_matter_id, clio_matter_display_number, clio_matter_description")
      .eq("attorney_client_link_id", link.id)
      .is("unlinked_at", null)
      .maybeSingle();
    return {
      available: availability.available,
      consent: Boolean(link.clio_share_consent),
      matter: matter ?? null,
    };
  });

/**
 * Explicit, one-shot export of a PatternProof-generated professional-review
 * packet into a Clio matter the attorney has already linked to that client.
 * No background sync, no raw survivor records, no fuzzy matching.
 */
export const exportPacketToClioMatter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; objectPath: string; matterId: string }) => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(input?.clientId ?? "")) throw new Error("That client reference isn't valid.");
    if (!/^[0-9]{1,20}$/.test(input?.matterId ?? "")) throw new Error("That Clio matter reference isn't valid.");
    if (typeof input?.objectPath !== "string" || input.objectPath.length > 400 || input.objectPath.includes("..")) {
      throw new Error("That export reference isn't valid.");
    }
    return { clientId: input.clientId, objectPath: input.objectPath, matterId: input.matterId };
  })
  .handler(async ({ data, context }) => {
    const { assertClioAvailable } = await import("@/lib/clio.server");
    assertClioAvailable();

    const { resolveCallerRole } = await import("@/lib/conflict-check.server");
    const role = await resolveCallerRole(context.userId);
    if (role !== "attorney" && role !== "collaborator") {
      throw new Error("This area is for attorney accounts.");
    }

    // The export object always lives under the caller's own storage prefix.
    if (!data.objectPath.startsWith(`${context.userId}/`)) {
      throw new Error("That export doesn't belong to your account.");
    }

    // Authorization: active link + survivor's Clio sharing consent + an
    // explicitly linked matter that matches the one chosen here.
    const { data: link } = await context.supabase
      .from("attorney_client_links")
      .select("id, clio_share_consent")
      .eq("attorney_user_id", context.userId)
      .eq("client_user_id", data.clientId)
      .eq("status", "active")
      .maybeSingle();
    if (!link) throw new Error("That client isn't shared with you right now.");
    if (!link.clio_share_consent) {
      throw new Error("Your client hasn't approved Clio sharing for this case yet.");
    }

    const { data: matterLink } = await context.supabase
      .from("clio_matter_links")
      .select("clio_matter_id")
      .eq("attorney_client_link_id", link.id)
      .is("unlinked_at", null)
      .maybeSingle();
    if (!matterLink || matterLink.clio_matter_id !== data.matterId) {
      throw new Error("Link this case to that Clio matter first, then send the packet.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dl = await supabaseAdmin.storage.from("exports").download(data.objectPath);
    if (dl.error || !dl.data) throw new Error("We couldn't find that packet. Generate it again and retry.");
    const bytes = new Uint8Array(await dl.data.arrayBuffer());
    const name = data.objectPath.split("/").pop() || "professional-review-packet.zip";

    const { data: logRow } = await supabaseAdmin
      .from("clio_document_exports")
      .insert({
        attorney_user_id: context.userId,
        attorney_client_link_id: link.id,
        clio_matter_id: data.matterId,
        document_name: name,
        byte_size: bytes.byteLength,
        status: "pending",
      })
      .select("id")
      .maybeSingle();

    try {
      const { uploadDocumentToMatter } = await import("@/lib/clio-documents.server");
      const result = await uploadDocumentToMatter({
        userId: context.userId,
        matterId: data.matterId,
        name,
        bytes,
        contentType: "application/zip",
      });
      if (logRow?.id) {
        await supabaseAdmin
          .from("clio_document_exports")
          .update({
            status: "confirmed",
            clio_document_id: result.clioDocumentId,
            confirmed_at: new Date().toISOString(),
          })
          .eq("id", logRow.id);
      }
      await supabaseAdmin
        .rpc("record_audit_event", {
          p_user_id: data.clientId,
          p_event_type: "clio.document_export",
          p_subject_kind: "export",
          p_actor_kind: "attorney",
          p_actor_id: context.userId,
        })
        .then(() => undefined, () => undefined);
      return { ok: true as const, clioDocumentId: result.clioDocumentId, name: result.name };
    } catch (e) {
      if (logRow?.id) {
        await supabaseAdmin
          .from("clio_document_exports")
          .update({ status: "failed", error_code: "upload_failed" })
          .eq("id", logRow.id);
      }
      throw new Error(e instanceof Error ? e.message : "Clio couldn't accept that document. Nothing was filed.");
    }
  });
