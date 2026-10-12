/**
 * Applications from child-protection professionals, and how they become approved.
 *
 * The decision is made by the plain rules in cps-verification.ts. A model never approves anyone.
 * The work mailbox is proven by the account's own confirmed email: the person must sign up or
 * sign in with the work address, and the account service only marks it confirmed after they
 * click its link. The application email must equal that confirmed address.
 *
 * Approval gives the role AND flips the application. Access needs both (see private.cps_is_approved),
 * so a half-finished approval grants nothing.
 */
import {
  classifyApplication,
  emailDomain,
  type Decision,
  type ProfessionalType,
} from "@/lib/cps-verification";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const REVERIFY_DAYS = 90;

export type SubmitInput = {
  userId: string;
  /** The account's email and whether the account service has confirmed it. */
  accountEmail: string | null;
  accountEmailConfirmed: boolean;
  fullName: string;
  agencyName: string;
  jurisdiction: string;
  professionalType: ProfessionalType;
  licenseNumber?: string | null;
  licenseState?: string | null;
};

export type SubmitResult = {
  id: string;
  status: string;
  decision: Decision | null;
  /** True when this was a repeat submit and nothing was re-decided. */
  existing: boolean;
};

export async function submitCpsApplication(db: Db, input: SubmitInput, now = Date.now()): Promise<SubmitResult> {
  const email = input.accountEmail?.trim().toLowerCase() ?? "";
  const domain = emailDomain(email);
  if (!email || !domain || !input.accountEmailConfirmed) {
    throw new Error("Confirm your work email before applying: sign up with it and click the link we send.");
  }
  const { data: inserted, error } = await db
    .from("cps_access_applications")
    .insert({
      user_id: input.userId,
      email,
      email_domain: domain,
      full_name: input.fullName,
      agency_name: input.agencyName,
      jurisdiction: input.jurisdiction,
      professional_type: input.professionalType,
      license_number: input.licenseNumber ?? null,
      license_state: input.licenseState ?? null,
      email_verified_at: new Date(now).toISOString(),
    })
    .select("id,status,user_id,email,professional_type")
    .single();
  if (error?.code === "23505") {
    // One application per account, and a repeat never overwrites or re-decides it.
    const { data: existing, error: lookup } = await db
      .from("cps_access_applications")
      .select("id,status")
      .eq("user_id", input.userId)
      .single();
    if (lookup || !existing) throw new Error("Could not find your existing application.");
    return { id: existing.id, status: existing.status, decision: null, existing: true };
  }
  if (error || !inserted) throw new Error("Could not save your application.");
  const decision = await decideApplication(db, inserted, now);
  const { data: after } = await db
    .from("cps_access_applications")
    .select("status")
    .eq("id", inserted.id)
    .maybeSingle();
  return { id: inserted.id, status: after?.status ?? inserted.status, decision, existing: false };
}

export async function decideApplication(
  db: Db,
  app: { id: string; user_id: string; email: string; professional_type: ProfessionalType },
  now = Date.now(),
): Promise<Decision> {
  const [allowed, denied] = await Promise.all([
    db.from("cps_allowed_domains").select("domain").eq("active", true),
    db.from("cps_denied_senders").select("value"),
  ]);
  // If either list cannot be read we cannot decide. Send it to a person; never auto-approve.
  if (allowed.error || denied.error) {
    await db.from("cps_access_applications").update({ verification_tier: 3 }).eq("id", app.id);
    return { action: "manual", tier: 3, reasons: ["could not read the verification lists"] };
  }
  const decision = classifyApplication({
    email: app.email,
    emailVerified: true,
    professionalType: app.professional_type,
    allowedDomains: ((allowed.data ?? []) as Array<{ domain: string }>).map((r) => r.domain),
    deniedDomains: ((denied.data ?? []) as Array<{ value: string }>).map((r) => r.value),
  });
  if (decision.action === "reject") {
    await db
      .from("cps_access_applications")
      .update({ status: "rejected", reviewed_at: new Date(now).toISOString() })
      .eq("id", app.id)
      .eq("status", "pending_review");
  } else if (decision.action === "auto_approve") {
    await approveWorker(db, app.user_id, { tier: 1, reviewerId: null }, now);
  } else if (decision.action === "needs_review" || decision.action === "manual") {
    await db.from("cps_access_applications").update({ verification_tier: decision.tier }).eq("id", app.id);
  }
  return decision;
}

/** Approve: flip the application, then give the role. A failed role write puts it back. */
export async function approveWorker(
  db: Db,
  userId: string,
  opts: { tier: 1 | 2 | 3; reviewerId: string | null },
  now = Date.now(),
): Promise<void> {
  const stamp = new Date(now).toISOString();
  const { data, error } = await db
    .from("cps_access_applications")
    .update({
      status: "approved",
      verification_tier: opts.tier,
      approved_at: stamp,
      reviewed_at: stamp,
      reviewed_by: opts.reviewerId,
      suspended_at: null,
      suspended_reason: null,
      reverify_due_at: new Date(now + REVERIFY_DAYS * 86_400_000).toISOString(),
    })
    .eq("user_id", userId)
    .in("status", ["pending_review", "rejected", "suspended"])
    .select("id");
  if (error || !data?.length) throw new Error("This application cannot be approved.");
  const { error: roleError } = await db.from("user_roles").insert({ user_id: userId, role: "cps_worker" });
  if (roleError && roleError.code !== "23505") {
    await db.from("cps_access_applications").update({ status: "pending_review", approved_at: null }).eq("user_id", userId);
    throw new Error("Could not finish the approval.");
  }
}

export type ReviewDecision = "approve" | "reject" | "suspend";

/** Founder review. Suspension takes effect at once: access checks read the application row. */
export async function reviewCpsApplication(
  db: Db,
  input: { applicationId: string; reviewerId: string; decision: ReviewDecision; reason?: string },
  now = Date.now(),
): Promise<void> {
  const { data: app, error } = await db
    .from("cps_access_applications")
    .select("id,user_id,status,verification_tier")
    .eq("id", input.applicationId)
    .maybeSingle();
  if (error || !app) throw new Error("Application not found.");
  const stamp = new Date(now).toISOString();
  if (input.decision === "approve") {
    const tier = app.verification_tier === 1 || app.verification_tier === 3 ? app.verification_tier : 2;
    await approveWorker(db, app.user_id, { tier, reviewerId: input.reviewerId }, now);
    return;
  }
  const patch =
    input.decision === "reject"
      ? { status: "rejected", reviewed_at: stamp, reviewed_by: input.reviewerId }
      : {
          status: "suspended",
          suspended_at: stamp,
          suspended_reason: (input.reason ?? "").slice(0, 300) || null,
          reviewed_at: stamp,
          reviewed_by: input.reviewerId,
        };
  const { error: updateError } = await db.from("cps_access_applications").update(patch).eq("id", app.id);
  if (updateError) throw new Error("Could not save the review.");
}

/** Facts a human reviewer sees. Deterministic: no model output is mixed in or trusted here. */
export function reviewEvidence(app: {
  email: string;
  email_domain: string;
  professional_type: string;
  verification_tier: number | null;
  agency_name: string;
}): string[] {
  const out = [`Work email ${app.email} (confirmed by the account service)`];
  out.push(`Domain: ${app.email_domain}`);
  out.push(`Claimed agency: ${app.agency_name}`);
  out.push(`Role claimed: ${app.professional_type.replaceAll("_", " ")}`);
  out.push(app.verification_tier === 3 ? "Not a government address: ask for an agency letter, or call the number on the agency's own website." : "Check the agency's public site for this person before approving.");
  return out;
}
