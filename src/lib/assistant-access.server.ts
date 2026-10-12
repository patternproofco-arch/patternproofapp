/**
 * Outside AI assistants (the MCP connection) are OFF unless the survivor turns them on.
 *
 * Why: approving a connection is one tap on a signed-in screen, and an approved app keeps
 * reading her records until she finds and removes it. Someone with brief access to her phone
 * could connect an app of their own, and it would keep working after a password change. So:
 *  - the switch lives on the server (in the auth service's app metadata, which the browser
 *    cannot write), is read fresh on every tool call, and a failed read means OFF;
 *  - turning it ON needs her password again (or a very recent sign-in if she has no password);
 *  - turning it OFF is always one tap, takes effect at once, and disconnects every app;
 *  - a password change does the same;
 *  - she is told about any connection she hasn't seen yet.
 *
 * No database change: the flag and the "seen" list live in app_metadata.
 */

export const ASSISTANT_FLAG = "assistant_access";
export const SEEN_KEY = "assistant_seen";
/** With no password to re-check, the sign-in must be this recent to turn assistants on. */
export const RECENT_SIGN_IN_MS = 10 * 60 * 1000;

type Meta = Record<string, unknown>;

/** The slice of the admin client this module uses (so it can be tested without a network). */
export type AccessAdmin = {
  auth: {
    admin: {
      getUserById(id: string): Promise<{
        data: { user: { app_metadata?: Meta | null } | null } | null;
        error: unknown;
      }>;
      updateUserById(
        id: string,
        attrs: { app_metadata: Meta },
      ): Promise<{ error: unknown }>;
    };
  };
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: unknown }>;
};

export type ConnectedApp = {
  id: string;
  client_name: string | null;
  granted_at: string;
};

async function readMeta(admin: AccessAdmin, userId: string): Promise<Meta | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user) return null;
  return { ...(data.user.app_metadata ?? {}) };
}

/** True only when the survivor turned it on. Any problem reading it means off. */
export async function isAssistantAccessOn(admin: AccessAdmin, userId: string): Promise<boolean> {
  try {
    const meta = await readMeta(admin, userId);
    return meta?.[ASSISTANT_FLAG] === true;
  } catch {
    return false;
  }
}

async function writeMeta(admin: AccessAdmin, userId: string, patch: Meta) {
  const meta = await readMeta(admin, userId);
  if (!meta) throw new Error("We couldn't check your account. Try again in a moment.");
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...meta, ...patch },
  });
  if (error) throw new Error("We couldn't save that. Try again in a moment.");
}

export async function listConnectedApps(admin: AccessAdmin, userId: string): Promise<ConnectedApp[]> {
  const { data, error } = await admin.rpc("admin_list_oauth_consents", { p_user_id: userId });
  if (error) throw new Error("We couldn't load your connected apps. Try again in a moment.");
  return ((data ?? []) as ConnectedApp[]).map((r) => ({
    id: r.id,
    client_name: r.client_name ?? null,
    granted_at: r.granted_at,
  }));
}

/** Disconnect every app. Returns how many were removed and how many could not be. */
export async function revokeAllConnectedApps(
  admin: AccessAdmin,
  userId: string,
): Promise<{ revoked: number; failed: number }> {
  const apps = await listConnectedApps(admin, userId);
  let revoked = 0;
  let failed = 0;
  for (const app of apps) {
    const { data, error } = await admin.rpc("admin_revoke_oauth_consent", {
      p_user_id: userId,
      _consent_id: app.id,
    });
    if (error || data !== true) failed += 1;
    else revoked += 1;
  }
  return { revoked, failed };
}

export type EnableCheck = {
  hasPassword: boolean;
  lastSignInAt: number | null;
  checkPassword: (password: string) => Promise<boolean>;
};

export type EnableResult =
  | { ok: true }
  | { ok: false; reason: "password_required" | "wrong_password" | "sign_in_again" };

/** Turn assistants ON. Needs proof it is really her at the screen. */
export async function enableAssistantAccess(
  admin: AccessAdmin,
  userId: string,
  input: { password?: string; check: EnableCheck; now?: number },
): Promise<EnableResult> {
  const now = input.now ?? Date.now();
  if (input.check.hasPassword) {
    if (!input.password) return { ok: false, reason: "password_required" };
    if (!(await input.check.checkPassword(input.password))) {
      return { ok: false, reason: "wrong_password" };
    }
  } else if (input.check.lastSignInAt === null || now - input.check.lastSignInAt > RECENT_SIGN_IN_MS) {
    return { ok: false, reason: "sign_in_again" };
  }
  await writeMeta(admin, userId, { [ASSISTANT_FLAG]: true });
  return { ok: true };
}

/** Turn assistants OFF and disconnect everything. Always allowed, never asks for anything. */
export async function disableAssistantAccess(
  admin: AccessAdmin,
  userId: string,
): Promise<{ revoked: number; failed: number }> {
  // The switch first: from this moment no tool call gets an answer, even if a revoke below fails.
  await writeMeta(admin, userId, { [ASSISTANT_FLAG]: false });
  return revokeAllConnectedApps(admin, userId);
}

/** Connections she hasn't been shown yet. */
export async function unseenConnections(admin: AccessAdmin, userId: string): Promise<ConnectedApp[]> {
  const meta = await readMeta(admin, userId);
  const seen = new Set(Array.isArray(meta?.[SEEN_KEY]) ? (meta?.[SEEN_KEY] as string[]) : []);
  const apps = await listConnectedApps(admin, userId);
  return apps.filter((a) => !seen.has(a.id));
}

/** She has seen the connections that exist now. Only ids that are still connected are kept. */
export async function acknowledgeConnections(admin: AccessAdmin, userId: string): Promise<void> {
  const apps = await listConnectedApps(admin, userId);
  await writeMeta(admin, userId, { [SEEN_KEY]: apps.map((a) => a.id) });
}
