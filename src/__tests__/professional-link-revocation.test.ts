import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  OWN_EXPORT_TTL_SECONDS,
  PROFESSIONAL_LINK_TTL_SECONDS,
  purgeProfessionalExports,
} from "@/lib/professional-links.server";

function fakeStorage(objects: string[]) {
  const removed: string[] = [];
  return {
    removed,
    client: {
      storage: {
        from: () => ({
          list: async (prefix: string) => ({
            data: objects
              .filter((o) => o.startsWith(`${prefix}/`))
              .map((o) => ({ name: o.slice(prefix.length + 1) })),
            error: null,
          }),
          remove: async (paths: string[]) => {
            removed.push(...paths);
            return { error: null };
          },
        }),
      },
    },
  };
}

const ATTORNEY = "11111111-1111-4111-8111-111111111111";
const SURVIVOR_A = "22222222-2222-4222-8222-222222222222";
const SURVIVOR_B = "33333333-3333-4333-8333-333333333333";

describe("download links handed to professionals", () => {
  it("live for one minute, far shorter than the account holder's own export link", () => {
    expect(PROFESSIONAL_LINK_TTL_SECONDS).toBe(60);
    expect(OWN_EXPORT_TTL_SECONDS).toBeLessThanOrEqual(300);
    expect(PROFESSIONAL_LINK_TTL_SECONDS).toBeLessThan(OWN_EXPORT_TTL_SECONDS);
  });

  it("removes only the withdrawing survivor's packets, invalidating old links", async () => {
    const fake = fakeStorage([
      `${ATTORNEY}/professional-review-packet-${SURVIVOR_A}-t1.zip`,
      `${ATTORNEY}/case-package-${SURVIVOR_A}-t2.zip`,
      `${ATTORNEY}/professional-review-packet-${SURVIVOR_B}-t3.zip`,
    ]);
    const removed = await purgeProfessionalExports(fake.client, {
      professionalUserId: ATTORNEY,
      clientUserId: SURVIVOR_A,
    });
    expect(removed).toBe(2);
    expect(fake.removed.every((p) => p.includes(SURVIVOR_A))).toBe(true);
    expect(fake.removed.some((p) => p.includes(SURVIVOR_B))).toBe(false);
  });

  it("never fails the withdrawal when storage cleanup breaks", async () => {
    const broken = {
      storage: {
        from: () => ({
          list: async () => {
            throw new Error("storage down");
          },
          remove: async () => ({ error: null }),
        }),
      },
    };
    await expect(
      purgeProfessionalExports(broken, {
        professionalUserId: ATTORNEY,
        clientUserId: SURVIVOR_A,
      }),
    ).resolves.toBe(0);
  });

  it("is wired into both attorney and advocate withdrawal", () => {
    const attorney = readFileSync("src/lib/attorney-invitations.functions.ts", "utf8");
    const advocate = readFileSync("src/lib/advocate.functions.ts", "utf8");
    for (const src of [attorney, advocate]) {
      expect(src).toContain("purgeProfessionalExports");
    }
  });

  it("no professional-facing link is signed for an hour any more", () => {
    for (const f of [
      "src/lib/attorney-portal.functions.ts",
      "src/lib/attorney-public.functions.ts",
      "src/lib/payments.functions.ts",
    ]) {
      const src = readFileSync(f, "utf8");
      expect(src).toContain("PROFESSIONAL_LINK_TTL_SECONDS");
      expect(src).not.toContain("createSignedUrl(objectPath, 60 * 60");
      expect(src).not.toMatch(/createSignedUrl\([^)]*,\s*3600\)/);
    }
  });
});
