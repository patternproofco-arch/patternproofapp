import { describe, expect, it } from "vitest";
import { buildTeamInvitationMessage } from "@/lib/team-invitations.server";

describe("team invitation email delivery contract", () => {
  it("renders the verified recipient and keeps the token out of the request URL", async () => {
    const token = "sensitive-token-value-1234567890";
    const { acceptUrl, payload } = await buildTeamInvitationMessage(
      {
        invitationId: "11111111-1111-4111-8111-111111111111",
        email: "member@example.org",
        teamName: "Example Legal",
        teamKind: "firm",
        role: "member",
        token,
        expiresDays: 7,
      },
      "https://staging.example.org/",
    );

    expect(acceptUrl).toBe(`https://staging.example.org/team-invite#firm=${token}`);
    expect(acceptUrl.split("#")[0]).not.toContain(token);
    expect(payload).toMatchObject({
      to: "member@example.org",
      from: "PatternProof <noreply@pattern-proof.tech>",
      sender_domain: "notify.pattern-proof.tech",
      purpose: "transactional",
      label: "team-invitation",
      idempotency_key: "team-invitation:11111111-1111-4111-8111-111111111111",
    });
    expect(String(payload.html)).toContain("Example Legal");
    expect(String(payload.html)).toContain(acceptUrl);
    expect(String(payload.text)).toContain("Accept secure invitation");
  });

  it("uses the organization fragment for DV organization invitations", async () => {
    const { acceptUrl } = await buildTeamInvitationMessage(
      {
        invitationId: "22222222-2222-4222-8222-222222222222",
        email: "advocate@example.org",
        teamName: "Example DV Organization",
        teamKind: "organization",
        role: "admin",
        token: "organization-token-1234567890",
        expiresDays: 3,
      },
      "https://staging.example.org",
    );
    expect(acceptUrl).toContain("/team-invite#org=");
  });
});
