/**
 * Professional verification spine (DV organizations + attorneys).
 *
 * Fail-closed: only live Verified status may proceed on share targets, invite
 * mint, grant create/read, staff invite, search, dashboards, exports, Clio.
 * Payment / subscription never implies Verified. Screens are out of scope —
 * these helpers are for server enforcement only.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export const VERIFICATION_STATUSES = [
  "pending",
  "needs_more_info",
  "declined",
  "verified",
  "suspended",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const ORG_NOT_VERIFIED_MESSAGE =
  "This organization is not verified. Sharing and partner tools stay closed until review is complete.";

export const ATTORNEY_NOT_VERIFIED_MESSAGE =
  "This attorney account is not verified. Case access stays closed until a human review clears it.";

export const SURVIVOR_CONFIRM_REQUIRED_MESSAGE =
  "Confirm this is your attorney before access can be granted.";

export const CASE_ENGAGEMENT_LAPSED_MESSAGE =
  "This case share needs a fresh still-on-case confirmation before access continues.";

export const SURVIVOR_LOOKUP_DENIED_MESSAGE =
  "Attorney accounts cannot search or look up survivors by name or email.";

export function isLiveVerifiedStatus(
  status: string | null | undefined,
  expiresAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (status !== "verified") return false;
  if (!expiresAt) return true;
  const exp = new Date(expiresAt).getTime();
  return Number.isFinite(exp) && exp > now;
}

/** 6-month still-on-case: unconfirmed after six months = fail closed. */
export function isCaseEngagementCurrent(
  linkedAt: string | null | undefined,
  confirmedAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!linkedAt) return false;
  const linked = new Date(linkedAt).getTime();
  if (!Number.isFinite(linked)) return false;
  const sixMonthsMs = 182 * 86_400_000;
  if (now - linked <= sixMonthsMs) return true;
  if (!confirmedAt) return false;
  const confirmed = new Date(confirmedAt).getTime();
  return Number.isFinite(confirmed) && now - confirmed <= sixMonthsMs;
}

export async function loadOrgVerification(admin: Admin, orgId: string) {
  const { data, error } = await admin
    .from("dv_organizations")
    .select("id,name,verification_status,verification_expires_at,admin_email_domain")
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as {
    id: string;
    name: string;
    verification_status: string;
    verification_expires_at: string | null;
    admin_email_domain: string | null;
  } | null;
}

export async function assertOrgVerified(admin: Admin, orgId: string) {
  const org = await loadOrgVerification(admin, orgId);
  if (
    !org ||
    !isLiveVerifiedStatus(org.verification_status, org.verification_expires_at)
  ) {
    throw new Error(ORG_NOT_VERIFIED_MESSAGE);
  }
  return org;
}

export async function orgIdForAdvocate(admin: Admin, advocateUserId: string) {
  const { data: member } = await admin
    .from("org_members")
    .select("org_id")
    .eq("user_id", advocateUserId)
    .maybeSingle();
  return (member?.org_id as string | undefined) ?? null;
}

/** Advocates with an org must be Verified; advocates without an org are not org share targets. */
export async function assertAdvocateOrgVerifiedIfAny(admin: Admin, advocateUserId: string) {
  const orgId = await orgIdForAdvocate(admin, advocateUserId);
  if (!orgId) return null;
  return assertOrgVerified(admin, orgId);
}

export async function loadAttorneyVerification(admin: Admin, userId: string) {
  const { data, error } = await admin
    .from("attorney_profiles")
    .select(
      "user_id,verification_status,verification_expires_at,bar_callback_phone,address_visible_to_survivors,legal_aid_dual_role,office_address",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as {
    user_id: string;
    verification_status: string;
    verification_expires_at: string | null;
    bar_callback_phone: string | null;
    address_visible_to_survivors: boolean;
    legal_aid_dual_role: boolean;
    office_address: string | null;
  } | null;
}

export async function attorneyHasVerifiedJurisdiction(admin: Admin, userId: string) {
  const { data } = await admin
    .from("attorney_bar_jurisdictions")
    .select("verification_status,verification_expires_at")
    .eq("attorney_user_id", userId);
  return ((data ?? []) as Array<{
    verification_status: string;
    verification_expires_at: string | null;
  }>).some((j) => isLiveVerifiedStatus(j.verification_status, j.verification_expires_at));
}

/**
 * Live Verified requires profile CLEAR + at least one verified jurisdiction.
 * Subscription / trial / payment are intentionally ignored.
 */
export async function assertAttorneyVerified(admin: Admin, userId: string) {
  const profile = await loadAttorneyVerification(admin, userId);
  if (
    !profile ||
    !isLiveVerifiedStatus(profile.verification_status, profile.verification_expires_at)
  ) {
    throw new Error(ATTORNEY_NOT_VERIFIED_MESSAGE);
  }
  const hasJurisdiction = await attorneyHasVerifiedJurisdiction(admin, userId);
  if (!hasJurisdiction) throw new Error(ATTORNEY_NOT_VERIFIED_MESSAGE);
  return profile;
}

export async function assertAttorneyCaseEngagement(
  linkedAt: string | null | undefined,
  confirmedAt: string | null | undefined,
) {
  if (!isCaseEngagementCurrent(linkedAt, confirmedAt)) {
    throw new Error(CASE_ENGAGEMENT_LAPSED_MESSAGE);
  }
}

/** Hard deny: no attorney survivor name/email/search/lookup surface. */
export function denyAttorneySurvivorLookup(): never {
  throw new Error(SURVIVOR_LOOKUP_DENIED_MESSAGE);
}

/**
 * Legal-aid dual role must not unlock org-wide survivor pull.
 * Call before minting advocate→survivor invites or org identity oversight.
 */
export async function assertNotLegalAidOrgWidePull(admin: Admin, userId: string) {
  const { data: attorney } = await admin
    .from("attorney_profiles")
    .select("legal_aid_dual_role")
    .eq("user_id", userId)
    .maybeSingle();
  if (attorney?.legal_aid_dual_role) {
    throw new Error(
      "Legal-aid dual-role accounts cannot pull survivors org-wide. Survivor-initiated share only.",
    );
  }
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const set = new Set(((roles ?? []) as Array<{ role: string }>).map((r) => r.role));
  if (set.has("attorney") && set.has("advocate")) {
    throw new Error(
      "Legal-aid dual-role accounts cannot pull survivors org-wide. Survivor-initiated share only.",
    );
  }
}
