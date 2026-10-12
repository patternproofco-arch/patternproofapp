/**
 * Retry a storage upload that failed for a reason a retry can fix.
 *
 * A dropped connection is the normal case on a phone, and until now one failed request
 * either lost the file or, for a batch of screenshots, threw away the whole batch.
 *
 * Rules:
 *  - the object name is chosen once by the caller, so every attempt refers to the same object;
 *  - "already exists" counts as success only AFTER an earlier attempt, because that earlier
 *    attempt may have landed without us hearing back. On the first attempt it is a real conflict;
 *  - refusals a retry can't change (too large, wrong type, not allowed) return at once.
 */

export type UploadOutcome = {
  error: { message: string; statusCode?: string | number } | null;
};

const ALREADY_THERE = /already exists|duplicate|resource already|\b409\b/i;
const NOT_RETRYABLE =
  /too large|exceeded|maximum allowed|payload too large|mime type|not supported|not allowed|row-level security|unauthorized|forbidden|\b(400|401|403|413)\b/i;

export const UPLOAD_RETRY_ATTEMPTS = 3;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function uploadWithRetry<T extends UploadOutcome>(
  attempt: () => Promise<T>,
  opts: { attempts?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T | UploadOutcome> {
  const attempts = opts.attempts ?? UPLOAD_RETRY_ATTEMPTS;
  const sleep = opts.sleep ?? wait;
  let last: UploadOutcome = { error: { message: "Upload failed." } };

  for (let i = 0; i < attempts; i++) {
    let res: T | UploadOutcome;
    try {
      res = await attempt();
    } catch (e) {
      res = { error: { message: e instanceof Error ? e.message : "network" } };
    }
    if (!res.error) return res;

    const text = `${res.error.statusCode ?? ""} ${res.error.message}`;
    if (i > 0 && ALREADY_THERE.test(text)) return { error: null };
    last = res;
    if (NOT_RETRYABLE.test(text)) return res;
    if (i < attempts - 1) await sleep(400 * 2 ** i);
  }
  return last;
}
