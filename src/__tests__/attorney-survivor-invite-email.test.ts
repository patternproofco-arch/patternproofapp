import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Regression: attorney → survivor invites must use the allowlisted
 * invitation-email path (not claim emailed while only writing DB + token).
 */
const send = readFileSync("src/lib/email/invitation-email.functions.ts", "utf8");
const clientSend = readFileSync("src/lib/email/send.ts", "utf8");
const registry = readFileSync("src/lib/email-templates/registry.ts", "utf8");
const template = readFileSync(
  "src/lib/email-templates/attorney-survivor-invitation.tsx",
  "utf8",
);
const ui = readFileSync("src/routes/_attorney/clients.index.tsx", "utf8");
const createFns = readFileSync("src/lib/attorney-survivor-invites.functions.ts", "utf8");

describe("attorney → survivor invite email delivery", () => {
  it("allowlists attorney-survivor-invitation and authorizes from attorney_survivor_invites", () => {
    expect(registry).toContain('"attorney-survivor-invitation"');
    expect(clientSend).toContain('"attorney-survivor-invitation"');
    expect(send).toContain('"attorney-survivor-invitation"');
    expect(send).toContain('templateName === "attorney-survivor-invitation"');
    expect(send).toContain('.from("attorney_survivor_invites")');
    expect(send).toContain(".eq(\"attorney_user_id\", userId)");
    expect(send).toContain("`${origin}/survivor-invite/${inv.invite_token}`");
  });

  it("keeps discreet mode soft (no firm/app/note in discreet branch)", () => {
    expect(template).toContain("if (discreet)");
    expect(template).toContain("A private link you asked about.");
    expect(template).toContain("Opening it shares nothing");
    expect(template).toMatch(/Opening this\s+email link alone does not grant access/);
    expect(template).not.toContain("court-ready");
    expect(send).toContain("const discreet = data.discreet !== false");
    expect(send).toContain("attorneyName: discreet ? undefined");
  });

  it("UI emails on create and resend with honest toasts (never claims emailed on failure)", () => {
    expect(ui).toContain('templateName: "attorney-survivor-invitation"');
    expect(ui).toContain("sendTransactionalEmail");
    expect(ui).toContain('idempotencyKey: `attorney-survivor-invitation-${created.invite.id}`');
    expect(ui).toContain(
      'idempotencyKey: `attorney-survivor-invitation-resend-${inv.id}-${Date.now()}`',
    );
    expect(ui).toContain("Invite emailed. You can also copy the link below.");
    expect(ui).toContain(
      "Invite created, but the email didn't go out. Copy the link to share it.",
    );
    expect(ui).toContain(
      "Invite emailed again for 30 more days. You can also copy the link.",
    );
    expect(ui).toContain(
      "Invite renewed for 30 more days; email couldn't be sent — copy the link.",
    );
    expect(ui).not.toContain("Invite sent. Copy the link to share securely.");
    expect(ui).not.toContain("Invite reactivated for 30 more days.");
    // Create still writes DB separately; delivery is via sendTransactionalEmail
    expect(createFns).toContain("createSurvivorInvite");
    expect(createFns).toContain("resendSurvivorInvite");
    expect(createFns).not.toContain("deliverTransactionalEmail");
  });

  it("offers discreet / standard / link-only sender options", () => {
    expect(ui).toContain('useState<"discreet" | "standard" | "none">("discreet")');
    expect(ui).toContain("Discreet email — plain subject, no firm, app, or note shown");
    expect(ui).toContain("Don't email — I'll share the link a safe way");
    expect(ui).toContain("Ask your client first. Someone else may read their inbox.");
  });
});
