import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Settings and consent-screen calls for outside AI assistants. The rules live in
 * assistant-access.server.ts; this file only wires them to the signed-in survivor.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const access = await import("@/lib/assistant-access.server");
  return { db: supabaseAdmin as unknown as import("@/lib/assistant-access.server").AccessAdmin, access };
}

async function checkFor(userId: string) {
  const { db } = await admin();
  const { data, error } = await db.auth.admin.getUserById(userId);
  const user = data?.user as
    | { email?: string; last_sign_in_at?: string; identities?: Array<{ provider?: string }> }
    | null
    | undefined;
  if (error || !user) throw new Error("We couldn't check your account. Try again in a moment.");
  const email = user.email ?? "";
  const hasPassword = !!email && (user.identities ?? []).some((i) => i.provider === "email");
  return {
    hasPassword,
    lastSignInAt: user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : null,
    checkPassword: async (password: string) => {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) throw new Error("Server misconfigured.");
      const { createClient } = await import("@supabase/supabase-js");
      // A throwaway client: it checks the password and keeps nothing.
      const c = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      });
      const { error: e } = await c.auth.signInWithPassword({ email, password });
      return !e;
    },
  };
}

async function audit(userId: string, eventType: string, meta: Record<string, string | number | boolean>) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("record_audit_event", {
      p_user_id: userId,
      p_event_type: eventType,
      p_subject_kind: "assistant_access",
      p_actor_kind: "user",
      p_actor_id: userId,
      p_meta: meta,
    });
  } catch {
    /* best effort */
  }
}

const MESSAGES = {
  password_required: "Enter your account password to turn this on.",
  wrong_password: "That password isn't right.",
  sign_in_again: "For your safety, sign out and sign back in, then try again.",
} as const;

/** Is assistant access on, and does she have a password to confirm with? */
export const getAssistantAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, access } = await admin();
    const check = await checkFor(context.userId);
    return { on: await access.isAssistantAccessOn(db, context.userId), hasPassword: check.hasPassword };
  });

/** Turn assistant access ON. Needs her password (or a very recent sign-in). */
export const turnOnAssistantAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ password: z.string().max(200).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { db, access } = await admin();
    const res = await access.enableAssistantAccess(db, context.userId, {
      password: data.password,
      check: await checkFor(context.userId),
    });
    if (!res.ok) return { ok: false as const, message: MESSAGES[res.reason] };
    await audit(context.userId, "assistant.access_enabled", {});
    return { ok: true as const };
  });

/** Turn it OFF and disconnect every app. Always allowed. */
export const turnOffAssistantAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, access } = await admin();
    const res = await access.disableAssistantAccess(db, context.userId);
    await audit(context.userId, "assistant.access_disabled", res);
    return { ok: true as const, ...res };
  });

/**
 * Consent screen: before Approve, access must be on AND she re-enters her password. The consent
 * screen is a plain page, so this is the check that stops a passer-by from tapping Approve.
 */
export const checkAssistantApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ password: z.string().max(200).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { db, access } = await admin();
    if (!(await access.isAssistantAccessOn(db, context.userId))) {
      return { ok: false as const, message: "Assistant access is turned off. Turn it on in Settings first." };
    }
    const check = await checkFor(context.userId);
    if (check.hasPassword) {
      if (!data.password) return { ok: false as const, message: MESSAGES.password_required };
      if (!(await check.checkPassword(data.password))) {
        return { ok: false as const, message: MESSAGES.wrong_password };
      }
    } else if (
      check.lastSignInAt === null ||
      Date.now() - check.lastSignInAt > access.RECENT_SIGN_IN_MS
    ) {
      return { ok: false as const, message: MESSAGES.sign_in_again };
    }
    await audit(context.userId, "assistant.connection_approved", {});
    return { ok: true as const };
  });

/** After a password change: assistants off, every app disconnected. Safe to call any time. */
export const afterPasswordChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, access } = await admin();
    const res = await access.disableAssistantAccess(db, context.userId);
    await audit(context.userId, "assistant.access_disabled", { ...res, reason: "password_changed" });
    return { ok: true as const };
  });

/** Apps connected that she hasn't been shown yet. */
export const listUnseenConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, access } = await admin();
    const apps = await access.unseenConnections(db, context.userId);
    return apps.map((a) => ({ id: a.id, name: a.client_name ?? "An app", grantedAt: a.granted_at }));
  });

/** She has seen the connections that exist now. */
export const acknowledgeConnections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, access } = await admin();
    await access.acknowledgeConnections(db, context.userId);
    return { ok: true as const };
  });
