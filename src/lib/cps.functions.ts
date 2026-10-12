import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAccountAuth, requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Wiring for the child-protection portal. The rules live in cps-*.server.ts and are tested there;
 * this file only connects them to the signed-in person.
 */

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

async function audit(userId: string, eventType: string, meta: Record<string, string | number | boolean>) {
  try {
    const db = await adminDb();
    await db.rpc("record_audit_event", {
      p_user_id: userId,
      p_event_type: eventType,
      p_subject_kind: "cps_access",
      p_actor_kind: "user",
      p_actor_id: userId,
      p_meta: meta,
    });
  } catch {
    /* best effort */
  }
}

async function founderDb(userId: string) {
  const db = await adminDb();
  const { data, error } = await db.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error || !data) throw new Error("Not authorized.");
  return db;
}

async function tellFounder(subject: string, text: string, key: string) {
  const { sendRenderedEmail } = await import("@/lib/email/managed-send.server");
  const html = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return sendRenderedEmail({
    to: "patternproofco@gmail.com",
    from: "PatternProof <noreply@pattern-proof.tech>",
    subject: subject,
    html: `<p style="white-space:pre-wrap">${html}</p>`,
    text,
    label: "cps-operations",
    idempotencyKey: key,
  });
}

async function inviteDeps() {
  const db = await adminDb();
  const { randomToken, hashToken } = await import("@/lib/invite-token.server");
  const { getEmailSiteOrigin } = await import("@/lib/email/site-origin.server");
  const { deliverTransactionalEmail } = await import("@/lib/email/deliver-transactional.server");
  return {
    db,
    authAdmin: db as import("@/lib/assistant-access.server").AccessAdmin,
    findUserIdByEmail: async (email: string) => {
      const { data, error } = await db.rpc("cps_user_id_by_email", { _email: email });
      if (error) throw new Error("lookup failed");
      return (data as string | null) ?? null;
    },
    deliver: async (a: { to: string; acceptUrl: string; expiresLabel: string; idempotencyKey: string }) =>
      (
        await deliverTransactionalEmail({
          templateName: "cps-invitation",
          recipientEmail: a.to,
          templateData: { acceptUrl: a.acceptUrl, expiresLabel: a.expiresLabel },
          idempotencyKey: a.idempotencyKey,
        })
      ).sent,
    newToken: randomToken,
    hash: hashToken,
    origin: getEmailSiteOrigin(),
  };
}

// ---------- Applicant ----------

export const getMyCpsApplication = createServerFn({ method: "GET" })
  .middleware([requireAccountAuth])
  .handler(async ({ context }) => {
    const db = await adminDb();
    const { data, error } = await db
      .from("cps_access_applications")
      .select("id,status,full_name,agency_name,jurisdiction,professional_type,verification_tier,created_at,reviewed_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Could not load your application.");
    return { application: data as null | Record<string, unknown> };
  });

export const applyAsCpsWorker = createServerFn({ method: "POST" })
  .middleware([requireAccountAuth])
  .inputValidator((input) =>
    z
      .object({
        full_name: z.string().trim().min(2).max(120),
        agency_name: z.string().trim().min(2).max(200),
        jurisdiction: z.string().trim().min(2).max(120),
        professional_type: z.enum(["agency_caseworker", "licensed_social_worker", "gal_or_court"]),
        license_number: z.string().trim().max(60).optional(),
        license_state: z.string().trim().max(60).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const { data: auth, error } = await db.auth.admin.getUserById(context.userId);
    if (error || !auth?.user) throw new Error("Could not check your account. Try again.");
    const { submitCpsApplication } = await import("@/lib/cps-applications.server");
    const result = await submitCpsApplication(db, {
      userId: context.userId,
      accountEmail: auth.user.email ?? null,
      accountEmailConfirmed: !!auth.user.email_confirmed_at,
      fullName: data.full_name,
      agencyName: data.agency_name,
      jurisdiction: data.jurisdiction,
      professionalType: data.professional_type,
      licenseNumber: data.license_number ?? null,
      licenseState: data.license_state ?? null,
    });
    if (!result.existing && result.status !== "approved" && result.status !== "rejected") {
      await tellFounder(
        "CPS portal application to review",
        `${data.full_name} (${auth.user.email}) applied as ${data.professional_type.replaceAll("_", " ")} at ${data.agency_name}. Review it in the operations screen.`,
        `cps-application-${result.id}`,
      );
    }
    await audit(context.userId, "cps.application_submitted", { status: result.status });
    return { ok: true as const, status: result.status };
  });

// ---------- Worker ----------

export const createCpsInviteFn = createServerFn({ method: "POST" })
  .middleware([requireAccountAuth])
  .inputValidator((input) =>
    z.object({ email: z.string().trim().max(255), case_ref: z.string().trim().max(60).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { createCpsInvite, padToMinimum } = await import("@/lib/cps-invites.server");
    const started = Date.now();
    const result = await createCpsInvite(await inviteDeps(), context.userId, {
      email: data.email,
      caseRef: data.case_ref ?? null,
    });
    await audit(context.userId, "cps.invitation_created", {});
    // A sent email takes longer than a suppressed one. Hold every reply to the same minimum so
    // timing does not tell the worker whether the address has an account or blocks requests.
    await padToMinimum(started);
    return result;
  });

/** What a worker sees about her invitations: never declined, blocked or unopened. */
export const listMyCpsInvites = createServerFn({ method: "GET" })
  .middleware([requireAccountAuth])
  .handler(async ({ context }) => {
    const db = await adminDb();
    const { assertApprovedCpsWorker } = await import("@/lib/cps-access.server");
    await assertApprovedCpsWorker(db, context.userId);
    const { data, error } = await db
      .from("cps_invitations")
      .select("id,survivor_email,case_ref,status,created_at,expires_at")
      .eq("worker_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Could not load your invitations.");
    return (data ?? []).map((r: { id: string; survivor_email: string; case_ref: string | null; status: string; created_at: string; expires_at: string }) => ({
      id: r.id,
      email: r.survivor_email,
      caseRef: r.case_ref,
      createdAt: r.created_at,
      status: r.status === "accepted" ? "accepted" : Date.parse(r.expires_at) <= Date.now() ? "expired" : "sent",
    }));
  });

// ---------- Survivor ----------

export const peekCpsInviteFn = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const { peekCpsInvite } = await import("@/lib/cps-invites.server");
    const { hashToken } = await import("@/lib/invite-token.server");
    return peekCpsInvite(await adminDb(), data.token, hashToken);
  });

export const acceptCpsInviteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        token: z.string().min(8).max(128),
        incidents: z.array(z.string().uuid()).max(500).default([]),
        evidence: z.array(z.string().uuid()).max(500).default([]),
        days: z.number().int().min(1).max(90).optional(),
        password: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { acceptCpsInvite } = await import("@/lib/cps-invites.server");
    const { reauthCheckFor, reauthPasses } = await import("@/lib/reauth.server");
    const email = (context.claims as { email?: string } | undefined)?.email?.toLowerCase();
    if (!email) throw new Error("Sign in again to continue.");
    const check = await reauthCheckFor(context.userId);
    const result = await acceptCpsInvite(await inviteDeps(), {
      token: data.token,
      survivorId: context.userId,
      survivorEmail: email,
      incidents: data.incidents,
      evidence: data.evidence,
      days: data.days,
      reauth: () => reauthPasses(check, data.password),
    });
    await audit(context.userId, "cps.access_granted", { items: result.shared.incidents + result.shared.files });
    return { ok: true as const, ...result };
  });

export const declineCpsInviteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data, context }) => {
    const { declineCpsInvite } = await import("@/lib/cps-invites.server");
    const { hashToken } = await import("@/lib/invite-token.server");
    const email = (context.claims as { email?: string } | undefined)?.email ?? "";
    await declineCpsInvite(await adminDb(), { token: data.token, survivorEmail: email }, hashToken);
    return { ok: true as const };
  });

/** Her grants and, for each, who looked at what and when. */
export const listMyCpsGrants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb();
    const { data: links, error } = await db
      .from("cps_client_links")
      .select("id,worker_user_id,status,expires_at,revoked_at,created_at,case_ref,scope_incidents,scope_evidence")
      .eq("client_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Could not load your sharing.");
    const workerIds = Array.from(new Set((links ?? []).map((l: { worker_user_id: string }) => l.worker_user_id)));
    const { data: apps } = workerIds.length
      ? await db.from("cps_access_applications").select("user_id,full_name,agency_name").in("user_id", workerIds)
      : { data: [] };
    const { data: log } = await db
      .from("cps_access_log")
      .select("link_id,item_kind,viewed_at")
      .eq("client_user_id", context.userId)
      .order("viewed_at", { ascending: false })
      .limit(500);
    const who = new Map((apps ?? []).map((a: { user_id: string; full_name: string; agency_name: string }) => [a.user_id, a]));
    return (links ?? []).map((l: Record<string, unknown>) => {
      const a = who.get(l.worker_user_id as string) as { full_name: string; agency_name: string } | undefined;
      const views = (log ?? []).filter((v: { link_id: string }) => v.link_id === l.id);
      return {
        id: l.id as string,
        worker: a?.full_name ?? "Unknown",
        agency: a?.agency_name ?? "",
        status: l.status as string,
        live: l.status === "active" && !l.revoked_at && Date.parse(l.expires_at as string) > Date.now(),
        expiresAt: l.expires_at as string,
        caseRef: (l.case_ref as string | null) ?? null,
        itemCount: ((l.scope_incidents as string[]) ?? []).length + ((l.scope_evidence as string[]) ?? []).length,
        views: views.length,
        lastViewedAt: (views[0]?.viewed_at as string | undefined) ?? null,
      };
    });
  });

export const revokeCpsGrantFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { revokeCpsGrant } = await import("@/lib/cps-invites.server");
    const ended = await revokeCpsGrant(await adminDb(), context.userId, data.id);
    await audit(context.userId, "cps.access_ended", { ended });
    return { ok: true as const, ended };
  });

export const getCpsInviteSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getCpsInvitePolicy } = await import("@/lib/cps-invite-policy.server");
    const { reauthCheckFor } = await import("@/lib/reauth.server");
    const db = await adminDb();
    return {
      policy: await getCpsInvitePolicy(db, context.userId),
      hasPassword: (await reauthCheckFor(context.userId)).hasPassword,
    };
  });

export const blockCpsInvitesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { blockCpsInvites } = await import("@/lib/cps-invite-policy.server");
    await blockCpsInvites(await adminDb(), context.userId);
    await audit(context.userId, "cps.invites_blocked", {});
    return { ok: true as const };
  });

const REAUTH_MESSAGES = {
  password_required: "Enter your account password to turn this back on.",
  wrong_password: "That password isn't right.",
  sign_in_again: "For your safety, sign out and sign back in, then try again.",
} as const;

export const allowCpsInvitesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ password: z.string().max(200).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { allowCpsInvites } = await import("@/lib/cps-invite-policy.server");
    const { reauthCheckFor } = await import("@/lib/reauth.server");
    const res = await allowCpsInvites(await adminDb(), context.userId, {
      password: data.password,
      check: await reauthCheckFor(context.userId),
    });
    if (!res.ok) return { ok: false as const, message: REAUTH_MESSAGES[res.reason] };
    await audit(context.userId, "cps.invites_allowed", {});
    return { ok: true as const };
  });

// ---------- Founder ----------

export const listCpsApplications = createServerFn({ method: "GET" })
  .middleware([requireAccountAuth])
  .handler(async ({ context }) => {
    const db = await founderDb(context.userId);
    const { reviewEvidence } = await import("@/lib/cps-applications.server");
    const { data, error } = await db
      .from("cps_access_applications")
      .select("id,user_id,email,email_domain,full_name,agency_name,jurisdiction,professional_type,license_number,license_state,verification_tier,status,created_at,approved_at,suspended_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Could not load applications.");
    return (data ?? []).map((a: Record<string, unknown>) => ({
      ...a,
      evidence: reviewEvidence(a as Parameters<typeof reviewEvidence>[0]),
    }));
  });

export const reviewCpsApplicationFn = createServerFn({ method: "POST" })
  .middleware([requireAccountAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approve", "reject", "suspend"]),
        reason: z.string().trim().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await founderDb(context.userId);
    const { reviewCpsApplication } = await import("@/lib/cps-applications.server");
    await reviewCpsApplication(db, {
      applicationId: data.id,
      reviewerId: context.userId,
      decision: data.decision,
      reason: data.reason,
    });
    return { ok: true as const };
  });

// ---------- Worker viewer ----------

export const listMyCpsCases = createServerFn({ method: "GET" })
  .middleware([requireAccountAuth])
  .handler(async ({ context }) => {
    const { listCpsCases } = await import("@/lib/cps-viewer.server");
    return listCpsCases(await adminDb(), context.userId);
  });

export const openCpsCaseFn = createServerFn({ method: "POST" })
  .middleware([requireAccountAuth])
  .inputValidator((input) => z.object({ linkId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { openCpsCase } = await import("@/lib/cps-viewer.server");
    return openCpsCase(await adminDb(), context.userId, data.linkId);
  });
