/**
 * Application-level encryption for Clio OAuth tokens.
 *
 * Tokens are AES-256-GCM encrypted before they touch Postgres, so a database
 * dump (or anyone with table access) sees ciphertext rather than a live Clio
 * credential. The key is derived from the server-only secret
 * CLIO_TOKEN_ENC_KEY, which is never exposed to the browser.
 *
 * Limitation, stated plainly: this is at-rest encryption *within* our
 * application. The key lives in the same server environment that reads the
 * database, so it protects against database-level exposure, not against
 * compromise of the running server. Rows remain service-role only.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "v1:";

function key(): Buffer {
  const raw = process.env.CLIO_TOKEN_ENC_KEY;
  if (!raw) throw new Error("CLIO_TOKEN_ENC_KEY is not configured");
  // Derive a fixed 32-byte key from the random secret string.
  return createHash("sha256").update(raw, "utf8").digest();
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

/**
 * Decrypts a stored token. Values written before encryption was introduced are
 * returned as-is so an existing connection keeps working until its next refresh
 * rewrites it encrypted.
 */
export function decryptToken(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const buf = Buffer.from(stored.slice(PREFIX.length), "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export function tokenEncryptionAvailable(): boolean {
  return Boolean(process.env.CLIO_TOKEN_ENC_KEY);
}
