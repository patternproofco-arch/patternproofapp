/** Pure validation for a Clio OAuth state row. Single-use is enforced by the
 *  caller deleting the row; this covers presence, ownership shape, and expiry. */
export interface ClioStateRow {
  state: string;
  user_id: string;
  expires_at: string;
}

export type StateCheck =
  | { ok: true; userId: string }
  | { ok: false; reason: "missing" | "expired" | "mismatch" };

export function checkClioState(
  row: ClioStateRow | null | undefined,
  presentedState: string,
  now: number = Date.now(),
): StateCheck {
  if (!row) return { ok: false, reason: "missing" };
  if (row.state !== presentedState) return { ok: false, reason: "mismatch" };
  if (!row.user_id) return { ok: false, reason: "mismatch" };
  if (new Date(row.expires_at).getTime() < now) return { ok: false, reason: "expired" };
  return { ok: true, userId: row.user_id };
}
