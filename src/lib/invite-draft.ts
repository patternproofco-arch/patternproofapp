/**
 * Small, framework free helpers for the survivor invited attorney page.
 * Kept separate from the route so the rules can be tested without a browser.
 */

export interface InviteDraft {
  fullName: string;
  barNumber: string;
}

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** A saved draft is dropped after a day so details do not linger on a shared computer. */
export const INVITE_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export function inviteDraftKey(token: string): string {
  return `pp-invite-draft-${token}`;
}

/**
 * The confirmation email usually opens in a NEW tab, which has its own
 * sessionStorage. The draft is therefore kept in localStorage (name and bar
 * number only, never a password) with an expiry, and cleared as soon as it
 * has been used.
 */
export function saveInviteDraft(
  storage: DraftStorage,
  token: string,
  draft: InviteDraft,
  now: number = Date.now(),
): void {
  try {
    storage.setItem(
      inviteDraftKey(token),
      JSON.stringify({ fullName: draft.fullName, barNumber: draft.barNumber, savedAt: now }),
    );
  } catch {
    /* storage can be full or blocked; the form still works without a saved draft */
  }
}

export function loadInviteDraft(
  storage: DraftStorage,
  token: string,
  now: number = Date.now(),
): InviteDraft | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(inviteDraftKey(token));
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as { fullName?: unknown; barNumber?: unknown; savedAt?: unknown };
    if (typeof d.savedAt !== "number" || now - d.savedAt > INVITE_DRAFT_TTL_MS || d.savedAt > now + 60_000) {
      clearInviteDraft(storage, token);
      return null;
    }
    const fullName = typeof d.fullName === "string" ? d.fullName : "";
    const barNumber = typeof d.barNumber === "string" ? d.barNumber : "";
    if (!fullName && !barNumber) return null;
    return { fullName, barNumber };
  } catch {
    clearInviteDraft(storage, token);
    return null;
  }
}

export function clearInviteDraft(storage: DraftStorage, token: string): void {
  try {
    storage.removeItem(inviteDraftKey(token));
  } catch {
    /* nothing to clear */
  }
}

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * True only when we can positively tell the signed in account is NOT the one the
 * invitation was written for. Missing data never produces a mismatch, because the
 * server is the real gate and enforces the verified email match itself.
 */
export function isWrongInviteAccount(
  signedInEmail: string | null | undefined,
  invitedEmail: string | null | undefined,
): boolean {
  const a = norm(signedInEmail);
  const b = norm(invitedEmail);
  if (!a || !b) return false;
  return a !== b;
}
