/**
 * Builds the same bytes a real authenticator returns (authenticator data, a COSE key in a
 * CBOR attestation object, a DER ES256 signature), so the real verifier and the real enrollment
 * and unlock flows run on real structures. No browser or phone is involved.
 */
import { createHash, generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { b64urlEncode, type Jwk } from "@/lib/webauthn.server";

export const ORIGIN = "https://pattern-proof.tech";
export const RP = "pattern-proof.tech";
export const DEFAULT_CHALLENGE = b64urlEncode(Buffer.from("server-issued-challenge-0001"));

function head(major: number, n: number): Buffer {
  if (n < 24) return Buffer.from([(major << 5) | n]);
  if (n < 256) return Buffer.from([(major << 5) | 24, n]);
  return Buffer.from([(major << 5) | 25, n >> 8, n & 255]);
}
export function cbor(v: unknown): Buffer {
  if (typeof v === "number") return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (typeof v === "string") return Buffer.concat([head(3, Buffer.byteLength(v)), Buffer.from(v)]);
  if (Buffer.isBuffer(v)) return Buffer.concat([head(2, v.length), v]);
  if (v instanceof Map) {
    return Buffer.concat([head(5, v.size), ...[...v.entries()].flatMap(([k, val]) => [cbor(k), cbor(val)])]);
  }
  throw new Error("unsupported in test encoder");
}

export function newKey() {
  return generateKeyPairSync("ec", { namedCurve: "P-256" });
}
export function jwkOf(pub: KeyObject): Jwk {
  const j = pub.export({ format: "jwk" }) as { x: string; y: string };
  return { kty: "EC", crv: "P-256", x: j.x, y: j.y };
}
export function cose(jwk: Jwk, alg = -7) {
  return new Map<unknown, unknown>([
    [1, 2],
    [3, alg],
    [-1, 1],
    [-2, Buffer.from(jwk.x, "base64url")],
    [-3, Buffer.from(jwk.y, "base64url")],
  ]);
}
export const sha = (b: Buffer | string) => createHash("sha256").update(b).digest();

export function authData(opts: {
  rp?: string;
  flags?: number;
  count?: number;
  attested?: { id: Buffer; key: Map<unknown, unknown> };
}) {
  const flags = opts.flags ?? 0x05; // user present + user verified
  const c = opts.count ?? 0;
  const head37 = Buffer.concat([
    sha(opts.rp ?? RP),
    Buffer.from([flags | (opts.attested ? 0x40 : 0)]),
    Buffer.from([c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255, c & 255]),
  ]);
  if (!opts.attested) return head37;
  return Buffer.concat([
    head37,
    Buffer.alloc(16),
    Buffer.from([opts.attested.id.length >> 8, opts.attested.id.length & 255]),
    opts.attested.id,
    cbor(opts.attested.key),
  ]);
}

export function clientData(type: string, challenge: string, origin = ORIGIN, extra: object = {}) {
  return Buffer.from(JSON.stringify({ type, challenge, origin, ...extra }));
}

export function registration(
  over: { challenge?: string; key?: Map<unknown, unknown>; flags?: number; rp?: string; cd?: Buffer; origin?: string; id?: Buffer } = {},
) {
  const challenge = over.challenge ?? DEFAULT_CHALLENGE;
  const { publicKey } = newKey();
  const jwk = jwkOf(publicKey);
  const id = over.id ?? Buffer.from("credential-id-123456");
  const ad = authData({ attested: { id, key: over.key ?? cose(jwk) }, flags: over.flags, rp: over.rp });
  const att = cbor(new Map<unknown, unknown>([["fmt", "none"], ["attStmt", new Map()], ["authData", ad]]));
  return {
    jwk,
    id,
    response: {
      clientDataJSON: b64urlEncode(over.cd ?? clientData("webauthn.create", challenge, over.origin ?? ORIGIN)),
      attestationObject: b64urlEncode(att),
    },
    input: {
      clientDataJSON: b64urlEncode(over.cd ?? clientData("webauthn.create", challenge, over.origin ?? ORIGIN)),
      attestationObject: b64urlEncode(att),
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRpId: RP,
    },
  };
}

export function assertion(
  opts: {
    priv?: KeyObject;
    flags?: number;
    count?: number;
    rp?: string;
    challenge?: string;
    origin?: string;
    type?: string;
    extra?: object;
  } = {},
) {
  const challenge = opts.challenge ?? DEFAULT_CHALLENGE;
  const pair = newKey();
  const priv = opts.priv ?? pair.privateKey;
  const cd = clientData(opts.type ?? "webauthn.get", challenge, opts.origin ?? ORIGIN, opts.extra);
  const ad = authData({ flags: opts.flags, count: opts.count ?? 1, rp: opts.rp });
  const sig = sign("sha256", Buffer.concat([ad, sha(cd)]), { key: priv, dsaEncoding: "der" });
  const wire = {
    clientDataJSON: b64urlEncode(cd),
    authenticatorData: b64urlEncode(ad),
    signature: b64urlEncode(sig),
  };
  return {
    pair,
    wire,
    input: (jwk: Jwk, stored = 0) => ({
      ...wire,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRpId: RP,
      publicKeyJwk: jwk,
      storedSignCount: stored,
    }),
  };
}
