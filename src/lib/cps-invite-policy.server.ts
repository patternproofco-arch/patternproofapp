/**
 * The survivor's switch for child-protection invitations.
 *
 * Mirrors assistant-access: the setting lives in the auth service's app metadata (the browser
 * cannot write it), is read fresh on every invitation, and a failed read means BLOCKED.
 *  - "ask" (default): an invitation reaches her and she decides.
 *  - "block": no email is sent at all, and the worker sees the same reply as for any address.
 * Blocking is always one tap. Going back to "ask" needs her password (or a very recent
 * sign-in), so brief access to her phone cannot weaken it.
 */
import {
  RECENT_SIGN_IN_MS,
  readMeta,
  writeMeta,
  type AccessAdmin,
  type EnableCheck,
  type EnableResult,
} from "@/lib/assistant-access.server";

export const CPS_INVITES_FLAG = "cps_invites";
export type CpsInvitePolicy = "ask" | "block";

export async function getCpsInvitePolicy(admin: AccessAdmin, userId: string): Promise<CpsInvitePolicy> {
  try {
    const meta = await readMeta(admin, userId);
    if (!meta) return "block";
    const v = meta[CPS_INVITES_FLAG];
    return v === "block" ? "block" : v === undefined || v === "ask" ? "ask" : "block";
  } catch {
    return "block";
  }
}

export async function blockCpsInvites(admin: AccessAdmin, userId: string): Promise<void> {
  await writeMeta(admin, userId, { [CPS_INVITES_FLAG]: "block" });
}

export async function allowCpsInvites(
  admin: AccessAdmin,
  userId: string,
  input: { password?: string; check: EnableCheck; now?: number },
): Promise<EnableResult> {
  const now = input.now ?? Date.now();
  if (input.check.hasPassword) {
    if (!input.password) return { ok: false, reason: "password_required" };
    if (!(await input.check.checkPassword(input.password))) return { ok: false, reason: "wrong_password" };
  } else if (input.check.lastSignInAt === null || now - input.check.lastSignInAt > RECENT_SIGN_IN_MS) {
    return { ok: false, reason: "sign_in_again" };
  }
  await writeMeta(admin, userId, { [CPS_INVITES_FLAG]: "ask" });
  return { ok: true };
}

/**
 * Should the email go out? Unknown address (no account yet) means yes: there is no setting to
 * read. A known account that blocks, or whose setting cannot be read, means no.
 * The caller must give the worker the same reply either way.
 */
export async function shouldDeliverCpsInvite(
  admin: AccessAdmin,
  email: string,
  findUserIdByEmail: (email: string) => Promise<string | null>,
): Promise<boolean> {
  let userId: string | null;
  try {
    userId = await findUserIdByEmail(email.trim().toLowerCase());
  } catch {
    return false;
  }
  if (!userId) return true;
  return (await getCpsInvitePolicy(admin, userId)) === "ask";
}
