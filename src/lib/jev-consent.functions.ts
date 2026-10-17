import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ownedShare(clientId: string, linkId: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data, error } = await db
    .from("attorney_client_links")
    .select("id,attorney_user_id")
    .eq("id", linkId)
    .eq("client_user_id", clientId)
    .maybeSingle();
  if (error || !data) throw new Error("That sharing record isn't available.");
  return { db, row: data };
}
async function activeOwnedShare(clientId: string, linkId: string) {
  const { db, row } = await ownedShare(clientId, linkId);
  const { assertLink } = await import("./attorney-access.server");
  const link = await assertLink(db, row.attorney_user_id, clientId);
  if (link.id !== linkId) throw new Error("That sharing record is no longer current.");
  return { db, row, link };
}
async function auditPermission(clientId: string, linkId: string, enabled: boolean) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  try {
    await db.rpc("record_audit_event", {
      p_user_id: clientId,
      p_event_type: enabled ? "jev.request_access_enabled" : "jev.request_access_disabled",
      p_subject_kind: "attorney_client_link",
      p_subject_id: linkId,
      p_actor_kind: "user",
      p_actor_id: clientId,
      p_meta: { provider: "TypeSafe", purpose: "request_matching" },
    });
  } catch {
    /* The authoritative permission is already saved. Never log content. */
  }
}
export const getMyJevSharePermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { isExpired } = await import("./attorney-access.server");
    const { permissionFromMetadata, jevScopeHash, hasRecentJevAuthentication } =
      await import("./jev-consent.server");
    const { data: account, error: accountError } = await db.auth.admin.getUserById(context.userId);
    if (accountError || !account.user)
      throw new Error("We couldn't check your AI permissions. Try again.");
    const { data: links, error } = await db
      .from("attorney_client_links")
      .select("id,attorney_user_id,expires_at")
      .eq("client_user_id", context.userId)
      .eq("status", "active")
      .is("revoked_at", null);
    if (error) throw new Error("We couldn't check your sharing records. Try again.");
    const shares = [];
    for (const row of links ?? []) {
      if (isExpired(row.expires_at)) continue;
      const { link } = await activeOwnedShare(context.userId, row.id);
      const permission = await permissionFromMetadata(
        account.user.app_metadata ?? {},
        context.userId,
        row.attorney_user_id,
        link,
      );
      const expiresAt = permission?.expiresAt ?? null;
      const { data: profile, error: profileError } = await db
        .from("attorney_profiles")
        .select("full_name")
        .eq("user_id", row.attorney_user_id)
        .maybeSingle();
      if (profileError)
        throw new Error("We couldn't identify the attorney for this share. Try again.");
      shares.push({
        linkId: row.id,
        scopeFingerprint: await jevScopeHash(link),
        attorneyName: profile?.full_name ?? "Your attorney",
        enabled: !!expiresAt,
        expiresAt,
        fileCount: link.scope_evidence?.length ?? 0,
      });
    }
    return {
      shares,
      requiresPassword:
        !hasRecentJevAuthentication(context.claims) &&
        !!account.user.email &&
        account.user.identities?.some((i) => i.provider === "email") === true,
      available:
        process.env.PATTERNPROOF_AI_POLICY_APPROVED === "true" &&
        process.env.PATTERNPROOF_JEV_POLICY_APPROVED === "true" &&
        !!process.env.JEV_API_KEY,
    };
  });

export const setMyJevSharePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        linkId: z.string().uuid(),
        enabled: z.boolean(),
        password: z.string().max(200).optional(),
        scopeFingerprint: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const {
      consentKey,
      JEV_CONSENT_VERSION,
      JEV_CONSENT_DAYS,
      jevScopeHash,
      hasRecentJevAuthentication,
    } = await import("./jev-consent.server");
    const { db } = await ownedShare(context.userId, data.linkId);
    if (!data.enabled) {
      // Off never requires password, an active grant, a configured provider, or outside processing.
      const { error } = await db.auth.admin.updateUserById(context.userId, {
        app_metadata: { [consentKey(data.linkId)]: { enabled: false } },
      });
      if (error) throw new Error("We couldn't turn this permission off. Try again.");
      await auditPermission(context.userId, data.linkId, false);
      return { ok: true as const };
    }
    const { assertJevAvailable } = await import("./jev.server");
    assertJevAvailable();
    const { data: account, error } = await db.auth.admin.getUserById(context.userId);
    if (error || !account.user) throw new Error("We couldn't check your account. Try again.");
    const user = account.user;
    const hasPassword = !!user.email && user.identities?.some((i) => i.provider === "email");
    const recentlyAuthenticated = hasRecentJevAuthentication(context.claims);
    if (!recentlyAuthenticated && hasPassword) {
      if (!data.password) throw new Error("Enter your account password to allow these checks.");
      const { createClient } = await import("@supabase/supabase-js");
      const url = process.env.SUPABASE_URL,
        key = process.env.SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) throw new Error("Account confirmation isn't available right now.");
      const check = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      });
      const { error: passwordError } = await check.auth.signInWithPassword({
        email: user.email!,
        password: data.password,
      });
      if (passwordError) throw new Error("That password isn't right.");
    } else if (!recentlyAuthenticated) {
      throw new Error("Sign out and sign back in, then try again within 10 minutes.");
    }
    const { row, link } = await activeOwnedShare(context.userId, data.linkId);
    const scopeHash = await jevScopeHash(link);
    if (data.scopeFingerprint !== scopeHash)
      throw new Error(
        "The shared files changed since you reviewed this permission. Refresh and review the current share before allowing checks.",
      );
    const permission = {
      version: JEV_CONSENT_VERSION,
      clientId: context.userId,
      attorneyId: row.attorney_user_id,
      scopeHash,
      nonce: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + JEV_CONSENT_DAYS * 86_400_000).toISOString(),
    };
    // Send one top-level key; leave unrelated account settings out of the update.
    const { error: saveError } = await db.auth.admin.updateUserById(context.userId, {
      app_metadata: { [consentKey(data.linkId)]: permission },
    });
    if (saveError) throw new Error("We couldn't save that permission. Try again.");
    await auditPermission(context.userId, data.linkId, true);
    return { ok: true as const };
  });
