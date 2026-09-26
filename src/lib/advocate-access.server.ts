export type ShareState = { status: string; expires_at?: string | null; revoked_at?: string | null };

export function isLiveAdvocateShare(row: ShareState | null | undefined, now = Date.now()): boolean {
  if (!row || row.status !== "active" || row.revoked_at) return false;
  if (!row.expires_at) return true;
  const expiry = Date.parse(row.expires_at);
  return Number.isFinite(expiry) && expiry > now;
}

/** Check both invitation directions as well as the link, including partial revocations. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function advocateLinkIsAuthorized(
  admin: any,
  link: ShareState & { invitation_id?: string | null; survivor_invite_id?: string | null },
  now = Date.now(),
) {
  if (!isLiveAdvocateShare(link, now)) return false;
  for (const [table, id] of [
    ["advocate_invitations", link.invitation_id],
    ["advocate_survivor_invites", link.survivor_invite_id],
  ]) {
    if (!id) continue;
    const { data, error } = await admin
      .from(table)
      .select("status,expires_at")
      .eq("id", id)
      .maybeSingle();
    if (error || !data || data.status !== "accepted") return false;
    if (!isLiveAdvocateShare({ ...data, status: "active" }, now)) return false;
  }
  return true;
}
