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
      .select("firm_name, clio_user_email, created_at, expires_at")
      .eq("user_id", context.userId)
      .is("revoked_at", null)
      .maybeSingle();
    if (!data) return { connected: false as const };
    return {
      connected: true as const,
      firmName: data.firm_name,
      email: data.clio_user_email,
      connectedAt: data.created_at,
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

    const { error } = await supabaseAdmin
      .from("clio_connections")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error("We couldn't disconnect Clio. Try again in a moment.");
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
