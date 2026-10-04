/**
 * WebAuthn verification (server side, WebCrypto only).
 *
 * The browser's biometric prompt proves nothing to the server by itself: a script can
 * skip the prompt and call the server directly. These functions check what the
 * authenticator actually signed, against a one-time challenge the server issued and a
 * public key it stored at enrollment, so an unlock needs a real signature from the
 * enrolled device.
 *
 * Scope, stated plainly: ES256 (P-256) credentials only, which is what the app asks for
 * and what platform authenticators return. Attestation is not evaluated (we ask for
 * "none"): we learn that a key exists, not what device made it.
 */

export type Jwk = { kty: "EC"; crv: "P-256"; x: string; y: string };

export class WebAuthnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebAuthnError";
  }
}

const enc = new TextEncoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 ? "=".repeat(4 - (str.length % 4)) : "";
  const s = atob((str + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data as unknown as BufferSource));
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Minimal CBOR (what attestation objects and COSE keys use)
// ---------------------------------------------------------------------------

type Cbor = number | string | boolean | null | Uint8Array | Cbor[] | Map<Cbor, Cbor>;

export function cborDecode(buf: Uint8Array, start = 0): [Cbor, number] {
  let i = start;
  const need = (n: number) => {
    if (i + n > buf.length) throw new WebAuthnError("Malformed data from the device.");
  };
  const readArg = (info: number): number => {
    if (info < 24) return info;
    const size = info === 24 ? 1 : info === 25 ? 2 : info === 26 ? 4 : info === 27 ? 8 : -1;
    if (size < 0) throw new WebAuthnError("Unsupported data from the device.");
    need(size);
    let v = 0;
    for (let k = 0; k < size; k++) v = v * 256 + buf[i + k]!;
    i += size;
    return v;
  };
  need(1);
  const initial = buf[i++]!;
  const major = initial >> 5;
  const info = initial & 31;
  switch (major) {
    case 0:
      return [readArg(info), i];
    case 1:
      return [-1 - readArg(info), i];
    case 2:
    case 3: {
      const len = readArg(info);
      need(len);
      const slice = buf.slice(i, i + len);
      i += len;
      return [major === 2 ? slice : new TextDecoder().decode(slice), i];
    }
    case 4: {
      const len = readArg(info);
      const arr: Cbor[] = [];
      for (let k = 0; k < len; k++) {
        const [v, next] = cborDecode(buf, i);
        arr.push(v);
        i = next;
      }
      return [arr, i];
    }
    case 5: {
      const len = readArg(info);
      const map = new Map<Cbor, Cbor>();
      for (let k = 0; k < len; k++) {
        const [key, n1] = cborDecode(buf, i);
        const [val, n2] = cborDecode(buf, n1);
        map.set(key, val);
        i = n2;
      }
      return [map, i];
    }
    case 7:
      if (info === 20) return [false, i];
      if (info === 21) return [true, i];
      if (info === 22) return [null, i];
      throw new WebAuthnError("Unsupported data from the device.");
    default:
      throw new WebAuthnError("Unsupported data from the device.");
  }
}

// ---------------------------------------------------------------------------
// Authenticator data
// ---------------------------------------------------------------------------

const FLAG_UP = 0x01;
const FLAG_UV = 0x04;
const FLAG_AT = 0x40;

export type ParsedAuthData = {
  rpIdHash: Uint8Array;
  flags: number;
  signCount: number;
  credentialId?: Uint8Array;
  coseKey?: Map<Cbor, Cbor>;
};

export function parseAuthData(authData: Uint8Array): ParsedAuthData {
  if (authData.length < 37) throw new WebAuthnError("Malformed data from the device.");
  const flags = authData[32]!;
  const signCount = ((authData[33]! << 24) | (authData[34]! << 16) | (authData[35]! << 8) | authData[36]!) >>> 0;
  const out: ParsedAuthData = { rpIdHash: authData.slice(0, 32), flags, signCount };
  if (flags & FLAG_AT) {
    if (authData.length < 55) throw new WebAuthnError("Malformed data from the device.");
    const credLen = (authData[53]! << 8) | authData[54]!;
    if (authData.length < 55 + credLen) throw new WebAuthnError("Malformed data from the device.");
    out.credentialId = authData.slice(55, 55 + credLen);
    const [key] = cborDecode(authData, 55 + credLen);
    if (!(key instanceof Map)) throw new WebAuthnError("Malformed key from the device.");
    out.coseKey = key;
  }
  return out;
}

function jwkFromCose(key: Map<Cbor, Cbor>): Jwk {
  const kty = key.get(1);
  const alg = key.get(3);
  const crv = key.get(-1);
  const x = key.get(-2);
  const y = key.get(-3);
  if (kty !== 2 || alg !== -7 || crv !== 1 || !(x instanceof Uint8Array) || !(y instanceof Uint8Array)) {
    throw new WebAuthnError("This device's key type isn't supported. Use a PIN instead.");
  }
  if (x.length !== 32 || y.length !== 32) throw new WebAuthnError("Malformed key from the device.");
  return { kty: "EC", crv: "P-256", x: b64urlEncode(x), y: b64urlEncode(y) };
}

function parseClientData(clientDataJSON: Uint8Array, type: string, challenge: string, origin: string) {
  let data: { type?: unknown; challenge?: unknown; origin?: unknown; crossOrigin?: unknown };
  try {
    data = JSON.parse(new TextDecoder().decode(clientDataJSON));
  } catch {
    throw new WebAuthnError("Malformed data from the device.");
  }
  if (data.type !== type) throw new WebAuthnError("That response was for something else.");
  // The challenge is single-use and server-issued, so a recorded response can't be replayed.
  if (typeof data.challenge !== "string" || data.challenge !== challenge) {
    throw new WebAuthnError("That response doesn't match this request. Try again.");
  }
  if (data.origin !== origin) throw new WebAuthnError("That response came from a different site.");
  if (data.crossOrigin === true) throw new WebAuthnError("That response came from a different site.");
}

async function checkRp(parsed: ParsedAuthData, rpId: string) {
  if (!equalBytes(parsed.rpIdHash, await sha256(enc.encode(rpId)))) {
    throw new WebAuthnError("That response was for a different site.");
  }
  if (!(parsed.flags & FLAG_UP)) throw new WebAuthnError("The device didn't confirm you were present.");
  // The whole point of a biometric unlock is that the device verified the person.
  if (!(parsed.flags & FLAG_UV)) throw new WebAuthnError("The device didn't verify it was you.");
}

export type RegistrationInput = {
  clientDataJSON: string; // base64url
  attestationObject: string; // base64url
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRpId: string;
};

export async function verifyRegistration(i: RegistrationInput): Promise<{
  credentialId: string;
  publicKeyJwk: Jwk;
  signCount: number;
}> {
  parseClientData(b64urlDecode(i.clientDataJSON), "webauthn.create", i.expectedChallenge, i.expectedOrigin);
  const [att] = cborDecode(b64urlDecode(i.attestationObject));
  if (!(att instanceof Map)) throw new WebAuthnError("Malformed data from the device.");
  const authData = att.get("authData");
  if (!(authData instanceof Uint8Array)) throw new WebAuthnError("Malformed data from the device.");
  const parsed = parseAuthData(authData);
  await checkRp(parsed, i.expectedRpId);
  if (!parsed.credentialId || !parsed.coseKey) throw new WebAuthnError("The device didn't return a key.");
  return {
    credentialId: b64urlEncode(parsed.credentialId),
    publicKeyJwk: jwkFromCose(parsed.coseKey),
    signCount: parsed.signCount,
  };
}

/** WebAuthn signatures are DER-encoded; WebCrypto wants raw r||s. */
export function derToRaw(der: Uint8Array): Uint8Array {
  let i = 0;
  if (der[i++] !== 0x30) throw new WebAuthnError("Malformed signature.");
  let seqLen = der[i++]!;
  if (seqLen & 0x80) {
    const n = seqLen & 0x7f;
    seqLen = 0;
    for (let k = 0; k < n; k++) seqLen = seqLen * 256 + der[i++]!;
  }
  const readInt = (): Uint8Array => {
    if (der[i++] !== 0x02) throw new WebAuthnError("Malformed signature.");
    const len = der[i++]!;
    let v = der.slice(i, i + len);
    i += len;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);
    if (v.length > 32) throw new WebAuthnError("Malformed signature.");
    const out = new Uint8Array(32);
    out.set(v, 32 - v.length);
    return out;
  };
  const r = readInt();
  const s = readInt();
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

export type AssertionInput = {
  clientDataJSON: string; // base64url
  authenticatorData: string; // base64url
  signature: string; // base64url, DER
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRpId: string;
  publicKeyJwk: Jwk;
  storedSignCount: number;
};

export async function verifyAssertion(i: AssertionInput): Promise<{ signCount: number }> {
  const clientData = b64urlDecode(i.clientDataJSON);
  parseClientData(clientData, "webauthn.get", i.expectedChallenge, i.expectedOrigin);
  const authData = b64urlDecode(i.authenticatorData);
  const parsed = parseAuthData(authData);
  await checkRp(parsed, i.expectedRpId);

  const clientHash = await sha256(clientData);
  const signed = new Uint8Array(authData.length + clientHash.length);
  signed.set(authData, 0);
  signed.set(clientHash, authData.length);

  let ok = false;
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      { ...i.publicKeyJwk, ext: true },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      derToRaw(b64urlDecode(i.signature)) as unknown as BufferSource,
      signed as unknown as BufferSource,
    );
  } catch (e) {
    if (e instanceof WebAuthnError) throw e;
    ok = false;
  }
  if (!ok) throw new WebAuthnError("That fingerprint or face check didn't match.");

  // A counter that doesn't move forward can mean a cloned authenticator. Some devices always
  // report 0; only reject when a counter is in use and went backwards or stood still.
  if ((parsed.signCount !== 0 || i.storedSignCount !== 0) && parsed.signCount <= i.storedSignCount) {
    throw new WebAuthnError("This device's security counter went backwards. Use your PIN, then set up biometrics again.");
  }
  return { signCount: parsed.signCount };
}
