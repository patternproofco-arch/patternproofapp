/**
 * A newer invitation to the same attorney (and same case) replaces the older pending one.
 * Otherwise a survivor who narrows what she shares would leave the earlier, wider link live
 * until it expired. Revoking only ever reduces access, and it can be undone by inviting again.
 */
export async function supersedePendingInvitations(
  db: any,
  input: { clientId: string; attorneyEmail: string; caseId: string | null; keepId: string },
) {
  let query = db
    .from("attorney_invitations")
    .update({ status: "revoked" })
    .eq("client_user_id", input.clientId)
    .eq("attorney_email", input.attorneyEmail.trim().toLowerCase())
    .eq("status", "pending")
    .neq("id", input.keepId);
  query = input.caseId ? query.eq("case_id", input.caseId) : query.is("case_id", null);
  const { error } = await query;
  if (error) throw new Error("We couldn't retire your earlier invitation. Please try again.");
}
