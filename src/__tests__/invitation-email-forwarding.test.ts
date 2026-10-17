import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const sendInvitationEmail = vi.fn(async (_input: unknown) => ({ success: true }));
vi.mock("@/lib/email/invitation-email.functions", () => ({
  sendInvitationEmail: (input: unknown) => sendInvitationEmail(input),
}));

import { sendTransactionalEmail } from "@/lib/email/send";

const ID = "11111111-1111-4111-8111-111111111111";

describe("attorney invitation email", () => {
  it("forwards the exact invitation id, because the server refuses to send without it", async () => {
    await sendTransactionalEmail({
      templateName: "attorney-invitation",
      recipientEmail: "lawyer@firm.test",
      idempotencyKey: `attorney-invitation-${ID}`,
      invitationId: ID,
    });
    expect(sendInvitationEmail).toHaveBeenCalledWith({
      data: expect.objectContaining({ invitationId: ID, templateName: "attorney-invitation" }),
    });
  });

  it("both the first send and the resend on the share page pass the id", () => {
    const page = readFileSync("src/routes/_authenticated/share-with-attorney.tsx", "utf8");
    const calls = page.match(/templateName: "attorney-invitation"[\s\S]*?templateData/g) ?? [];
    expect(calls).toHaveLength(2);
    for (const call of calls) expect(call).toContain("invitationId: r.invitation.id");
  });

  it("the server still refuses to send an attorney invitation without an id", () => {
    const server = readFileSync("src/lib/email/invitation-email.functions.ts", "utf8");
    expect(server).toContain("if (!data.invitationId)");
  });
});
