/** Approval is database-owned; JWT/user metadata never authorizes attorneys. */
export async function assertApprovedAttorney(db: any, userId: string) {
  const { data, error } = await db
    .from("attorney_access_applications")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || data?.status !== "approved")
    throw new Error("Attorney approval required. Apply at /attorney-apply.");
}

export async function assertApprovedAttorneyAccount(db: any, userId: string) {
  const { data, error } = await db.from("user_roles").select("role").eq("user_id", userId);
  if (error || !data) throw new Error("Could not verify account access.");
  const roles = data.map((r: { role: string }) => r.role);
  // Admin is a database-owned role (user_roles, service role read). A founder
  // account that also holds an unreviewed attorney role keeps its survivor and
  // staff access; attorney-only endpoints still call assertApprovedAttorney.
  if (roles.includes("attorney") && !roles.includes("admin")) {
    await assertApprovedAttorney(db, userId);
  }
}
