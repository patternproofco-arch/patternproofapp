/** Approval is database-owned; JWT/user metadata never authorizes attorneys. */
export async function assertApprovedAttorney(db: any, userId: string) {
  const { data, error } = await db
    .from("attorney_applications")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || data?.status !== "approved")
    throw new Error("Attorney approval required. Apply at /attorney-apply.");
}

export async function assertApprovedAttorneyAccount(db: any, userId: string) {
  const { data, error } = await db.from("user_roles").select("role").eq("user_id", userId);
  if (error || !data) throw new Error("Could not verify account access.");
  if (data.some((r: { role: string }) => r.role === "attorney")) {
    await assertApprovedAttorney(db, userId);
  }
}
