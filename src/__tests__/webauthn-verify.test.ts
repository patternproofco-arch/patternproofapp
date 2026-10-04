import { describe, expect, it } from "vitest";
import { b64urlEncode, derToRaw, verifyAssertion, verifyRegistration } from "@/lib/webauthn.server";
import {
  DEFAULT_CHALLENGE as CHALLENGE,
  ORIGIN,
  RP,
  assertion,
  clientData,
  cose,
  jwkOf,
  newKey,
  registration,
} from "./helpers/webauthn-fixtures";

// The structures here are built by ./helpers/webauthn-fixtures. A real browser or phone is NOT covered.

describe("enrollment", () => {
  it("accepts a genuine registration and returns the key and credential id", async () => {
    const r = registration();
    const out = await verifyRegistration(r.input);
    expect(out.credentialId).toBe(b64urlEncode(r.id));
    expect(out.publicKeyJwk).toEqual(r.jwk);
  });

  it("rejects a different challenge, origin, site or response type", async () => {
    const r = registration();
    await expect(verifyRegistration({ ...r.input, expectedChallenge: "other" })).rejects.toThrow(/doesn't match this request/);
    await expect(verifyRegistration({ ...r.input, expectedOrigin: "https://evil.example" })).rejects.toThrow(/different site/);
    await expect(verifyRegistration({ ...r.input, expectedRpId: "evil.example" })).rejects.toThrow(/different site/);
    const wrongType = registration({ cd: clientData("webauthn.get", CHALLENGE) });
    await expect(verifyRegistration(wrongType.input)).rejects.toThrow(/for something else/);
  });

  it("requires the device to confirm presence AND verify the person", async () => {
    await expect(verifyRegistration(registration({ flags: 0x01 }).input)).rejects.toThrow(/verify it was you/);
    await expect(verifyRegistration(registration({ flags: 0x04 }).input)).rejects.toThrow(/present/);
  });

  it("rejects key types we can't verify instead of storing something unusable", async () => {
    const { publicKey } = newKey();
    const rsaLike = registration({ key: cose(jwkOf(publicKey), -257) });
    await expect(verifyRegistration(rsaLike.input)).rejects.toThrow(/isn't supported/);
  });

  it("rejects malformed data without crashing", async () => {
    const r = registration();
    await expect(verifyRegistration({ ...r.input, attestationObject: b64urlEncode(Buffer.from([0xff, 0x00])) })).rejects.toThrow();
  });
});

describe("unlock", () => {
  it("accepts a real signature from the enrolled key", async () => {
    const a = assertion({ count: 5 });
    const out = await verifyAssertion(a.input(jwkOf(a.pair.publicKey), 4));
    expect(out.signCount).toBe(5);
  });

  it("rejects a signature from any other key", async () => {
    const a = assertion();
    const other = newKey();
    await expect(verifyAssertion(a.input(jwkOf(other.publicKey)))).rejects.toThrow(/didn't match/);
  });

  it("rejects a tampered signature or tampered data", async () => {
    const a = assertion();
    const jwk = jwkOf(a.pair.publicKey);
    const good = a.input(jwk);
    const bytes = Buffer.from(good.signature, "base64url");
    bytes[bytes.length - 1] ^= 0xff;
    await expect(verifyAssertion({ ...good, signature: b64urlEncode(bytes) })).rejects.toThrow();
    const ad = Buffer.from(good.authenticatorData, "base64url");
    ad[36] ^= 0x01; // change the counter after signing
    await expect(verifyAssertion({ ...good, authenticatorData: b64urlEncode(ad) })).rejects.toThrow(/didn't match/);
  });

  it("rejects a response to a different challenge, so a recorded one can't be replayed", async () => {
    const a = assertion({ challenge: b64urlEncode(Buffer.from("an-old-challenge")) });
    // The server is waiting for CHALLENGE; the recorded response answers an older one.
    await expect(
      verifyAssertion({ ...a.input(jwkOf(a.pair.publicKey)), expectedChallenge: CHALLENGE }),
    ).rejects.toThrow(/doesn't match this request/);
  });

  it("rejects the wrong origin, a cross-origin frame, the wrong site and the wrong ceremony", async () => {
    const jwkOfPair = (a: ReturnType<typeof assertion>) => jwkOf(a.pair.publicKey);
    const o = assertion({ origin: "https://evil.example" });
    await expect(verifyAssertion(o.input(jwkOfPair(o)))).rejects.toThrow(/different site/);
    const x = assertion({ extra: { crossOrigin: true } });
    await expect(verifyAssertion(x.input(jwkOfPair(x)))).rejects.toThrow(/different site/);
    const rp = assertion({ rp: "evil.example" });
    await expect(verifyAssertion(rp.input(jwkOfPair(rp)))).rejects.toThrow(/different site/);
    const t = assertion({ type: "webauthn.create" });
    await expect(verifyAssertion(t.input(jwkOfPair(t)))).rejects.toThrow(/for something else/);
  });

  it("requires user verification, not just a touch", async () => {
    const a = assertion({ flags: 0x01 });
    await expect(verifyAssertion(a.input(jwkOf(a.pair.publicKey)))).rejects.toThrow(/verify it was you/);
  });

  it("rejects a counter that didn't move forward, but allows devices that always report zero", async () => {
    const back = assertion({ count: 3 });
    await expect(verifyAssertion(back.input(jwkOf(back.pair.publicKey), 3))).rejects.toThrow(/went backwards/);
    const zero = assertion({ count: 0 });
    expect(await verifyAssertion(zero.input(jwkOf(zero.pair.publicKey), 0))).toEqual({ signCount: 0 });
  });
});

describe("DER signatures", () => {
  it("converts to the fixed 64-byte form, including short and padded integers", () => {
    const der = Buffer.from([0x30, 0x08, 0x02, 0x02, 0x00, 0x80, 0x02, 0x02, 0x01, 0x02]);
    const raw = derToRaw(der);
    expect(raw).toHaveLength(64);
    expect(raw[31]).toBe(0x80);
    expect(raw[62]).toBe(0x01);
    expect(raw[63]).toBe(0x02);
  });
});
