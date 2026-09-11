const KEY = "pp.capture.draft";

export type CaptureDraft = {
  aboutWhen: string;
  savedAt: string;
  durationSec?: number;
};

export function saveCaptureDraft(draft: CaptureDraft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* private mode */
  }
}

export function readCaptureDraft(): CaptureDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CaptureDraft) : null;
  } catch {
    return null;
  }
}

export function clearCaptureDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
