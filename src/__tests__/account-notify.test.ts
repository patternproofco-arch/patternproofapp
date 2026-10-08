import { describe, expect, it } from "vitest";
import { accountNotifyFields } from "@/lib/account-notify";

describe("account created notification payload", () => {
  it("omits the email address for a survivor account", () => {
    const fields = accountNotifyFields({
      role: "survivor",
      signedUpAt: "2026-10-08T12:00:00.000Z",
      source: "registration",
      contactEmail: "survivor@example.com",
      referralCode: "bff",
    });
    expect(fields.contactEmail).toBeUndefined();
    expect(fields.referralCode).toBe("bff");
    expect(JSON.stringify(fields)).not.toContain("survivor@example.com");
  });

  it("keeps a work email for an attorney or organization", () => {
    expect(
      accountNotifyFields({
        role: "attorney",
        signedUpAt: "2026-10-08T12:00:00.000Z",
        source: "attorney invitation accepted",
        contactEmail: "jordan@firm.example",
      }).contactEmail,
    ).toBe("jordan@firm.example");
    expect(
      accountNotifyFields({
        role: "org",
        signedUpAt: "2026-10-08T12:00:00.000Z",
        source: "organization provisioned",
        contactEmail: "desk@org.example",
        orgName: "Harbor Advocacy",
      }).orgName,
    ).toBe("Harbor Advocacy");
  });
});
