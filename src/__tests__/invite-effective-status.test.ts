import { describe, expect, it } from "vitest";
import { resolveInviteEffectiveStatus } from "@/lib/advocate-survivor-invites.server";
import { readFileSync } from "node:fs";

describe("resolveInviteEffectiveStatus (grant-aware badge lifecycle)", () => {
  const now = Date.parse("2026-09-17T12:00:00.000Z");

  it("pending stays pending until expires_at", () => {
    expect(
      resolveInviteEffectiveStatus({
        inviteStatus: "pending",
        expiresAt: "2026-09-20T00:00:00.000Z",
        now,
      }),
    ).toBe("pending");
    expect(
      resolveInviteEffectiveStatus({
        inviteStatus: "pending",
        expiresAt: "2026-09-01T00:00:00.000Z",
        now,
      }),
    ).toBe("expired");
  });

  it("accepted is green only while live grant is active", () => {
    expect(
      resolveInviteEffectiveStatus({
        inviteStatus: "accepted",
        grant: { status: "active", expires_at: null },
        now,
      }),
    ).toBe("accepted");
  });

  it("accepted + missing/revoked grant → revoked (Access withdrawn)", () => {
    expect(
      resolveInviteEffectiveStatus({
        inviteStatus: "accepted",
        grant: null,
        now,
      }),
    ).toBe("revoked");
    expect(
      resolveInviteEffectiveStatus({
        inviteStatus: "accepted",
        grant: { status: "revoked", expires_at: null },
        now,
      }),
    ).toBe("revoked");
  });

  it("accepted + expired grant → expired", () => {
    expect(
      resolveInviteEffectiveStatus({
        inviteStatus: "accepted",
        grant: { status: "active", expires_at: "2026-09-01T00:00:00.000Z" },
        now,
      }),
    ).toBe("expired");
  });
});

describe("Advocate invite badge + survivor-only PIN (source contracts)", () => {
  const ui = readFileSync("src/routes/_advocate/advocate-cases.index.tsx", "utf8");
  const auth = readFileSync("src/routes/_authenticated.tsx", "utf8");
  const fns = readFileSync("src/lib/advocate-survivor-invites.functions.ts", "utf8");

  it("badge labels follow grant lifecycle (Access withdrawn after revoke)", () => {
    expect(ui).toContain('label: "Access withdrawn"');
    expect(ui).toContain('label: "Accepted"');
    expect(ui).toContain('label: "Pending"');
    expect(ui).not.toContain('label: "Revoked"');
  });

  it("list joins live advocate_client_links before effective_status", () => {
    expect(fns).toContain('from("advocate_client_links")');
    expect(fns).toContain("survivor_invite_id");
    expect(fns).toContain("resolveInviteEffectiveStatus");
  });
});

describe("badge boundary and partial-revocation cases", () => {
  const now = Date.parse("2026-09-17T12:00:00Z");
  it.each(["2026-09-17T12:00:00Z", "bad date"])(
    "never accepts an expired or malformed grant: %s",
    (expires_at) => {
      expect(
        resolveInviteEffectiveStatus({
          inviteStatus: "accepted",
          grant: { status: "active", expires_at },
          now,
        }),
      ).toBe("expired");
    },
  );
  it("revoked_at overrides a leftover active status", () => {
    expect(
      resolveInviteEffectiveStatus({
        inviteStatus: "accepted",
        grant: { status: "active", revoked_at: "2026-09-17T11:00:00Z" },
        now,
      }),
    ).toBe("revoked");
  });
  it("invite expiry also prevents a green badge", () => {
    expect(
      resolveInviteEffectiveStatus({
        inviteStatus: "accepted",
        expiresAt: "2026-09-17T11:00:00Z",
        grant: { status: "active" },
        now,
      }),
    ).toBe("expired");
  });
});
