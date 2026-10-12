/**
 * Invitations from a child-protection worker to a survivor, and what she can do with them.
 *
 * An invitation is a request, never access. Nothing is shared until she signs in on her own,
 * picks exact items, and confirms with her password. The worker never learns whether an address
 * has an account, whether she blocked these requests, opened, ignored or declined.
 *
 * Guard rails: approved workers only; a daily cap per worker (small for new accounts); a cap per
 * recipient across all workers; no free text; a fixed email that names no agency; the token is
 * stored only as a hash.
 */
import { assertApprovedCpsWorker, buildCpsScope } from "@/lib/cps-access.server";
import { shouldDeliverCpsInvite, getCpsInvitePolicy } from "@/lib/cps-invite-policy.server";
import { clampGrantDays, dailyInviteCap } from "@/lib/cps-verification";
import type { AccessAdmin } from "@/lib/assistant-access.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const INVITE_DAYS = 14;
export const PER_RECIPIENT_PER_DAY = 3;
const DAY = 86_400_000;

export type InviteDeps = {
  db: Db;
  authAdmin: AccessAdmin;
  findUserIdByEmail: (email: string) => Promise<string | null>;
  deliver: (args: { to: string; acceptUrl: string; expiresLabel: string; idempotencyKey: string }) => Promise<boolean>;
  newToken: () => string;
  hash: (token: string) => Promise<string>;
  origin: string;
  now?: number;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GENERIC = "If that address can receive requests, an invitation was sent.";

/** Wait until at least `ms` (plus a little jitter) have passed since `startedAt`. */
export async function padToMinimum(startedAt: number, ms = 2500, jitterMs = 400): Promise<void> {
  const wait = startedAt + ms + Math.random() * jitterMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

export type CreateInviteResult = { ok: true; message: string };

export async function createCpsInvite(
  deps: InviteDeps,
  workerId: string,
  input: { email: string; caseRef?: string | null },
): Promise<CreateInviteResult> {
  const { db } = deps;
  const now = deps.now ?? Date.now();
  await assertApprovedCpsWorker(db, workerId);
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 255) throw new Error("Enter a valid email address.");
  const caseRef = input.caseRef?.trim() ? input.caseRef.trim().slice(0, 60) : null;

  const { data: app } = await db
    .from("cps_access_applications")
    .select("approved_at")
    .eq("user_id", workerId)
    .maybeSingle();
  const cap = dailyInviteCap(app?.approved_at, now);
  const since = new Date(now - DAY).toISOString();
  const { data: mine, error: mineError } = await db
    .from("cps_invitations")
    .select("id")
    .eq("worker_user_id", workerId)
    .gte("created_at", since);
  if (mineError) throw new Error("Could not check your daily limit. Try again later.");
  if ((mine ?? []).length >= cap) {
    throw new Error(`You have reached today's limit of ${cap} invitations. Try again tomorrow.`);
  }

  // Already invited by this worker and still open: do not send again, reply the same way.
  const { data: open } = await db
    .from("cps_invitations")
    .select("id,expires_at")
    .eq("worker_user_id", workerId)
    .eq("survivor_email", email)
    .eq("status", "sent");
  if ((open ?? []).some((r: { expires_at: string }) => Date.parse(r.expires_at) > now)) {
    return { ok: true, message: GENERIC };
  }

  // Too many requests to one person from anyone: stop delivering, same reply.
  const { data: toHer } = await db
    .from("cps_invitations")
    .select("id")
    .eq("survivor_email", email)
    .gte("created_at", since)
    .neq("status", "suppressed");
  const flooded = (toHer ?? []).length >= PER_RECIPIENT_PER_DAY;

  const deliver = !flooded && (await shouldDeliverCpsInvite(deps.authAdmin, email, deps.findUserIdByEmail));
  const token = deps.newToken();
  const expiresAt = new Date(now + INVITE_DAYS * DAY).toISOString();
  const { data: row, error } = await db
    .from("cps_invitations")
    .insert({
      worker_user_id: workerId,
      survivor_email: email,
      token_hash: await deps.hash(token),
      case_ref: caseRef,
      status: deliver ? "sent" : "suppressed",
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error || !row) throw new Error("Could not create the invitation.");
  if (deliver) {
    // A failed send is not shown to the worker either way; she can send again tomorrow.
    await deps.deliver({
      to: email,
      acceptUrl: `${deps.origin}/cps-invite/${token}`,
      expiresLabel: `${INVITE_DAYS} days`,
      idempotencyKey: `cps-invite-${row.id}`,
    });
  }
  return { ok: true, message: GENERIC };
}

export type Peek =
  | { status: "not-found" }
  | {
      status: "ok";
      worker: { name: string; agency: string; approvedAt: string | null; verification: string };
      caseRef: string | null;
      expiresAt: string;
    };

/** What the survivor sees before signing in. Does not mark the invitation opened. */
export async function peekCpsInvite(db: Db, token: string, hash: (t: string) => Promise<string>, now = Date.now()): Promise<Peek> {
  const { data: inv } = await db
    .from("cps_invitations")
    .select("id,worker_user_id,case_ref,status,expires_at")
    .eq("token_hash", await hash(token))
    .maybeSingle();
  if (!inv || inv.status !== "sent" || Date.parse(inv.expires_at) <= now) return { status: "not-found" };
  try {
    await assertApprovedCpsWorker(db, inv.worker_user_id);
  } catch {
    return { status: "not-found" };
  }
  const { data: app } = await db
    .from("cps_access_applications")
    .select("full_name,agency_name,approved_at,verification_tier,email_domain")
    .eq("user_id", inv.worker_user_id)
    .maybeSingle();
  if (!app) return { status: "not-found" };
  return {
    status: "ok",
    worker: {
      name: app.full_name,
      agency: app.agency_name,
      approvedAt: app.approved_at ?? null,
      // Say only what was actually checked.
      verification:
        app.verification_tier === 1
          ? `PatternProof confirmed a working email at ${app.email_domain}.`
          : "PatternProof reviewed this person before approving them.",
    },
    caseRef: inv.case_ref ?? null,
    expiresAt: inv.expires_at,
  };
}

export type AcceptInput = {
  token: string;
  survivorId: string;
  /** From the signed-in session, never from the page. */
  survivorEmail: string;
  incidents: string[];
  evidence: string[];
  days?: number;
  /** Re-checks her password (or a very recent sign-in). Must resolve true. */
  reauth: () => Promise<boolean>;
};

export type AcceptResult = {
  linkId: string;
  expiresAt: string;
  shared: { incidents: number; files: number };
  excluded: Array<{ kind: "incident" | "evidence"; id: string; reason: string }>;
};

export async function acceptCpsInvite(deps: InviteDeps, input: AcceptInput): Promise<AcceptResult> {
  const { db } = deps;
  const now = deps.now ?? Date.now();
  const { data: inv } = await db
    .from("cps_invitations")
    .select("id,worker_user_id,survivor_email,case_ref,status,expires_at")
    .eq("token_hash", await deps.hash(input.token))
    .maybeSingle();
  if (!inv || inv.status !== "sent" || Date.parse(inv.expires_at) <= now) throw new Error("This invitation is no longer valid.");
  if (inv.survivor_email !== input.survivorEmail.trim().toLowerCase()) {
    throw new Error("This invitation was sent to a different email address.");
  }
  await assertApprovedCpsWorker(db, inv.worker_user_id);
  if ((await getCpsInvitePolicy(deps.authAdmin, input.survivorId)) !== "ask") {
    throw new Error("You have turned off requests from child-protection professionals. Turn them back on in Safety settings to continue.");
  }
  if (!input.incidents.length && !input.evidence.length) throw new Error("Choose at least one thing to share before accepting.");
  if (!(await input.reauth())) throw new Error("Enter your password to confirm.");

  const built = await buildCpsScope(db, input.survivorId, { incidents: input.incidents, evidence: input.evidence });
  if (!built.scope.incidents.length && !built.scope.evidence.length) {
    throw new Error("None of the items you chose can be shared. Nothing was shared.");
  }
  const days = clampGrantDays(input.days);
  const expiresAt = new Date(now + days * DAY).toISOString();

  // Claim the invitation first so two taps cannot make two grants.
  const { data: claimed, error: claimError } = await db
    .from("cps_invitations")
    .update({ status: "accepted", accepted_at: new Date(now).toISOString() })
    .eq("id", inv.id)
    .eq("status", "sent")
    .select("id");
  if (claimError || !claimed?.length) throw new Error("This invitation is no longer valid.");
  const { data: link, error } = await db
    .from("cps_client_links")
    .insert({
      worker_user_id: inv.worker_user_id,
      client_user_id: input.survivorId,
      invitation_id: inv.id,
      case_ref: inv.case_ref ?? null,
      scope_incidents: built.scope.incidents,
      scope_evidence: built.scope.evidence,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error || !link) {
    await db.from("cps_invitations").update({ status: "sent", accepted_at: null }).eq("id", inv.id);
    throw new Error("Could not save your choice. Nothing was shared.");
  }
  return {
    linkId: link.id,
    expiresAt,
    shared: { incidents: built.scope.incidents.length, files: built.scope.evidence.length },
    excluded: built.excluded,
  };
}

/** Decline. The worker is never told. */
export async function declineCpsInvite(
  db: Db,
  input: { token: string; survivorEmail: string },
  hash: (t: string) => Promise<string>,
): Promise<void> {
  await db
    .from("cps_invitations")
    .update({ status: "declined" })
    .eq("token_hash", await hash(input.token))
    .eq("survivor_email", input.survivorEmail.trim().toLowerCase())
    .eq("status", "sent");
}

/** End access now. Only her own active grant; one way (a revoked grant cannot come back). */
export async function revokeCpsGrant(db: Db, survivorId: string, linkId: string, now = Date.now()): Promise<boolean> {
  const { data, error } = await db
    .from("cps_client_links")
    .update({ status: "revoked", revoked_at: new Date(now).toISOString() })
    .eq("id", linkId)
    .eq("client_user_id", survivorId)
    .eq("status", "active")
    .select("id");
  if (error) throw new Error("Could not end access. Try again.");
  return (data ?? []).length > 0;
}
