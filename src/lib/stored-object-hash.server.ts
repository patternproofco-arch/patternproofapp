import { createHash } from "crypto";

/**
 * SHA-256 of a stored object without holding the whole file in memory.
 *
 * Videos can be 200 MB, and server workers have far less memory than that, so the
 * file is read as a stream and hashed chunk by chunk. A copy of the bytes is kept
 * only when the caller needs it (image fingerprinting) AND the file is small enough.
 */

type SignedUrlClient = {
  storage: {
    from(bucket: string): {
      createSignedUrl(
        path: string,
        expiresIn: number,
      ): Promise<{ data: { signedUrl: string } | null; error: unknown }>;
    };
  };
};

export type HashedObject = {
  sha256: string;
  bytes: number;
  /** Present only when keepBytesUpTo was set and the file fit under it. */
  buffer: Buffer | null;
};

export async function hashStoredObject(
  client: SignedUrlClient,
  bucket: string,
  key: string,
  opts: { keepBytesUpTo?: number } = {},
): Promise<HashedObject | null> {
  const { data: signed, error } = await client.storage.from(bucket).createSignedUrl(key, 600);
  if (error || !signed?.signedUrl) return null;
  const res = await fetch(signed.signedUrl);
  if (!res.ok || !res.body) return null;

  const hash = createHash("sha256");
  const keep = opts.keepBytesUpTo ?? 0;
  const chunks: Buffer[] = [];
  let bytes = 0;
  let keeping = keep > 0;

  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    hash.update(value);
    bytes += value.byteLength;
    if (keeping) {
      if (bytes > keep) {
        keeping = false;
        chunks.length = 0;
      } else {
        chunks.push(Buffer.from(value));
      }
    }
  }

  // A truncated download must never be recorded as the file's hash.
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > 0 && declared !== bytes) return null;

  return {
    sha256: hash.digest("hex"),
    bytes,
    buffer: keeping && chunks.length ? Buffer.concat(chunks) : null,
  };
}
